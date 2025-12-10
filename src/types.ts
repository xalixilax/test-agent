export type Bookmark = {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: Bookmark[];
  screenshot?: string;
  parentId?: string;
  rating?: number | null;
  note?: string | null;
  tags?: string | null;
}

export type BreadcrumbItem = {
  id: string;
  title: string;
}
