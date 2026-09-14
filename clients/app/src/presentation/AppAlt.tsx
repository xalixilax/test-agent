import { useCallback, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { BookmarkHeader } from "./components/BookmarkHeader";
import { SyncPanel } from "@/contexts/identity/presentation/SyncPanel";
import {
  useBackfillImages,
  useDevices,
  useMetadataEvents,
  useMoveBookmark,
  useRecordsByUrl,
} from "./hooks/useMetadata";
import { useFetchProgress, useSyncStatus } from "./hooks/useSync";
import { useAllChromeBookmarks, useChromeBookmarksTree } from "./hooks/useChromeBookmarks";
import { useFolderNavigation } from "./hooks/useFolderNavigation";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import { filterBookmarks } from "./lib/filterBookmarks";
import { filterRemoteBookmarks, remoteBookmarkItems } from "./lib/remoteBookmarks";

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

  const { byUrl, data: records } = useRecordsByUrl();
  const { data: devices } = useDevices();
  const { data: syncStatus } = useSyncStatus();
  const backfill = useBackfillImages();
  const moveBookmark = useMoveBookmark();
  const fetchProgress = useFetchProgress();
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  useMetadataEvents();

  const chromeBookmarkQuery = useChromeBookmarksTree(currentFolderId);
  const allBookmarksQuery = useAllChromeBookmarks();
  const allBookmarks = allBookmarksQuery.data ?? [];
  const deviceList = devices ?? [];
  const selfDeviceId = deviceList.find((device) => device.isSelf)?.deviceId;

  const tagList = useMemo(
    () => [...new Set([...byUrl.values()].flatMap((record) => record.tags))].sort(),
    [byUrl],
  );

  const localUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const node of allBookmarks) {
      if (node.url) urls.add(normalizeUrl(node.url));
    }
    return urls;
  }, [allBookmarks]);

  const remoteItems = useMemo(() => {
    if (!selfDeviceId) return [];
    const deviceNames = new Map(deviceList.map((device) => [device.deviceId, device.name]));
    return remoteBookmarkItems(records ?? [], localUrls, selfDeviceId, deviceNames);
  }, [records, localUrls, selfDeviceId, deviceList]);

  const searching = searchTerm.trim() !== "";

  const filteredBookmarks = useMemo(
    () =>
      searching
        ? filterBookmarks(allBookmarks, searchTerm, byUrl)
        : filterBookmarks(chromeBookmarkQuery.data ?? [], "", byUrl),
    [searching, allBookmarks, chromeBookmarkQuery.data, searchTerm, byUrl],
  );

  const visibleRemoteItems = useMemo(() => {
    if (searching) return filterRemoteBookmarks(remoteItems, searchTerm);
    return currentFolderId === null ? remoteItems : [];
  }, [searching, remoteItems, searchTerm, currentFolderId]);

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

  const handleMoveBookmark = useCallback(
    (url: string, target: string) => {
      moveBookmark.mutate({ url, target });
    },
    [moveBookmark],
  );

  const handleMoveHere = useCallback(
    (url: string) => {
      if (selfDeviceId) handleMoveBookmark(url, selfDeviceId);
    },
    [handleMoveBookmark, selfDeviceId],
  );

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
          remoteItems={visibleRemoteItems}
          allTags={tagList}
          devices={deviceList}
          onDelete={handleDeleteBookmark}
          onNavigateToFolder={navigateToFolder}
          onMove={handleMoveBookmark}
          onMoveHere={handleMoveHere}
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
