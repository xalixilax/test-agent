import { useCallback } from "react";
import { useBookmarksWithTags, useAddBookmark, useUpdateBookmark, useDeleteBookmark } from "../db/useBookmark";
import type { BookmarkWithTags } from "../types";

export const useBookmarks = () => {
  const { data: bookmarks = [], isLoading: loading, refetch: loadBookmarks } = useBookmarksWithTags();
  const addBookmarkMutation = useAddBookmark();
  const updateBookmarkMutation = useUpdateBookmark();
  const deleteBookmarkMutation = useDeleteBookmark();

  const addBookmark = useCallback((title: string, url: string) => {
    addBookmarkMutation.mutate({
      title,
      url,
    });
  }, [addBookmarkMutation]);

  const updateBookmark = useCallback((
    id: number,
    updates: { note?: string; rating?: number; screenshot?: string }
  ) => {
    updateBookmarkMutation.mutate({
      id,
      ...updates,
    });
  }, [updateBookmarkMutation]);

  const deleteBookmark = useCallback((id: number) => {
    deleteBookmarkMutation.mutate({ id });
  }, [deleteBookmarkMutation]);

  return {
    bookmarks: bookmarks as BookmarkWithTags[],
    loading,
    loadBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
  };
};
