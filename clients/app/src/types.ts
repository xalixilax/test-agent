export type Bookmark = {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: Bookmark[];
  screenshot?: string;
  parentId?: string;
  note?: string;
  rating?: number;
  tags?: { id: number; name: string }[];
}

export type BreadcrumbItem = {
  id: string;
  title: string;
}

// Database types
export type DbBookmark = {
  chromeBookmarkId: string;
  note: string | null;
  rating: number | null;
  screenshot: string | null;
}

export type DbTag = {
  id: number;
  name: string;
}

export type BookmarkWithTags = DbBookmark & {
  tags: DbTag[];
  title?: string;
  url?: string;
}

