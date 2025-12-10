import { useEffect, useState, useCallback } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import { openFullScreen } from "./hooks/useExtension";
import { useBookmarks } from "./hooks/useBookmarks";
import { useUpdateBookmark, useSyncChromeBookmarks } from "./db/useBookmark";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

// Helper function to flatten Chrome bookmark tree
const flattenChromeBookmarks = (nodes: chrome.bookmarks.BookmarkTreeNode[]): Array<{chromeBookmarkId: string; title: string; url: string}> => {
  let result: Array<{chromeBookmarkId: string; title: string; url: string}> = [];
  
  for (const node of nodes) {
    if (node.url) {
      result.push({
        chromeBookmarkId: node.id,
        title: node.title || "Untitled",
        url: node.url,
      });
    }
    if (node.children) {
      result = result.concat(flattenChromeBookmarks(node.children));
    }
  }
  
  return result;
};

function BookmarkManager() {
  const { bookmarks, loading, loadBookmarks, addBookmark, deleteBookmark } =
    useBookmarks();

  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const updateBookmarkMutation = useUpdateBookmark();
  const syncChromeBookmarksMutation = useSyncChromeBookmarks();

  const filteredBookmarks = searchTerm
    ? bookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.tags?.some((tag) =>
            tag.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : bookmarks;

  // Sync Chrome bookmarks on mount
  useEffect(() => {
    const syncBookmarks = async () => {
      if (typeof chrome !== 'undefined' && chrome.bookmarks) {
        try {
          setIsSyncing(true);
          const tree = await chrome.bookmarks.getTree();
          const flatBookmarks = flattenChromeBookmarks(tree);
          
          // Get screenshots from Chrome storage
          const result = await chrome.storage.local.get('screenshots');
          const screenshots: Record<string, { dataUrl: string; timestamp: number; url: string }> = (result.screenshots as Record<string, { dataUrl: string; timestamp: number; url: string }>) || {};
          
          // Add screenshot data to bookmarks
          const bookmarksWithScreenshots = flatBookmarks.map(bookmark => ({
            ...bookmark,
            screenshot: screenshots[bookmark.chromeBookmarkId]?.dataUrl || undefined,
          }));
          
          await syncChromeBookmarksMutation.mutateAsync({
            bookmarks: bookmarksWithScreenshots,
          });
          
          console.log(`Synced ${flatBookmarks.length} Chrome bookmarks`);
        } catch (error) {
          console.error('Failed to sync Chrome bookmarks:', error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    syncBookmarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  const handleAddBookmark = (title: string, url: string) => {
    addBookmark(title, url);
  };

  const handleDeleteBookmark = (id: number) => {
    deleteBookmark(id);
  };

  const captureScreenshot = useCallback(async (id: number, url: string) => {
    // Find the bookmark to get its Chrome bookmark ID
    const bookmark = bookmarks.find(b => b.id === id);
    if (!bookmark?.chromeBookmarkId || typeof chrome === 'undefined') {
      console.error('Cannot capture screenshot: Chrome bookmark ID not found');
      return;
    }

    // Send message to background script to capture screenshot
    chrome.runtime.sendMessage(
      { 
        action: 'captureScreenshot', 
        bookmarkId: bookmark.chromeBookmarkId, 
        url 
      },
      (response) => {
        if (response?.success && response?.dataUrl) {
          // Update the database with the screenshot
          updateBookmarkMutation.mutate({ 
            id, 
            screenshot: response.dataUrl 
          });
        } else {
          console.error('Failed to capture screenshot:', response?.error);
        }
      }
    );
  }, [bookmarks, updateBookmarkMutation]);

  const deleteScreenshot = useCallback(
    async (id: number) => {
      // Find the bookmark to get its Chrome bookmark ID
      const bookmark = bookmarks.find(b => b.id === id);
      
      // Delete from Chrome storage if we have the Chrome bookmark ID
      if (bookmark?.chromeBookmarkId && typeof chrome !== 'undefined') {
        chrome.runtime.sendMessage(
          { 
            action: 'deleteScreenshot', 
            bookmarkId: bookmark.chromeBookmarkId 
          },
          (response) => {
            if (!response?.success) {
              console.error('Failed to delete screenshot from Chrome storage:', response?.error);
            }
          }
        );
      }
      
      // Delete from database
      updateBookmarkMutation.mutate({ id, screenshot: "" });
    },
    [bookmarks, updateBookmarkMutation]
  );

  if (loading || isSyncing) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">
          {isSyncing ? "SYNCING BOOKMARKS..." : "LOADING..."}
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full min-h-screen"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="h-full max-w-7xl mx-auto">
        {/* Compact header for small screens, larger for desktop */}
        <div
          className="p-2 sm:p-4 md:p-6 border-b-4 border-black"
          style={{ background: "var(--color-primary)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-white">
                BOOKMARKS
              </h1>
              <p className="hidden md:block text-sm text-white font-bold mt-1">
                YOUR LINK COLLECTION
              </p>
            </div>
            <button
              onClick={openFullScreen}
              className="btn-brutal bg-white px-3 py-2 text-xs sm:text-sm font-black"
              title="Open in full screen"
            >
              EXPAND
            </button>
          </div>
        </div>

        <div className="p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          <AddBookmark onAdd={handleAddBookmark} />
          <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
          <BookmarkList
            items={filteredBookmarks}
            onDelete={handleDeleteBookmark}
            onCaptureScreenshot={captureScreenshot}
            onDeleteScreenshot={deleteScreenshot}
          />
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BookmarkManager />
    </QueryClientProvider>
  );
}

export default App;
