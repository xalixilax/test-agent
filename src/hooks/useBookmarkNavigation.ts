import { useState, useCallback, useMemo, useEffect } from "react";
import type { Bookmark, BreadcrumbItem } from "../types";
import { useBookmarkHelpers } from "./useBookmarkHelpers";

interface UseBookmarkNavigationProps {
  bookmarks: Bookmark[];
  screenshots: Record<string, any>;
}

export const useBookmarkNavigation = ({ bookmarks, screenshots }: UseBookmarkNavigationProps) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbPath, setBreadcrumbPath] = useState<BreadcrumbItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const { flattenBookmarks, findFolderById, buildPathToFolder } = useBookmarkHelpers();

  // Initialize to the root bookmark bar or first available folder
  useEffect(() => {
    if (bookmarks.length > 0 && bookmarks[0].children && !currentFolderId) {
      const bookmarkBar =
        bookmarks[0].children.find((node) => node.id === "1") ||
        bookmarks[0].children[0];
      if (bookmarkBar) {
        setCurrentFolderId(bookmarkBar.id);
        setBreadcrumbPath([
          { id: bookmarkBar.id, title: bookmarkBar.title || "Bookmarks" },
        ]);
      }
    }
  }, [bookmarks, currentFolderId]);

  const navigateToFolder = useCallback((folderId: string) => {
    setCurrentFolderId(folderId);
    const path = buildPathToFolder(bookmarks, folderId);
    if (path) {
      setBreadcrumbPath(path);
    }
    setSearchTerm(""); // Clear search when navigating
  }, [bookmarks, buildPathToFolder]);

  const getCurrentFolderItems = useCallback((): Bookmark[] => {
    if (!currentFolderId) return [];

    const folder = findFolderById(bookmarks, currentFolderId);
    if (!folder || !folder.children) return [];

    // Add screenshot data to bookmarks
    return folder.children.map((item) => {
      if (item.url) {
        return {
          ...item,
          screenshot: screenshots[item.id]?.dataUrl,
        };
      }
      return item;
    });
  }, [currentFolderId, bookmarks, screenshots, findFolderById]);

  const filteredBookmarks = useMemo(() => {
    if (searchTerm) {
      return flattenBookmarks(bookmarks)
        .filter(
          (bookmark) =>
            bookmark.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            bookmark.url?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .map((item) => ({
          ...item,
          screenshot: screenshots[item.id]?.dataUrl,
        }));
    }
    return getCurrentFolderItems();
  }, [searchTerm, bookmarks, screenshots, flattenBookmarks, getCurrentFolderItems]);

  return {
    currentFolderId,
    breadcrumbPath,
    searchTerm,
    filteredBookmarks,
    navigateToFolder,
    setSearchTerm,
  };
};
