import { describe, expect, it } from "vitest";
import type { MetadataRecordView } from "@/contexts/metadata/domain/metadata";
import { filterRemoteBookmarks, remoteBookmarkItems } from "./remoteBookmarks";

const record = (overrides: Partial<MetadataRecordView>): MetadataRecordView => ({
  uuid: "u1",
  url: "https://example.com/page",
  tags: [],
  holders: ["device-b"],
  deleted: false,
  updatedAt: 1,
  ...overrides,
});

const names = new Map([
  ["device-a", "Brave (macOS)"],
  ["device-b", "Edge (Windows)"],
]);

describe("remoteBookmarkItems", () => {
  it("keeps only records held by another browser and not present locally", () => {
    const items = remoteBookmarkItems(
      [
        record({ uuid: "u1", holders: ["device-b"] }),
        record({ uuid: "u2", url: "https://local.example/", holders: ["device-b"] }),
        record({ uuid: "u3", url: "https://mine.example/", holders: ["device-a"] }),
      ],
      new Set(["https://local.example/"]),
      "device-a",
      names,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      url: "https://example.com/page",
      holderNames: ["Edge (Windows)"],
    });
  });

  it("falls back to the display url when the record has no title", () => {
    const items = remoteBookmarkItems([record({})], new Set(), "device-a", names);
    expect(items[0]?.title).toBe("example.com/page");
  });

  it("matches search terms across title, url, note and tags", () => {
    const items = remoteBookmarkItems(
      [record({ title: "Docs", note: "read later", tags: ["tools"] })],
      new Set(),
      "device-a",
      names,
    );

    expect(filterRemoteBookmarks(items, "doc")).toHaveLength(1);
    expect(filterRemoteBookmarks(items, "read")).toHaveLength(1);
    expect(filterRemoteBookmarks(items, "tools")).toHaveLength(1);
    expect(filterRemoteBookmarks(items, "missing")).toHaveLength(0);
  });
});
