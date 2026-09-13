import { useCallback, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { SyncPanel } from "@/contexts/identity/presentation/SyncPanel";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import {
  useBackfillImages,
  useMetadataEvents,
  useRecordsByUrl,
} from "./hooks/useMetadata";
import { useFetchProgress, useSyncStatus } from "./hooks/useSync";
import {
  flattenBookmarks,
  useChromeBookmarksTree,
} from "./hooks/useChromeBookmarks";
import type { BookmarkItem, BreadcrumbItem } from "./types";

const queryClient = new QueryClient();

function BookmarkManager() {
  const getInitialFolderId = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("parentId");
  };

  const getInitialSearchTerm = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") ?? "";
  };

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(
    getInitialFolderId,
  );
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: "root", title: "Bookmarks" },
  ]);
  const [searchTerm, setSearchTerm] = useState(getInitialSearchTerm);
  const [showSyncPanel, setShowSyncPanel] = useState(false);

  const { byUrl } = useRecordsByUrl();
  const { data: syncStatus } = useSyncStatus();
  const backfill = useBackfillImages();
  const fetchProgress = useFetchProgress();
  useMetadataEvents();

  const chromeBookmarkQuery = useChromeBookmarksTree(currentFolderId);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (searchTerm) {
      url.searchParams.set("search", searchTerm);
    } else {
      url.searchParams.delete("search");
    }
    window.history.replaceState({}, "", url.toString());
  }, [searchTerm]);

  const navigateToFolder = useCallback(
    (folderId: string | null, folderTitle: string) => {
      setCurrentFolderId(folderId);

      const url = new URL(window.location.href);
      if (folderId !== null) {
        url.searchParams.set("parentId", folderId);
      } else {
        url.searchParams.delete("parentId");
      }
      window.history.pushState({ folderId }, "", url.toString());

      if (folderId === null) {
        setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      } else {
        setBreadcrumbs((prev) => [
          ...prev,
          { id: folderId, title: folderTitle },
        ]);
      }
    },
    [],
  );

  const navigateToBreadcrumb = useCallback((id: string) => {
    const url = new URL(window.location.href);

    if (id === "root") {
      setCurrentFolderId(null);
      setBreadcrumbs([{ id: "root", title: "Bookmarks" }]);
      url.searchParams.delete("parentId");
    } else {
      setCurrentFolderId(id);
      url.searchParams.set("parentId", id);
      setBreadcrumbs((prev) => {
        const index = prev.findIndex((b) => b.id === id);
        return prev.slice(0, index + 1);
      });
    }

    window.history.pushState(
      { folderId: id === "root" ? null : id },
      "",
      url.toString(),
    );
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      setCurrentFolderId(params.get("parentId"));
      setSearchTerm(params.get("search") ?? "");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleAddBookmark = (
    title: string,
    url: string,
    isFolder: boolean,
  ) => {
    if (typeof chrome === "undefined" || !chrome.bookmarks) return;
    const parentId = currentFolderId ?? "1";
    const details = isFolder
      ? { parentId, title }
      : { parentId, title, url };
    chrome.bookmarks.create(details).catch((error: unknown) => {
      console.error("Failed to create bookmark:", error);
    });
  };

  const handleDeleteBookmark = (id: string) => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.remove(id).catch((error: unknown) => {
        console.error("Failed to delete bookmark:", error);
      });
    }
  };

  const records = useMemo(() => [...byUrl.values()], [byUrl]);
  const tagList = useMemo(
    () => [...new Set(records.flatMap((record) => record.tags))].sort(),
    [records],
  );

  const enrichBookmark = useCallback(
    (node: chrome.bookmarks.BookmarkTreeNode): BookmarkItem => ({
      ...node,
      record: node.url
        ? byUrl.get(normalizeUrl(node.url))
        : undefined,
    }),
    [byUrl],
  );

  const filteredBookmarks: BookmarkItem[] = searchTerm
    ? flattenBookmarks(chromeBookmarkQuery.data ?? [])
        .map(enrichBookmark)
        .filter((bookmark) => {
          const term = searchTerm.toLowerCase();
          return (
            bookmark.title?.toLowerCase().includes(term) ||
            bookmark.url?.toLowerCase().includes(term) ||
            bookmark.record?.note?.toLowerCase().includes(term) ||
            bookmark.record?.tags.some((tag) =>
              tag.toLowerCase().includes(term),
            )
          );
        })
    : (chromeBookmarkQuery.data ?? []).map(enrichBookmark);

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
      <div className="p-2 sm:p-4 md:p-6 border-b-4 border-black bg-orange-foreground-muted">
        <div className="flex items-center justify-between mx-auto max-w-7xl gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl md:text-3xl font-lexend font-black text-foreground">
              BOOKMARKS
            </h1>
            <p className="hidden md:block text-sm text-foreground font-bold mt-1">
              YOUR LINK COLLECTION
              {syncStatus?.loggedIn && (
                <span className="ml-2 text-xs opacity-75">
                  ({syncStatus.pendingCount} PENDING ·{" "}
                  {syncStatus.lastSyncAt
                    ? new Date(syncStatus.lastSyncAt).toLocaleTimeString()
                    : "NEVER SYNCED"}
                  )
                </span>
              )}
              {fetchProgress.total > 0 && (
                <span className="ml-2 text-xs opacity-75">
                  (FETCHING IMAGES: {fetchProgress.processed}/
                  {fetchProgress.total})
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSyncPanel(true)}
              className="px-3 py-2 sm:px-4 sm:py-2 font-black text-xs sm:text-sm bg-white text-black border-3 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
            >
              {syncStatus?.loggedIn ? "SYNCED" : "SYNC"}
            </button>
            <button
              onClick={() => backfill.mutate()}
              disabled={backfill.isPending}
              className="px-3 py-2 sm:px-4 sm:py-2 font-black text-xs sm:text-sm bg-white text-black border-3 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {backfill.isPending ? "⏳ FETCHING..." : "🖼️ FETCH ALL IMAGES"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 h-full max-w-7xl mx-auto my-4">
        <Breadcrumb path={breadcrumbs} onNavigate={navigateToBreadcrumb} />
        <AddBookmark
          onAdd={handleAddBookmark}
          currentFolderId={currentFolderId}
        />
        <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
        <BookmarkList
          items={filteredBookmarks}
          allTags={tagList}
          onDelete={handleDeleteBookmark}
          onNavigateToFolder={navigateToFolder}
          isSearching={!!searchTerm}
        />
      </div>

      {showSyncPanel && <SyncPanel onClose={() => setShowSyncPanel(false)} />}
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
