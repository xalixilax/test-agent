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

  const bookmarkQuery = useBookmarksTree();

  const folder = bookmarkQuery.data?.filter(
    (node) => node.children !== undefined
  );

  const bookmark = bookmarkQuery.data?.filter((node) => node.url !== undefined);

  console.log("Folder nodes:", folder);
  console.log("Bookmark nodes:", bookmark);

  // set current parent id in the url query parameter
  useEffect(() => {
    const url = new URL(window.location.href);
    if (currentFolderId !== null) {
      url.searchParams.set("parentId", currentFolderId.toString());
    } else {
      url.searchParams.delete("parentId");
    }
    window.history.replaceState({}, "", url.toString());
  }, [currentFolderId]);

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
          {/* <BookmarkList
            items={filteredBookmarks}
            onDelete={handleDeleteBookmark}
            onCaptureScreenshot={captureScreenshot}
            onDeleteScreenshot={deleteScreenshot}
            onNavigateToFolder={navigateToFolder}
            isSearching={!!searchTerm}
          /> */}
          {folder &&
            folder.map((item) => (
              <div className="p-2 border-2 border-black mb-2" key={item.id}>
                <strong>{item.title}</strong> - ID: {item.id} -{" "}
                {item.url ? `URL: ${item.url}` : "Folder"}
              </div>
            ))}
          {bookmark &&
            bookmark.map((item) => (
              <div className="p-2 border-2 border-black mb-2" key={item.id}>
                <strong>{item.title}</strong> - ID: {item.id} - URL: {item.url}
              </div>
            ))}

          <NewBookmarkList tree={bookmarkQuery.data} />
        </div>
      </div>
    </div>
  );
}

function NewBookmarkList({
  tree,
}: {
  tree: chrome.bookmarks.BookmarkTreeNode;
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

function useBookmarksTree() {
  return useQuery({
    queryKey: ["getBookmarksTree"],
    queryFn: async () => {
      const nodes = await chrome.bookmarks.getTree();
      return nodes[0].children?.find((node) => node.id === "1")?.children; // "1" is usually the "Bookmarks Bar"
    },
  });
}
