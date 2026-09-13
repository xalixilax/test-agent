import { normalizeUrl } from "@/contexts/metadata/domain/url";
import type { MetadataRecordView } from "@/contexts/metadata/domain/metadata";
import { flattenBookmarks } from "../hooks/useChromeBookmarks";
import type { BookmarkItem } from "../types";

const enrich = (
  node: chrome.bookmarks.BookmarkTreeNode,
  byUrl: Map<string, MetadataRecordView>,
): BookmarkItem => ({
  ...node,
  record: node.url ? byUrl.get(normalizeUrl(node.url)) : undefined,
});

const matches = (bookmark: BookmarkItem, term: string): boolean => {
  const inTitle = bookmark.title?.toLowerCase().includes(term) ?? false;
  const inUrl = bookmark.url?.toLowerCase().includes(term) ?? false;
  const inNote = bookmark.record?.note?.toLowerCase().includes(term) ?? false;
  const inTags = bookmark.record?.tags.some((tag) => tag.toLowerCase().includes(term)) ?? false;
  return inTitle || inUrl || inNote || inTags;
};

export const filterBookmarks = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  searchTerm: string,
  byUrl: Map<string, MetadataRecordView>,
): BookmarkItem[] => {
  if (!searchTerm) return nodes.map((node) => enrich(node, byUrl));

  const term = searchTerm.toLowerCase();
  return flattenBookmarks(nodes)
    .map((node) => enrich(node, byUrl))
    .filter((bookmark) => matches(bookmark, term));
};
