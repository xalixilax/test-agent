import { describe, expect, it } from "vitest";
import type { FieldName } from "sync-protocol";
import {
  assembleRecord,
  parseHolders,
  parseMove,
  parseRating,
  parseTags,
  serializeHolders,
  serializeMove,
  serializeRating,
  serializeTags,
  type LocalField,
} from "./metadata";

const field = (
  name: FieldName,
  value: string | null,
  overrides: Partial<LocalField> = {},
): LocalField => ({
  uuid: "u1",
  field: name,
  value,
  updatedAt: 100,
  deviceId: "a",
  deleted: false,
  dirty: false,
  ...overrides,
});

describe("metadata value objects", () => {
  it("accepts ratings inside 0-5 and rejects the rest", () => {
    expect(parseRating("4.5")).toBe(4.5);
    expect(parseRating("6")).toBeUndefined();
    expect(parseRating("-1")).toBeUndefined();
    expect(parseRating("abc")).toBeUndefined();
    expect(serializeRating(3)).toBe("3");
    expect(() => serializeRating(9)).toThrow();
  });

  it("parses, trims, dedupes and sorts tags", () => {
    expect(parseTags('["b","a","b"," a "]')).toEqual(["a", "b"]);
    expect(parseTags("not json")).toEqual([]);
    expect(serializeTags(["b", "a", "b"])).toBe('["a","b"]');
  });

  it("parses, dedupes and sorts holders", () => {
    expect(parseHolders('["b","a","a",""]')).toEqual(["b", "a"]);
    expect(parseHolders("not json")).toEqual([]);
    expect(serializeHolders(["b", "a", "a"])).toBe('["a","b"]');
  });

  it("parses a move intent and rejects malformed values", () => {
    expect(parseMove('{"target":"device-a","state":"requested"}')).toEqual({
      target: "device-a",
      state: "requested",
    });
    expect(parseMove('{"target":"device-a","state":"teleporting"}')).toBeUndefined();
    expect(parseMove('{"state":"requested"}')).toBeUndefined();
    expect(parseMove("{")).toBeUndefined();
    expect(parseMove(null)).toBeUndefined();
    expect(serializeMove({ target: "device-a", state: "done" })).toBe(
      '{"target":"device-a","state":"done"}',
    );
  });

  it("assembles a record from fields", () => {
    const record = assembleRecord([
      field("url", "https://a.com/"),
      field("title", "Example"),
      field("note", "hello"),
      field("rating", "4"),
      field("tags", '["x"]'),
      field("holders", '["b","a"]'),
      field("move", '{"target":"b","state":"requested"}'),
      field("screenshot_url", "https://a.com/og.png"),
      field("image_key", "abc"),
    ]);

    expect(record).toMatchObject({
      uuid: "u1",
      url: "https://a.com/",
      title: "Example",
      note: "hello",
      rating: 4,
      tags: ["x"],
      holders: ["b", "a"],
      move: { target: "b", state: "requested" },
      screenshotUrl: "https://a.com/og.png",
      imageKey: "abc",
      deleted: false,
    });
  });

  it("returns null without a url field", () => {
    expect(assembleRecord([field("note", "hello")])).toBeNull();
  });

  it("marks a record deleted only when the tombstone is newest", () => {
    const deleted = assembleRecord([
      field("url", "https://a.com/"),
      field("__deleted", "1", { deleted: true, updatedAt: 200 }),
    ]);
    expect(deleted?.deleted).toBe(true);

    const resurrected = assembleRecord([
      field("url", "https://a.com/"),
      field("__deleted", "1", { deleted: true, updatedAt: 100 }),
      field("note", "newer", { updatedAt: 200 }),
    ]);
    expect(resurrected?.deleted).toBe(false);
  });
});
