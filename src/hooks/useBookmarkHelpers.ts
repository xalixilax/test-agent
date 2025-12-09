import { useCallback } from "react";
import type { Bookmark, BreadcrumbItem } from "../types";

export const useBookmarkHelpers = () => {
  const flattenBookmarks = useCallback((nodes: Bookmark[]): Bookmark[] => {
    let result: Bookmark[] = [];
    nodes.forEach((node) => {
      if (node.url) {
        result.push(node);
      }
      if (node.children) {
        result = result.concat(flattenBookmarks(node.children));
      }
    });
    return result;
  }, []);

  const findFolderById = useCallback((nodes: Bookmark[], id: string): Bookmark | null => {
    for (const node of nodes) {
      if (node.id === id) {
        return node;
      }
      if (node.children) {
        const found = findFolderById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  }, []);

  const buildPathToFolder = useCallback((
    nodes: Bookmark[],
    targetId: string,
    path: BreadcrumbItem[] = []
  ): BreadcrumbItem[] | null => {
    for (const node of nodes) {
      const newPath = [
        ...path,
        { id: node.id, title: node.title || "Untitled" },
      ];

      if (node.id === targetId) {
        return newPath;
      }

      if (node.children) {
        const found = buildPathToFolder(node.children, targetId, newPath);
        if (found) return found;
      }
    }
    return null;
  }, []);

  return {
    flattenBookmarks,
    findFolderById,
    buildPathToFolder,
  };
};
