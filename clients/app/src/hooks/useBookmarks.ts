import { useCallback, useState, useEffect } from "react";
import { useBookmarksWithTags, useAddBookmark, useUpdateBookmark, useDeleteBookmark } from "../db/useBookmark";

export const useBookmarks = (currentFolderId: string | null = null) => {
  const { data: dbBookmarks = [], isLoading: dbLoading } = useBookmarksWithTags();
  const [chromeBookmarks, setChromeBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([]);
  const [allChromeBookmarks, setAllChromeBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  const addBookmarkMutation = useAddBookmark();
  const updateBookmarkMutation = useUpdateBookmark();
  const deleteBookmarkMutation = useDeleteBookmark();

  // Function to enrich Chrome bookmarks with database data
  const enrichBookmark = useCallback((chromeBookmark: chrome.bookmarks.BookmarkTreeNode) => {
    const dbData = dbBookmarks.find(b => b.chromeBookmarkId === chromeBookmark.id);
    return {
      ...chromeBookmark,
      note: dbData?.note || undefined,
      rating: dbData?.rating || undefined,
      screenshot: dbData?.screenshot || undefined,
      tags: dbData?.tags || [],
    };
  }, [dbBookmarks]);

  // Flatten Chrome bookmark tree for search
  const flattenBookmarks = useCallback((nodes: chrome.bookmarks.BookmarkTreeNode[]): chrome.bookmarks.BookmarkTreeNode[] => {
    let result: chrome.bookmarks.BookmarkTreeNode[] = [];

    for (const node of nodes) {
      if (node.children) {
        result.push(node); // Include folders
        result = result.concat(flattenBookmarks(node.children));
      } else {
        result.push(node);
      }
    }

    return result;
  }, []);

  // Load Chrome bookmarks
  const loadBookmarks = useCallback(async () => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      try {
        setLoading(true);

        if (currentFolderId) {
          // Get bookmarks for specific folder
          const children = await chrome.bookmarks.getChildren(currentFolderId);
          const enrichedChildren = children.map(enrichBookmark);
          setChromeBookmarks(enrichedChildren);
        } else {
          // Get all bookmarks (from root)
          const tree = await chrome.bookmarks.getTree();
          const flatBookmarks = flattenBookmarks(tree);
          const enrichedBookmarks = flatBookmarks.map(enrichBookmark);

          // Filter to get just the top-level items (Bookmarks Bar and Other Bookmarks)
          const rootChildren: chrome.bookmarks.BookmarkTreeNode[] = [];
          for (const node of tree) {
            if (node.children) {
              rootChildren.push(...node.children);
            }
          }
          const enrichedRootChildren = rootChildren.map(enrichBookmark);

          setChromeBookmarks(enrichedRootChildren);
          setAllChromeBookmarks(enrichedBookmarks);
        }
      } catch (error) {
        console.error('Failed to load Chrome bookmarks:', error);
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [currentFolderId, enrichBookmark, flattenBookmarks]);

  // Load bookmarks when folder changes or db data changes
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks, dbBookmarks]);

  const addBookmark = useCallback(async (chromeBookmarkId: string, title?: string, url?: string) => {
    // Add to database - Chrome bookmark already exists
    const result = await addBookmarkMutation.mutateAsync({
      chromeBookmarkId,
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
    bookmarks: chromeBookmarks,
    allBookmarks: allChromeBookmarks, // For search - all flattened bookmarks
    loading: loading || dbLoading,
    loadBookmarks,
    addBookmark,
    updateBookmark,
    deleteBookmark,
  };
};
