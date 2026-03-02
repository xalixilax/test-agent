import { useState, useEffect } from "react";
import SearchBar from "./components/SearchBar";
import { openFullScreen } from "./hooks/useExtension";
import { useBookmarksWithTags } from "./db/useBookmark";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Button } from "@design-system/ui/button";
import { formatDisplayUrl } from "./lib/utils";
import type { BookmarkWithTags } from "./types";

const queryClient = new QueryClient();

// Extended bookmark type for popup with Chrome data
type PopupBookmark = BookmarkWithTags & {
  title?: string;
  url?: string;
};

function PopupContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: dbBookmarks = [] } = useBookmarksWithTags();
  const [allBookmarks, setAllBookmarks] = useState<PopupBookmark[]>([]);

  // Fetch Chrome bookmarks and merge with DB data
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.bookmarks) {
      chrome.bookmarks.getTree().then((tree) => {
        // Flatten Chrome bookmark tree
        const flattenBookmarks = (
          nodes: chrome.bookmarks.BookmarkTreeNode[]
        ): chrome.bookmarks.BookmarkTreeNode[] => {
          let result: chrome.bookmarks.BookmarkTreeNode[] = [];
          for (const node of nodes) {
            if (node.children) {
              result = result.concat(flattenBookmarks(node.children));
            } else if (node.url) {
              result.push(node);
            }
          }
          return result;
        };

        const flatChromeBookmarks = flattenBookmarks(tree);

        // Merge with DB data
        const merged: PopupBookmark[] = flatChromeBookmarks.map(
          (chromeBookmark) => {
            const dbData = dbBookmarks.find(
              (db) => db.chromeBookmarkId === chromeBookmark.id
            );
            return {
              chromeBookmarkId: chromeBookmark.id,
              title: chromeBookmark.title,
              url: chromeBookmark.url,
              note: dbData?.note || null,
              rating: dbData?.rating || null,
              screenshot: dbData?.screenshot || null,
              tags: dbData?.tags || [],
            };
          }
        );

        setAllBookmarks(merged);
      });
    }
  }, [dbBookmarks]);

  const filteredBookmarks = searchTerm
    ? allBookmarks.filter(
        (bookmark) =>
          bookmark.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.url?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          bookmark.tags?.some((tag) =>
            tag.name.toLowerCase().includes(searchTerm.toLowerCase())
          )
      )
    : [];

  const handleOpenBookmark = (url: string) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div
      className="w-full h-full p-3"
      style={{ background: "var(--color-bg)", minWidth: "320px" }}
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar
              searchTerm={searchTerm}
              onSearch={setSearchTerm}
              compact
            />
          </div>
          <Button onClick={openFullScreen} title="Open full view">
            asdasd
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
          </Button>
        </div>

        {searchTerm && (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredBookmarks.length === 0 ? (
              <div className="text-center py-8 text-sm font-bold">
                NO RESULTS
              </div>
            ) : (
              filteredBookmarks.slice(0, 10).map((bookmark) => (
                <Button
                  key={bookmark.chromeBookmarkId}
                  onClick={() =>
                    bookmark.url && handleOpenBookmark(bookmark.url)
                  }
                  className="w-full"
                >
                  <div className="w-full">
                    <div className="font-bold text-sm truncate">
                      {bookmark.title}
                    </div>
                    {bookmark.url && (
                      <div className="text-xs text-gray-600 truncate mt-0.5">
                        {formatDisplayUrl(bookmark.url)}
                      </div>
                    )}
                    {bookmark.tags && bookmark.tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {bookmark.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="text-xs px-1 border border-black bg-gray-100"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Popup() {
  return (
    <QueryClientProvider client={queryClient}>
      <PopupContent />
    </QueryClientProvider>
  );
}

export default Popup;
