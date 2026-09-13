import type { MetadataRecord } from "@/contexts/metadata/domain/metadata";

export interface BookmarkItem extends chrome.bookmarks.BookmarkTreeNode {
  record?: MetadataRecord;
}

export interface BreadcrumbItem {
  id: string;
  title: string;
}
