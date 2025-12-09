import { useState, useCallback } from "react";
import type { Bookmark } from "../types";

export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBookmarks = useCallback(() => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.getTree((bookmarkTree) => {
        setBookmarks(bookmarkTree);
        setLoading(false);
      });
    }
  }, []);

  const addBookmark = useCallback((title: string, url: string, parentId: string | null) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.create(
        {
          parentId: parentId || undefined,
          title,
          url,
        },
        () => {
          loadBookmarks();
        }
      );
    }
  }, [loadBookmarks]);

  const deleteBookmark = useCallback((id: string, isFolder: boolean) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      if (isFolder) {
        // It's a folder, remove it recursively
        chrome.bookmarks.removeTree(id, () => {
          loadBookmarks();
        });
      } else {
        // It's a bookmark, just remove it
        chrome.bookmarks.remove(id, () => {
          loadBookmarks();
        });
      }
    }
  }, [loadBookmarks]);

  const moveBookmark = useCallback((itemId: string, targetFolderId: string) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.move(itemId, { parentId: targetFolderId }, () => {
        loadBookmarks();
      });
    }
  }, [loadBookmarks]);

  return {
    bookmarks,
    loading,
    loadBookmarks,
    addBookmark,
    deleteBookmark,
    moveBookmark,
  };
};
