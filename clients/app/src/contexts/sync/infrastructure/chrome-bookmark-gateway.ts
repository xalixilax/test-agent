import { normalizeUrl } from "@/contexts/metadata/domain/url";
import type { BookmarkGateway, BookmarkSnapshot } from "../application/ports";

const OTHER_BOOKMARKS_ID = "2";

const toSnapshot = (node: chrome.bookmarks.BookmarkTreeNode): BookmarkSnapshot | null =>
  node.url ? { id: node.id, url: node.url, title: node.title ?? "" } : null;

const flatten = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] => {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) result.push(...flatten(node.children));
  }
  return result;
};

export class ChromeBookmarkGateway implements BookmarkGateway {
  async list(): Promise<BookmarkSnapshot[]> {
    const tree = await chrome.bookmarks.getTree();
    return flatten(tree).flatMap((node) => toSnapshot(node) ?? []);
  }

  async findByUrl(url: string): Promise<BookmarkSnapshot[]> {
    const nodes = await chrome.bookmarks.search({ url });
    const exact = nodes.flatMap((node) => toSnapshot(node) ?? []);
    if (exact.length > 0) return exact;
    // Chrome matches raw URL strings; fall back to normalized comparison so
    // trailing-slash variants merge instead of duplicating.
    const key = normalizeUrl(url);
    return (await this.list()).filter((item) => normalizeUrl(item.url) === key);
  }

  async create(input: { url: string; title: string }): Promise<BookmarkSnapshot> {
    const node = await chrome.bookmarks.create({
      parentId: OTHER_BOOKMARKS_ID,
      title: input.title,
      url: input.url,
    });
    return { id: node.id, url: node.url ?? input.url, title: node.title ?? input.title };
  }

  async remove(id: string): Promise<void> {
    await chrome.bookmarks.remove(id);
  }
}
