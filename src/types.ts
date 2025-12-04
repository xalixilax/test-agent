export type Bookmark = {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: Bookmark[];
  screenshot?: string;
  parentId?: string;
  comments?: Comment[];
  rating?: number;
}

export type Comment = {
  id: string;
  bookmarkId: string;
  text: string;
  timestamp: number;
}

export type BreadcrumbItem = {
  id: string;
  title: string;
}
