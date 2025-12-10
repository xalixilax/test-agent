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
  id: number;
  chromeBookmarkId: string | null;
  title: string;
  url: string;
  note: string | null;
  rating: number | null;
  dateAdded: Date | null;
  screenshot: string | null;
}

export type DbTag = {
  id: number;
  name: string;
}

export type BookmarkWithTags = DbBookmark & {
  tags: DbTag[];
}

