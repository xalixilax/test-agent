import { useQuery } from "@tanstack/react-query";

export const useChromeBookmarksTree = (folderId: string | null) =>
  useQuery({
    queryKey: ["chromeBookmarks", folderId],
    queryFn: async () => {
      const targetId = folderId ?? "1";
      const nodes = await chrome.bookmarks.getSubTree(targetId);
      return nodes[0]?.children;
    },
  });

export const useAllChromeBookmarks = () =>
  useQuery({
    queryKey: ["chromeBookmarks", "all"],
    queryFn: async () => chrome.bookmarks.getTree(),
  });

export const flattenBookmarks = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
): chrome.bookmarks.BookmarkTreeNode[] => {
  const result: chrome.bookmarks.BookmarkTreeNode[] = [];
  for (const node of nodes) {
    if (node.children) {
      result.push(...flattenBookmarks(node.children));
    } else if (node.url) {
      result.push(node);
    }
  }
  return result;
};
