import { useEffect, useState, useCallback } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { useBookmarks } from "./hooks/useBookmarks";
import {
  useUpdateBookmark,
  useSyncChromeBookmarks,
  useBookmarksWithTags,
} from "./db/useBookmark";
import { useScreenshots } from "./hooks/useScreenshots";
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
    return parentId;
  };

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
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
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [fetchProgress, setFetchProgress] = useState({
    processed: 0,
    total: 0,
    success: 0,
    failed: 0,
  });
  const updateBookmarkMutation = useUpdateBookmark();
  const syncChromeBookmarksMutation = useSyncChromeBookmarks();
  const {
    screenshots,
    loadScreenshots,
    captureScreenshot: captureScreenshotHook,
    deleteScreenshot: deleteScreenshotHook,
  } = useScreenshots();

  // Navigate to a folder and update URL
  const navigateToFolder = useCallback(
    (folderId: string | null, folderTitle: string) => {
      setCurrentFolderId(folderId);

      // Update URL with pushState for browser history
      const url = new URL(window.location.href);
      if (folderId !== null) {
        url.searchParams.set("parentId", folderId);
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
          { id: folderId, title: folderTitle },
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
      setCurrentFolderId(id);
      url.searchParams.set("parentId", id);

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

  // Load bookmarks and screenshots immediately on mount
  useEffect(() => {
    loadBookmarks();
    loadScreenshots();
  }, [loadBookmarks, loadScreenshots]);

  // Listen for fetch progress updates
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "fetchProgress") {
        setFetchProgress({
          processed: message.processed,
          total: message.total,
          success: message.success,
          failed: message.failed,
        });
      }
    };

    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => chrome.runtime.onMessage.removeListener(handleMessage);
    }
  }, []);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      const parentId = params.get("parentId");

      setCurrentFolderId(parentId);

      // Rebuild breadcrumbs based on current folder
      // You might need to traverse bookmarks to rebuild the full path
      if (parentId === null) {
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
    // This function is kept for compatibility but bookmark creation
    // should happen through Chrome's API, not directly in the database
    console.warn(
      "handleAddBookmark called - bookmarks should be created through Chrome API"
    );
  };

  const handleDeleteBookmark = (id: string) => {
    deleteBookmark(id);
  };

  const captureScreenshot = useCallback(
    async (chromeBookmarkId: string, url: string) => {
      // Use the hook to capture screenshot
      captureScreenshotHook(chromeBookmarkId, url);
    },
    [captureScreenshotHook]
  );

  const deleteScreenshot = useCallback(
    async (chromeBookmarkId: string) => {
      // Use the hook to delete screenshot
      deleteScreenshotHook(chromeBookmarkId);
    },
    [deleteScreenshotHook]
  );

  const fetchAllMissingImages = useCallback(async () => {
    if (isFetchingImages) return;

    setIsFetchingImages(true);
    setFetchProgress({ processed: 0, total: 0, success: 0, failed: 0 });

    try {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage(
          { action: "fetchAllMissingImages" },
          (response) => {
            if (response?.success) {
              console.log(
                `Fetched images: ${response.successCount} succeeded, ${response.failCount} failed`
              );
              loadScreenshots(); // Reload screenshots to show new images
            } else {
              console.error("Failed to fetch missing images:", response?.error);
            }
            setIsFetchingImages(false);
          }
        );
      }
    } catch (error) {
      console.error("Error fetching missing images:", error);
      setIsFetchingImages(false);
    }
  }, [isFetchingImages, loadScreenshots]);

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

  const chromeBookmarkQuery = useChromeBookmarksTree(currentFolderId);
  const { data: dbBookmarks = [] } = useBookmarksWithTags();

  // Helper to enrich Chrome bookmarks with DB data (tags, notes, etc.)
  const enrichBookmark = useCallback(
    (chromeBookmark: chrome.bookmarks.BookmarkTreeNode) => {
      const dbData = dbBookmarks.find(
        (b) => b.chromeBookmarkId === chromeBookmark.id
      );
      const screenshotData = screenshots[chromeBookmark.id];
      return {
        ...chromeBookmark,
        note: dbData?.note || undefined,
        rating: dbData?.rating || undefined,
        screenshot: screenshotData?.dataUrl || undefined,
        tags: dbData?.tags || [],
      };
    },
    [dbBookmarks, screenshots]
  );

  // For search, we need to flatten and search across all bookmarks
  const flattenedBookmarks = (
    nodes: chrome.bookmarks.BookmarkTreeNode[]
  ): chrome.bookmarks.BookmarkTreeNode[] => {
    let result: chrome.bookmarks.BookmarkTreeNode[] = [];
    for (const node of nodes) {
      if (node.children) {
        result = result.concat(flattenedBookmarks(node.children));
      } else if (node.url) {
        result.push(node);
      }
    }
    return result;
  };

  const filteredBookmarks = searchTerm
    ? flattenedBookmarks(chromeBookmarkQuery.data || [])
        .map(enrichBookmark) // Enrich with DB data
        .filter(
          (bookmark) =>
            bookmark.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bookmark.url &&
              bookmark.url.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (bookmark as any).note
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()) ||
            (bookmark as any).tags?.some((tag: any) =>
              tag.name.toLowerCase().includes(searchTerm.toLowerCase())
            )
        )
    : (chromeBookmarkQuery.data || []).map(enrichBookmark);

  if (chromeBookmarkQuery.isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">LOADING...</div>
      </div>
    );
  }

  if (chromeBookmarkQuery.isError) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ background: "var(--color-bg)" }}
      >
        <div className="text-2xl font-bold">
          ERROR LOADING BOOKMARKS: {String(chromeBookmarkQuery.error)}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen">
      {/* Compact header for small screens, larger for desktop */}
      <div className="p-2 sm:p-4 md:p-6 border-b-4 border-black bg-orange-foreground-muted">
        <div className="flex items-center justify-between mx-auto max-w-7xl">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-lexend font-black text-foreground ">
              BOOKMARKS
            </h1>
            <p className="hidden md:block text-sm text-foreground font-bold mt-1">
              YOUR LINK COLLECTION
              {isFetchingImages && (
                <span className="ml-2 text-xs opacity-75">
                  (FETCHING IMAGES: {fetchProgress.processed}/
                  {fetchProgress.total})
                </span>
              )}
            </p>
          </div>
          <button
            onClick={fetchAllMissingImages}
            disabled={isFetchingImages}
            className="px-3 py-2 sm:px-4 sm:py-2 font-black text-xs sm:text-sm bg-white text-black border-3 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingImages ? "⏳ FETCHING..." : "🖼️ FETCH ALL IMAGES"}
          </button>
        </div>
      </div>
      <div className=" flex flex-col gap-4 h-full max-w-7xl mx-auto my-4">
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

function useChromeBookmarksTree(folderId: string | null) {
  return useQuery({
    queryKey: ["getBookmarksTree", folderId],
    queryFn: async () => {
      // If no folderId specified, default to Bookmarks Bar ("1")
      const targetId = folderId || "1";

      // Get the specific folder's children
      const nodes = await chrome.bookmarks.getSubTree(targetId);
      return nodes[0]?.children; // Return children of the target folder
    },
  });
}
