import { useEffect, useState, useCallback } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { openFullScreen } from "./hooks/useExtension";
import { useBookmarks } from "./hooks/useBookmarks";
import { useUpdateBookmark, useSyncChromeBookmarks } from "./db/useBookmark";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BreadcrumbItem, BookmarkWithTags } from "./types";

const queryClient = new QueryClient();

// Helper function to convert Chrome bookmark tree to hierarchical structure
const processChromeBookmarks = (
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  chromeParentId?: string
): Array<{
  chromeBookmarkId: string;
  chromeParentId?: string;
  title: string;
  url?: string;
  isFolder: number;
}> => {
  let result: Array<{
    chromeBookmarkId: string;
    chromeParentId?: string;
    title: string;
    url?: string;
    isFolder: number;
  }> = [];

  for (const node of nodes) {
    // Skip the root nodes (id "0"), but process their children
    if (node.id === "0") {
      if (node.children) {
        result = result.concat(processChromeBookmarks(node.children));
      }
      continue;
    }

    // Skip Chrome's special folders (like "Bookmarks Bar" root container)
    // but include their contents with proper parent relationships
    const isSpecialRoot = !node.parentId || node.parentId === "0";

    if (node.children) {
      // This is a folder
      if (!isSpecialRoot) {
        result.push({
          chromeBookmarkId: node.id,
          chromeParentId: chromeParentId,
          title: node.title || "Untitled Folder",
          isFolder: 1,
        });
      }
      // Process children with this node as parent
      result = result.concat(
        processChromeBookmarks(
          node.children,
          isSpecialRoot ? chromeParentId : node.id
        )
      );
    } else if (node.url) {
      // This is a bookmark
      result.push({
        chromeBookmarkId: node.id,
        chromeParentId: chromeParentId,
        title: node.title || "Untitled",
        url: node.url,
        isFolder: 0,
      });
    }
  }

  return result;
};

