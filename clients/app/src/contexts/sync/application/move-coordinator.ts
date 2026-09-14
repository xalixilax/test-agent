import {
  serializeHolders,
  serializeMove,
  type MetadataRecord,
  type MoveIntent,
} from "@/contexts/metadata/domain/metadata";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import type { BookmarkSnapshot, MoveCoordinatorDeps } from "./ports";

// Keeps the shared bookmark inventory in step with the local browser, and
// executes move intents in both directions. All state lives in the synced
// metadata store, so every step is safe to replay after a restart.
export class MoveCoordinator {
  private chain: Promise<void> = Promise.resolve();
  private queued = false;

  constructor(private readonly deps: MoveCoordinatorDeps) {}

  // Coalesces bursts of bookmark events into one reconciliation.
  reconcile(): Promise<void> {
    if (this.queued) return this.chain;
    this.queued = true;
    this.chain = this.chain.then(
      () => {
        this.queued = false;
        return this.reconcileOnce();
      },
      () => {
        this.queued = false;
        return this.reconcileOnce();
      },
    );
    return this.chain;
  }

  async requestMove(url: string, target: string): Promise<void> {
    const deviceId = await this.deps.repository.getDeviceId();
    await this.writeMove(url, { target, state: "requested" }, deviceId);
    this.deps.onChange?.();
  }

  private async reconcileOnce(): Promise<void> {
    await this.processMoves();
    await this.syncInventory();
  }

  private async processMoves(): Promise<void> {
    const deviceId = await this.deps.repository.getDeviceId();
    const records = await this.deps.repository.listRecords();

    for (const record of records) {
      const move = record.move;
      if (!move) continue;

      if (move.target === deviceId && move.state === "requested") {
        await this.applyIncoming(record, move, deviceId);
      } else if (move.target !== deviceId && move.state === "applied") {
        await this.finishOutgoing(record, move, deviceId);
      }
    }
  }

  // Materialises a bookmark addressed to this browser. Idempotent: an existing
  // bookmark with the same URL is merged rather than duplicated.
  private async applyIncoming(
    record: MetadataRecord,
    move: MoveIntent,
    deviceId: string,
  ): Promise<void> {
    try {
      const existing = await this.deps.bookmarks.findByUrl(record.url);
      if (existing.length === 0) {
        await this.deps.bookmarks.create({
          url: record.url,
          title: record.title ?? record.url,
        });
      }
      await this.writeMove(record.url, { ...move, state: "applied" }, deviceId);
    } catch {
      await this.writeMove(record.url, { ...move, state: "failed" }, deviceId);
    }
    this.deps.onChange?.();
  }

  // The destination confirmed; drop every local copy so the move is a move.
  private async finishOutgoing(
    record: MetadataRecord,
    move: MoveIntent,
    deviceId: string,
  ): Promise<void> {
    const copies = await this.deps.bookmarks.findByUrl(record.url);
    for (const copy of copies) {
      await this.deps.bookmarks.remove(copy.id);
    }
    await this.writeMove(record.url, { ...move, state: "done" }, deviceId);
    this.deps.onChange?.();
  }

  private async syncInventory(): Promise<void> {
    const { repository, bookmarks, clock } = this.deps;
    const deviceId = await repository.getDeviceId();

    const local = await bookmarks.list();
    const localByUrl = new Map<string, BookmarkSnapshot>();
    for (const snapshot of local) {
      const key = normalizeUrl(snapshot.url);
      if (!localByUrl.has(key)) localByUrl.set(key, snapshot);
    }

    const records = await repository.listRecords();
    const recordByUrl = new Map(records.map((record) => [normalizeUrl(record.url), record]));
    const inventory = new Map(
      (await repository.listBookmarkInventory()).map((entry) => [entry.chromeId, entry]),
    );

    await this.dropStaleInventory(inventory.keys(), new Set(local.map((item) => item.id)));

    for (const [key, snapshot] of localByUrl) {
      const record = recordByUrl.get(key);
      const previous = inventory.get(snapshot.id);
      const changed =
        !previous || normalizeUrl(previous.url) !== key || previous.title !== snapshot.title;

      if (!record) {
        await this.writeField(snapshot.url, "title", snapshot.title, deviceId);
        await this.writeField(snapshot.url, "holders", serializeHolders([deviceId]), deviceId);
        await repository.upsertBookmarkInventory({
          chromeId: snapshot.id,
          url: snapshot.url,
          title: snapshot.title,
        });
        continue;
      }

      if (changed && record.title !== snapshot.title) {
        await this.writeField(snapshot.url, "title", snapshot.title, deviceId);
      }
      if (!record.holders.includes(deviceId)) {
        await this.writeField(
          snapshot.url,
          "holders",
          serializeHolders([...record.holders, deviceId]),
          deviceId,
        );
      }
      if (changed) {
        await repository.upsertBookmarkInventory({
          chromeId: snapshot.id,
          url: snapshot.url,
          title: snapshot.title,
        });
      }
    }

    for (const record of records) {
      if (!record.holders.includes(deviceId)) continue;
      if (localByUrl.has(normalizeUrl(record.url))) continue;

      const remaining = record.holders.filter((id) => id !== deviceId);
      if (remaining.length === 0) {
        await repository.purgeByUrl(record.url, clock.now(), deviceId);
      } else {
        await this.writeField(record.url, "holders", serializeHolders(remaining), deviceId);
      }
    }
  }

  private async dropStaleInventory(
    chromeIds: Iterable<string>,
    localIds: Set<string>,
  ): Promise<void> {
    const stale = [...chromeIds].filter((chromeId) => !localIds.has(chromeId));
    if (stale.length > 0) await this.deps.repository.deleteBookmarkInventory(stale);
  }

  private async writeField(
    url: string,
    field: "title" | "holders",
    value: string,
    deviceId: string,
  ): Promise<void> {
    await this.deps.repository.setFieldByUrl({
      url,
      field,
      value,
      updatedAt: this.deps.clock.now(),
      deviceId,
    });
  }

  private async writeMove(url: string, move: MoveIntent, deviceId: string): Promise<void> {
    await this.deps.repository.setFieldByUrl({
      url,
      field: "move",
      value: serializeMove(move),
      updatedAt: this.deps.clock.now(),
      deviceId,
    });
  }
}
