import { useEffect } from "react";
import BookmarkList from "./components/BookmarkList";
import SearchBar from "./components/SearchBar";
import AddBookmark from "./components/AddBookmark";
import Breadcrumb from "./components/Breadcrumb";
import { openFullScreen } from "./hooks/useExtension";
import { useBookmarks } from "./hooks/useBookmarks";
import { useScreenshots } from "./hooks/useScreenshots";
import { useCurrentTab } from "./hooks/useCurrentTab";
import { useBookmarkNavigation } from "./hooks/useBookmarkNavigation";

function App() {
  const {
    bookmarks,
    loading,
    loadBookmarks,
    addBookmark,
    deleteBookmark,
    moveBookmark,
  } = useBookmarks();
  const { screenshots, loadScreenshots, captureScreenshot, deleteScreenshot } =
    useScreenshots();
  const { currentTab, checkCurrentTab } = useCurrentTab();
  const {
    currentFolderId,
    breadcrumbPath,
    searchTerm,
    filteredBookmarks,
    navigateToFolder,
    setSearchTerm,
  } = useBookmarkNavigation({ bookmarks, screenshots });

  useEffect(() => {
    loadBookmarks();
    loadScreenshots();
    checkCurrentTab();
  }, [loadBookmarks, loadScreenshots, checkCurrentTab]);

  // Auto-capture screenshot if bookmarked and no screenshot exists
  useEffect(() => {
    if (
      currentTab?.isBookmarked &&
      currentTab.bookmark &&
      !currentTab.bookmark.hasScreenshot
    ) {
      captureScreenshot(currentTab.bookmark.id, currentTab.bookmark.url);
    }
  }, [currentTab, captureScreenshot]);

  const handleAddBookmark = (title: string, url: string) => {
    addBookmark(title, url, currentFolderId);
  };

  const handleDeleteBookmark = (id: string) => {
    // Find the item in the current folder to check if it's a folder or bookmark
    const currentItems = filteredBookmarks;
    const item = currentItems.find((i) => i.id === id);
    const isFolder = item && !item.url && Array.isArray(item.children);
    deleteBookmark(id, isFolder || false);
  };

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

        {/* Current tab status indicator */}
        {currentTab && currentTab.isBookmarked && currentTab.bookmark && (
          <div
            className="mx-2 sm:mx-4 md:mx-6 mt-3 sm:mt-4 p-3 sm:p-4 border-3 border-black shadow-brutal"
            style={{ background: "var(--color-success)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <span className="text-xl sm:text-2xl shrink-0">⭐</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-xs sm:text-sm">
                    CURRENT PAGE IS BOOKMARKED!
                  </p>
                  <p
                    className="font-bold text-xs mt-1 truncate"
                    title={currentTab.bookmark.title}
                  >
                    {currentTab.bookmark.title}
                  </p>
                </div>
              </div>
              {!currentTab.bookmark.hasScreenshot && (
                <button
                  onClick={() =>
                    captureScreenshot(
                      currentTab.bookmark!.id,
                      currentTab.bookmark!.url
                    )
                  }
                  className="btn-brutal px-2 sm:px-3 py-1 sm:py-2 text-xs font-black bg-white shrink-0"
                  title="Capture screenshot for this page"
                >
                  📷 CAPTURE
                </button>
              )}
            </div>
          </div>
        )}

        <div className="p-2 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
          <AddBookmark onAdd={handleAddBookmark} />
          <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
          {!searchTerm && (
            <Breadcrumb path={breadcrumbPath} onNavigate={navigateToFolder} />
          )}
          <BookmarkList
            items={filteredBookmarks}
            onDelete={handleDeleteBookmark}
            onCaptureScreenshot={captureScreenshot}
            onDeleteScreenshot={deleteScreenshot}
            onFolderClick={navigateToFolder}
            onMove={moveBookmark}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
