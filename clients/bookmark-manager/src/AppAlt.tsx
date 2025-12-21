import { useEffect, useState, useCallback } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { useBookmarks } from "./hooks/useBookmarks";
import { useUpdateBookmark, useSyncChromeBookmarks } from "./db/useBookmark";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
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
  // Initialize from URL parameter
  const getInitialFolderId = () => {
    const params = new URLSearchParams(window.location.search);
    const parentId = params.get("parentId");
    return parentId ? parseInt(parentId) : null;
  };

  const [currentFolderId, setCurrentFolderId] = useState<number | null>(
    getInitialFolderId
  );
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

  // Navigate to a folder and update URL
  const navigateToFolder = useCallback(
    (folderId: number | null, folderTitle: string) => {
      setCurrentFolderId(folderId);

      // Update URL with pushState for browser history
      const url = new URL(window.location.href);
      if (folderId !== null) {
        url.searchParams.set("parentId", folderId.toString());
      } else {
        url.searchParams.delete("parentId");
      }
      window.history.pushState({ folderId }, "", url.toString());

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

  // Navigate via breadcrumb and update URL
  const navigateToBreadcrumb = useCallback((id: string) => {
    const url = new URL(window.location.href);

    if (id === "root") {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      url.searchParams.delete("parentId");
    } else {
      const folderId = parseInt(id);
      setCurrentFolderId(folderId);
      url.searchParams.set("parentId", folderId.toString());

      // Trim breadcrumbs to this point
      setBreadcrumbs((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        return prev.slice(0, index + 1);
      });
    }

    window.history.pushState(
      { folderId: id === "root" ? null : parseInt(id) },
      "",
      url.toString()
    );
  }, []);

  // Load bookmarks immediately on mount
  useEffect(() => {
    loadBookmarks();
  }, [loadBookmarks]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const parentId = params.get("parentId");
      const folderId = parentId ? parseInt(parentId) : null;

      setCurrentFolderId(folderId);

      // Rebuild breadcrumbs based on current folder
      // You might need to traverse bookmarks to rebuild the full path
      if (folderId === null) {
        setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      } else {
        // For now, just update the state - breadcrumbs will rebuild on next navigation
        // In a more complete implementation, you'd traverse the bookmark tree to rebuild the path
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

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

  // if (loading) {
  //   return (
  //     <div
  //       className="flex items-center justify-center h-screen"
  //       style={{ background: "var(--color-bg)" }}
  //     >
  //       <div className="text-2xl font-bold">LOADING...</div>
  //     </div>
  //   );
  // }

  const bookmarkQuery = useBookmarksTree(currentFolderId);

  if (bookmarkQuery.isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">LOADING...</div>
      </div>
    );
  }

  if (bookmarkQuery.isError) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">
          ERROR LOADING BOOKMARKS: {String(bookmarkQuery.error)}
        </div>
      </div>
    );
  }

  // Convert Chrome bookmarks to BookmarkWithTags format
  const convertedBookmarks: BookmarkWithTags[] = (bookmarkQuery.data || []).map(
    (node) => ({
      id: parseInt(node.id),
      chromeBookmarkId: node.id,
      chromeParentId: node.parentId,
      parentId: node.parentId ? parseInt(node.parentId) : null,
      title: node.title || "Untitled",
      url: node.url || null,
      isFolder: node.children ? 1 : 0,
      dateAdded: node.dateAdded ? new Date(node.dateAdded) : null,
      tags: [],
      note: null,
      rating: null,
      screenshot: null,
    })
  );

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
                {/* {isSyncing && (
                  <span className="ml-2 text-xs opacity-75">(SYNCING...)</span>
                )} */}
              </p>
            </div>
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
            items={convertedBookmarks}
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

function NewBookmarkList({
  tree,
}: {
  tree: chrome.bookmarks.BookmarkTreeNode[];
}) {
  console.log("Bookmark tree:", tree);

  return (
    <div className="p-4 border-4 border-black">
      <pre>{JSON.stringify(tree, null, 2)}</pre>
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

function useBookmarksTree(folderId: number | null) {
  return useQuery({
    queryKey: ["getBookmarksTree", folderId],
    queryFn: async () => {
      // If no folderId specified, default to Bookmarks Bar ("1")
      const targetId = folderId?.toString() || "1";

      // Get the specific folder's children
      const nodes = await chrome.bookmarks.getSubTree(targetId);
      return nodes[0]?.children; // Return children of the target folder
    },
  });
}
