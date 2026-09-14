import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { applySchema } from "@/shared/db/pglite";
import { PgliteMetadataRepository } from "@/contexts/metadata/infrastructure/pglite-metadata-repository";
import { serializeHolders, serializeMove } from "@/contexts/metadata/domain/metadata";
import type { Clock, BookmarkGateway, BookmarkSnapshot } from "./ports";
import { MoveCoordinator } from "./move-coordinator";

const URL = "https://example.com/page";

class TestClock implements Clock {
  private time = 100;

  now(): number {
    return ++this.time;
  }

  observeServerTime(): void {}
}

class FakeBookmarkGateway implements BookmarkGateway {
  private items: BookmarkSnapshot[] = [];
  private nextId = 1;
  failCreate = false;

  add(url: string, title = ""): BookmarkSnapshot {
    const item = { id: String(this.nextId++), url, title };
    this.items.push(item);
    return { ...item };
  }

  async list(): Promise<BookmarkSnapshot[]> {
    return this.items.map((item) => ({ ...item }));
  }

  async findByUrl(url: string): Promise<BookmarkSnapshot[]> {
    return this.items.filter((item) => item.url === url).map((item) => ({ ...item }));
  }

  async create(input: { url: string; title: string }): Promise<BookmarkSnapshot> {
    if (this.failCreate) throw new Error("create failed");
    return this.add(input.url, input.title);
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((item) => item.id !== id);
  }
}

const setup = async () => {
  const db = new PGlite();
  await db.waitReady;
  await applySchema(db);
  const repository = new PgliteMetadataRepository(db);
  await repository.setSyncState("device.id", "device-a");
  const bookmarks = new FakeBookmarkGateway();
  const clock = new TestClock();
  const coordinator = new MoveCoordinator({ repository, bookmarks, clock });
  return { repository, bookmarks, clock, coordinator };
};

type Ctx = Awaited<ReturnType<typeof setup>>;

const writeRemote = (
  { repository, clock }: Ctx,
  url: string,
  field: "title" | "holders" | "move",
  value: string,
  deviceId = "device-b",
) =>
  repository.setFieldByUrl({
    url,
    field,
    value,
    updatedAt: clock.now(),
    deviceId,
  });

describe("MoveCoordinator", () => {
  let ctx: Ctx;

  beforeEach(async () => {
    ctx = await setup();
  });

  it("publishes title and possession for local bookmarks", async () => {
    ctx.bookmarks.add(URL, "Example page");

    await ctx.coordinator.reconcile();

    const records = await ctx.repository.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      url: URL,
      title: "Example page",
      holders: ["device-a"],
    });
  });

  it("does not write again when nothing changed", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await ctx.coordinator.reconcile();
    await ctx.repository.markPushed(await ctx.repository.listDirtyFields());

    await ctx.coordinator.reconcile();

    expect(await ctx.repository.countDirtyFields()).toBe(0);
  });

  it("asserts possession when a synced record omits this device", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await writeRemote(ctx, URL, "title", "Example page");
    await writeRemote(ctx, URL, "holders", serializeHolders(["device-b"]));

    await ctx.coordinator.reconcile();

    const record = await ctx.repository.findByUrl(URL);
    expect(record?.holders.sort()).toEqual(["device-a", "device-b"]);
  });

  it("drops possession only when the last holder leaves", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await ctx.coordinator.reconcile();

    await writeRemote(ctx, URL, "holders", serializeHolders(["device-a", "device-b"]));
    const bookmark = (await ctx.bookmarks.list())[0];
    await ctx.bookmarks.remove(bookmark.id);
    await ctx.coordinator.reconcile();

    const record = await ctx.repository.findByUrl(URL);
    expect(record?.holders).toEqual(["device-b"]);

    await writeRemote(ctx, URL, "holders", serializeHolders(["device-b"]));
    const remaining = await ctx.repository.findByUrl(URL);
    expect(remaining).not.toBeNull();
    // device-b still holds it, so the record must survive.
    expect(remaining?.holders).toEqual(["device-b"]);
  });

  it("tombstones the record once every holder is gone", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await ctx.coordinator.reconcile();

    const bookmark = (await ctx.bookmarks.list())[0];
    await ctx.bookmarks.remove(bookmark.id);
    await ctx.coordinator.reconcile();

    await expect(ctx.repository.findByUrl(URL)).resolves.toBeNull();
  });

  it("applies an incoming move once, however often it is replayed", async () => {
    await writeRemote(ctx, URL, "title", "Example page");
    await writeRemote(ctx, URL, "holders", serializeHolders(["device-b"]));
    await writeRemote(ctx, URL, "move", serializeMove({ target: "device-a", state: "requested" }));

    await ctx.coordinator.reconcile();
    await ctx.coordinator.reconcile();

    expect(await ctx.bookmarks.list()).toHaveLength(1);
    const record = await ctx.repository.findByUrl(URL);
    expect(record?.move).toEqual({ target: "device-a", state: "applied" });
    expect(record?.holders.sort()).toEqual(["device-a", "device-b"]);
  });

  it("merges an incoming move when the URL already exists locally", async () => {
    ctx.bookmarks.add(URL, "Mine");
    await writeRemote(ctx, URL, "move", serializeMove({ target: "device-a", state: "requested" }));

    await ctx.coordinator.reconcile();

    expect(await ctx.bookmarks.list()).toHaveLength(1);
    const record = await ctx.repository.findByUrl(URL);
    expect(record?.move?.state).toBe("applied");
  });

  it("marks a failed incoming move and keeps nothing behind", async () => {
    ctx.bookmarks.failCreate = true;
    await writeRemote(ctx, URL, "move", serializeMove({ target: "device-a", state: "requested" }));

    await ctx.coordinator.reconcile();

    expect(await ctx.bookmarks.list()).toHaveLength(0);
    const record = await ctx.repository.findByUrl(URL);
    expect(record?.move?.state).toBe("failed");
  });

  it("removes the local copy and confirms when the destination applied", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await ctx.coordinator.reconcile();
    await writeRemote(ctx, URL, "holders", serializeHolders(["device-a", "device-b"]), "device-a");

    await ctx.coordinator.requestMove(URL, "device-b");
    await writeRemote(ctx, URL, "move", serializeMove({ target: "device-b", state: "applied" }));
    await ctx.coordinator.reconcile();

    expect(await ctx.bookmarks.list()).toHaveLength(0);
    const record = await ctx.repository.findByUrl(URL);
    expect(record?.move).toEqual({ target: "device-b", state: "done" });
    expect(record?.holders).toEqual(["device-b"]);
  });

  it("leaves a bookmark re-added after a done move alone", async () => {
    ctx.bookmarks.add(URL, "Example page");
    await ctx.coordinator.reconcile();
    await writeRemote(ctx, URL, "holders", serializeHolders(["device-a", "device-b"]), "device-a");
    await ctx.coordinator.requestMove(URL, "device-b");
    await writeRemote(ctx, URL, "move", serializeMove({ target: "device-b", state: "applied" }));
    await ctx.coordinator.reconcile();

    ctx.bookmarks.add(URL, "Added again");
    await ctx.coordinator.reconcile();

    expect(await ctx.bookmarks.list()).toHaveLength(1);
    const record = await ctx.repository.findByUrl(URL);
    expect(record?.holders.sort()).toEqual(["device-a", "device-b"]);
  });
});
