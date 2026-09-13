import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { MIGRATIONS } from "@/shared/db/migrations";
import { PgliteMetadataRepository } from "./pglite-metadata-repository";
import { normalizeUrl } from "../domain/url";
import { stableUuid } from "../domain/uuid";

const createRepository = async () => {
  const db = new PGlite();
  await db.waitReady;
  for (const migration of MIGRATIONS) {
    await db.exec(migration.sql);
  }
  return new PgliteMetadataRepository(db);
};

const URL = "https://example.com/page";

describe("PgliteMetadataRepository", () => {
  let repository: PgliteMetadataRepository;

  beforeEach(async () => {
    repository = await createRepository();
  });

  it("creates a record with the identity url field on first write", async () => {
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "hello",
      updatedAt: 100,
      deviceId: "device-a",
    });

    const records = await repository.listRecords();
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      url: normalizeUrl(URL),
      note: "hello",
      uuid: await stableUuid(normalizeUrl(URL)),
    });

    await expect(repository.findByUrl(URL)).resolves.toMatchObject({
      note: "hello",
    });
  });

  it("does not overwrite an existing url field stamp", async () => {
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "hello",
      updatedAt: 100,
      deviceId: "device-a",
    });
    await repository.setFieldByUrl({
      url: URL,
      field: "rating",
      value: "4",
      updatedAt: 200,
      deviceId: "device-a",
    });

    const dirty = await repository.listDirtyFields();
    const urlField = dirty.find((field) => field.field === "url");
    expect(urlField?.updatedAt).toBe(100);
  });

  it("only clears dirty rows whose version was pushed", async () => {
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "first",
      updatedAt: 100,
      deviceId: "device-a",
    });
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "second",
      updatedAt: 150,
      deviceId: "device-a",
    });

    await repository.markPushed([
      {
        uuid: await stableUuid(normalizeUrl(URL)),
        field: "note",
        value: "first",
        updatedAt: 100,
        deviceId: "device-a",
        deleted: false,
      },
    ]);

    const dirty = await repository.listDirtyFields();
    const dirtyNotes = dirty.filter((field) => field.field === "note");
    expect(dirtyNotes).toHaveLength(1);
    expect(dirtyNotes[0]).toMatchObject({ value: "second", updatedAt: 150 });
  });

  it("applies newer remote fields and ignores older ones", async () => {
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "local",
      updatedAt: 100,
      deviceId: "device-a",
    });
    const uuid = await stableUuid(normalizeUrl(URL));

    await repository.applyRemoteChanges([
      {
        uuid,
        field: "note",
        value: "remote older",
        updatedAt: 50,
        deviceId: "device-b",
        deleted: false,
        seq: 1,
      },
      {
        uuid,
        field: "note",
        value: "remote newer",
        updatedAt: 200,
        deviceId: "device-b",
        deleted: false,
        seq: 2,
      },
    ]);

    await expect(repository.findByUrl(URL)).resolves.toMatchObject({
      note: "remote newer",
    });
    const dirtyNotes = (await repository.listDirtyFields()).filter(
      (field) => field.field === "note",
    );
    expect(dirtyNotes).toHaveLength(0);
  });

  it("hides purged records and resurrects them on new local edits", async () => {
    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "hello",
      updatedAt: 100,
      deviceId: "device-a",
    });
    await repository.purgeByUrl(URL, 200, "device-a");
    await expect(repository.listRecords()).resolves.toHaveLength(0);
    await expect(repository.findByUrl(URL)).resolves.toBeNull();

    await repository.setFieldByUrl({
      url: URL,
      field: "note",
      value: "back",
      updatedAt: 300,
      deviceId: "device-a",
    });
    await expect(repository.findByUrl(URL)).resolves.toMatchObject({
      note: "back",
    });
  });

  it("keeps local metadata for a url when the same page is stored twice", async () => {
    await repository.setFieldByUrl({
      url: "https://example.com/page/",
      field: "note",
      value: "hello",
      updatedAt: 100,
      deviceId: "device-a",
    });
    await expect(repository.findByUrl("https://example.com/page")).resolves.toMatchObject(
      { note: "hello" },
    );
  });
});
