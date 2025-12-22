import { useCallback } from "react";
import { useBookmarksWithTags, useBookmarksByParent, useAddBookmark, useUpdateBookmark, useDeleteBookmark } from "../db/useBookmark";
import type { BookmarkWithTags } from "../types";

export const useBookmarks = (currentFolderId: string | null = null) => {
  const { data: allBookmarks = [], isLoading: allLoading } = useBookmarksWithTags();
  const { data: folderBookmarks = [], isLoading: folderLoading, refetch: loadBookmarks } = useBookmarksByParent(currentFolderId);
  const addBookmarkMutation = useAddBookmark();
  const updateBookmarkMutation = useUpdateBookmark();
  const deleteBookmarkMutation = useDeleteBookmark();

  const addBookmark = useCallback(async (chromeBookmarkId: string, title?: string, url?: string) => {
    // Add to database - Chrome bookmark already exists
    const result = await addBookmarkMutation.mutateAsync({
      chromeBookmarkId,
      title,
      url,
    });

    return result;
  }, [addBookmarkMutation]);

  const updateBookmark = useCallback((
    chromeBookmarkId: string,
    updates: { note?: string; rating?: number; screenshot?: string }
  ) => {
    updateBookmarkMutation.mutate({
      chromeBookmarkId,
      ...updates,
    });
  }, [updateBookmarkMutation]);

  const deleteBookmark = useCallback(async (chromeBookmarkId: string) => {
    // Delete from database
    await deleteBookmarkMutation.mutateAsync({ chromeBookmarkId });

    // Also delete from Chrome bookmarks if available
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      try {
        await chrome.bookmarks.remove(chromeBookmarkId);
      } catch (error) {
        console.error('Failed to delete from Chrome bookmarks:', error);
      }
    }
  }, [deleteBookmarkMutation]);

  return {
    bookmarks: folderBookmarks as BookmarkWithTags[],
    allBookmarks: allBookmarks as BookmarkWithTags[], // For search
    loading: folderLoading || allLoading,
    loadBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
  };
};
