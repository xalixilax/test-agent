import { useCallback, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { BookmarkHeader } from "./components/BookmarkHeader";
import { SyncPanel } from "@/contexts/identity/presentation/SyncPanel";
import { useBackfillImages, useMetadataEvents, useRecordsByUrl } from "./hooks/useMetadata";
import { useFetchProgress, useSyncStatus } from "./hooks/useSync";
import { useChromeBookmarksTree } from "./hooks/useChromeBookmarks";
import { useFolderNavigation } from "./hooks/useFolderNavigation";
import { filterBookmarks } from "./lib/filterBookmarks";

const queryClient = new QueryClient();

function BookmarkManager() {
  const {
    currentFolderId,
    breadcrumbs,
    searchTerm,
    setSearchTerm,
    navigateToFolder,
    navigateToBreadcrumb,
  } = useFolderNavigation();

  const { byUrl } = useRecordsByUrl();
  const { data: syncStatus } = useSyncStatus();
  const backfill = useBackfillImages();
  const fetchProgress = useFetchProgress();
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  useMetadataEvents();

  const chromeBookmarkQuery = useChromeBookmarksTree(currentFolderId);

  const tagList = useMemo(
    () => [...new Set([...byUrl.values()].flatMap((record) => record.tags))].sort(),
    [byUrl],
  );

  const filteredBookmarks = useMemo(
    () => filterBookmarks(chromeBookmarkQuery.data ?? [], searchTerm, byUrl),
    [chromeBookmarkQuery.data, searchTerm, byUrl],
  );

  const handleAddBookmark = useCallback(
    (title: string, url: string, isFolder: boolean) => {
      const parentId = currentFolderId ?? "1";
      const details = isFolder ? { parentId, title } : { parentId, title, url };
      chrome.bookmarks.create(details).catch((error: unknown) => {
        console.error("Failed to create bookmark:", error);
      });
    },
    [currentFolderId],
  );

  const handleDeleteBookmark = useCallback((id: string) => {
    chrome.bookmarks.remove(id).catch((error: unknown) => {
      console.error("Failed to delete bookmark:", error);
    });
  }, []);

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
      <BookmarkHeader
        status={syncStatus}
        fetchProgress={fetchProgress}
        isBackfilling={backfill.isPending}
        onOpenSync={() => setShowSyncPanel(true)}
        onBackfill={() => backfill.mutate()}
      />

      <div className="flex flex-col gap-4 h-full max-w-7xl mx-auto my-4">
        <Breadcrumb path={breadcrumbs} onNavigate={navigateToBreadcrumb} />
        <AddBookmark onAdd={handleAddBookmark} />
        <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
        <BookmarkList
          items={filteredBookmarks}
          allTags={tagList}
          onDelete={handleDeleteBookmark}
          onNavigateToFolder={navigateToFolder}
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