function BookmarkManager() {
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", title: "Bookmarks" },
  ]);

  const {
    bookmarks,
    allBookmarks,
    loading,
    loadBookmarks,
    addBookmark,
    deleteBookmark,
  } = useBookmarks(currentFolderId);

  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const updateBookmarkMutation = useUpdateBookmark();
  const syncChromeBookmarksMutation = useSyncChromeBookmarks();

  const filteredBookmarks = searchTerm
    ? allBookmarks.filter(
        (bookmark) =>
          bookmark.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (bookmark.url &&
            bookmark.url.toLowerCase().includes(searchTerm.toLowerCase())) ||
          bookmark.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.tags?.some((tag) =>
            tag.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : bookmarks;

  // Navigate to a folder
  const navigateToFolder = useCallback(
    (folderId: number | null, folderTitle: string) => {
      setCurrentFolderId(folderId);

      if (folderId === null) {
        // Navigate to root
        setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      } else {
        // Add to breadcrumbs
        setBreadcrumbs((prev) => [
          ...prev,
          { id: folderId.toString(), title: folderTitle },
        ]);
      }
    },
    []
  );

  // Navigate via breadcrumb
  const navigateToBreadcrumb = useCallback((id: string) => {
    if (id === "root") {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
    } else {
      const folderId = parseInt(id);
      setCurrentFolderId(folderId);

      // Trim breadcrumbs to this point
      setBreadcrumbs((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        return prev.slice(0, index + 1);
      });
    }
  }, []);

  // Load bookmarks immediately on mount
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Sync Chrome bookmarks asynchronously in the background
  useEffect(() => {
    const syncBookmarks = async () => {
      if (typeof chrome !== "undefined" && chrome.bookmarks) {
        try {
          setIsSyncing(true);
          const tree = await chrome.bookmarks.getTree();
          const hierarchicalBookmarks = processChromeBookmarks(tree);

          // Get screenshots from Chrome storage
          const result = await chrome.storage.local.get("screenshots");
          const screenshots: Record<
            string,
            { dataUrl: string; timestamp: number; url: string }
          > =
            (result.screenshots as Record<
              string,
              { dataUrl: string; timestamp: number; url: string }
            >) || {};

          // Add screenshot data to bookmarks
          const bookmarksWithScreenshots = hierarchicalBookmarks.map(
            (bookmark) => ({
              ...bookmark,
              screenshot:
                screenshots[bookmark.chromeBookmarkId]?.dataUrl || undefined,
            })
          );

          await syncChromeBookmarksMutation.mutateAsync({
            bookmarks: bookmarksWithScreenshots,
          });

          console.log(
            `Synced ${hierarchicalBookmarks.length} Chrome bookmarks`
          );
        } catch (error) {
          console.error("Failed to sync Chrome bookmarks:", error);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    // Run sync on mount
    syncBookmarks();

    // Listen for bookmark changes from background script
    if (typeof chrome !== "undefined" && chrome.runtime) {
      const handleMessage = (message: any) => {
        if (message.action === "bookmarkChanged") {
          console.log("Bookmark changed, re-syncing...");
          syncBookmarks();
        }
      };

      chrome.runtime.onMessage.addListener(handleMessage);

      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  const handleAddBookmark = (title: string, url: string, isFolder: boolean) => {
    addBookmark(title, url, currentFolderId, isFolder ? 1 : 0);
  };

  const handleDeleteBookmark = (id: number) => {
    deleteBookmark(id);
  };

  const captureScreenshot = useCallback(
    async (id: number, url: string) => {
      // Find the bookmark to get its Chrome bookmark ID
      const bookmark = bookmarks.find((b) => b.id === id);
      if (!bookmark?.chromeBookmarkId || typeof chrome === "undefined") {
        console.error(
          "Cannot capture screenshot: Chrome bookmark ID not found"
        );
        return;
      }

      // Send message to background script to capture screenshot
      chrome.runtime.sendMessage(
        {
          action: "captureScreenshot",
          bookmarkId: bookmark.chromeBookmarkId,
          url,
        },
        (response) => {
          if (response?.success && response?.dataUrl) {
            // Update the database with the screenshot
            updateBookmarkMutation.mutate({
              id,
              screenshot: response.dataUrl,
            });
          } else {
            console.error("Failed to capture screenshot:", response?.error);
          }
        }
      );
    },
    [bookmarks, updateBookmarkMutation]
  );

  const deleteScreenshot = useCallback(
    async (id: number) => {
      // Find the bookmark to get its Chrome bookmark ID
      const bookmark = bookmarks.find((b) => b.id === id);

      // Delete from Chrome storage if we have the Chrome bookmark ID
      if (bookmark?.chromeBookmarkId && typeof chrome !== "undefined") {
        chrome.runtime.sendMessage(
          {
            action: "deleteScreenshot",
            bookmarkId: bookmark.chromeBookmarkId,
          },
          (response) => {
            if (!response?.success) {
              console.error(
                "Failed to delete screenshot from Chrome storage:",
                response?.error
              );
            }
          }
        );
      }

      // Delete from database
      updateBookmarkMutation.mutate({ id, screenshot: "" });
    },
    [bookmarks, updateBookmarkMutation]
  );

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">LOADING...</div>
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
                {isSyncing && (
                  <span className="ml-2 text-xs opacity-75">(SYNCING...)</span>
                )}
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
          <Breadcrumb path={breadcrumbs} onNavigate={navigateToBreadcrumb} />
          <AddBookmark
            onAdd={handleAddBookmark}
            currentFolderId={currentFolderId}
          />
          <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
          <BookmarkList
            items={filteredBookmarks}
            onDelete={handleDeleteBookmark}
            onCaptureScreenshot={captureScreenshot}
            onDeleteScreenshot={deleteScreenshot}
            onNavigateToFolder={navigateToFolder}
            isSearching={!!searchTerm}
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
