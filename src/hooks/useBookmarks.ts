import { useCallback } from "react";
import { useBookmarksWithTags, useBookmarksByParent, useAddBookmark, useUpdateBookmark, useDeleteBookmark } from "../db/useBookmark";
import type { BookmarkWithTags } from "../types";

export const useBookmarks = (currentFolderId: number | null = null) => {
  const { data: allBookmarks = [], isLoading: allLoading } = useBookmarksWithTags();
  const { data: folderBookmarks = [], isLoading: folderLoading, refetch: loadBookmarks } = useBookmarksByParent(currentFolderId);
  const addBookmarkMutation = useAddBookmark();
  const updateBookmarkMutation = useUpdateBookmark();
  const deleteBookmarkMutation = useDeleteBookmark();

  const addBookmark = useCallback(async (title: string, url: string, parentId: number | null = null, isFolder: number = 0) => {
    // Add to database first
    const result = await addBookmarkMutation.mutateAsync({
      title,
      url: isFolder ? undefined : url,
      parentId,
      isFolder,
    });

    // Also add to Chrome bookmarks if available
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      try {
        // Find the Chrome parent ID if parentId is set
        let chromeParentId: string | undefined;
        if (parentId !== null) {
          const parentBookmark = [...allBookmarks, ...folderBookmarks].find(b => b.id === parentId);
          chromeParentId = parentBookmark?.chromeBookmarkId || undefined;
        }

        if (isFolder) {
          // Create folder in Chrome
          await chrome.bookmarks.create({
            title,
            parentId: chromeParentId,
          });
        } else {
          // Create bookmark in Chrome
          await chrome.bookmarks.create({
            title,
            url,
            parentId: chromeParentId,
          });
        }
      } catch (error) {
        console.error('Failed to add to Chrome bookmarks:', error);
      }
    }

    return result;
  }, [addBookmarkMutation, allBookmarks, folderBookmarks]);

  const updateBookmark = useCallback((
    id: number,
    updates: { note?: string; rating?: number; screenshot?: string }
  ) => {
    updateBookmarkMutation.mutate({
      id,
      ...updates,
    });
  }, [updateBookmarkMutation]);

  const deleteBookmark = useCallback(async (id: number) => {
    // Find the bookmark to get Chrome ID
    const bookmark = [...allBookmarks, ...folderBookmarks].find(b => b.id === id);
    
    // Delete from database
    await deleteBookmarkMutation.mutateAsync({ id });

    // Also delete from Chrome bookmarks if available
    if (bookmark?.chromeBookmarkId && typeof chrome !== "undefined" && chrome.bookmarks) {
      try {
        await chrome.bookmarks.remove(bookmark.chromeBookmarkId);
      } catch (error) {
        console.error('Failed to delete from Chrome bookmarks:', error);
      }
    }
  }, [deleteBookmarkMutation, allBookmarks, folderBookmarks]);

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
