import { useState } from "react";
import type { BookmarkWithTags } from "../types";
import { Button } from "@design-system/ui/button";
import { Folder } from "./folder";
import { BookmarkCard } from "./bookmark-card";

interface BookmarkListProps {
  items: BookmarkWithTags[];
  onDelete: (chromeBookmarkId: string) => void;
  onCaptureScreenshot: (chromeBookmarkId: string, url: string) => void;
  onDeleteScreenshot: (chromeBookmarkId: string) => void;
  onNavigateToFolder: (chromeBookmarkId: string, folderTitle: string) => void;
  isSearching: boolean;
}

function BookmarkList({
  items,
  onDelete,
  onCaptureScreenshot,
  onDeleteScreenshot,
  onNavigateToFolder,
  isSearching,
}: BookmarkListProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(
    null
  );

  const handleOpenBookmark = (url: string) => {
    if (typeof chrome !== "undefined" && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, "_blank");
    }
  };

  const formatDate = (timestamp?: Date | null) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleDateString();
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">📭</div>
        <p className="text-xl font-black">NO BOOKMARKS</p>
        <p className="text-sm font-bold mt-2">ADD SOME LINKS!</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => {
          const isFolder = item.isFolder === 1;

          // Folder card
          if (isFolder) {
            return (
              <Folder
                key={item.chromeBookmarkId}
                item={item}
                onNavigateToFolder={onNavigateToFolder}
                onDelete={onDelete}
              />
            );
          }

          // Regular bookmark card
          return (
            <BookmarkCard
              key={item.chromeBookmarkId}
              item={item}
              onDelete={onDelete}
              onCaptureScreenshot={onCaptureScreenshot}
              onDeleteScreenshot={onDeleteScreenshot}
              onOpenBookmark={handleOpenBookmark}
              onViewScreenshot={setSelectedScreenshot}
              formatDate={formatDate}
            />
          );
        })}
      </div>

      {/* Screenshot preview modal */}
      {selectedScreenshot && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(0, 0, 0, 0.9)" }}
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-6xl max-h-full relative">
            <img
              src={selectedScreenshot}
              alt="Screenshot preview"
              className="max-w-full max-h-full border-4 border-white"
              onClick={(e) => e.stopPropagation()}
            />
            <Button
              className="absolute -top-12 right-0 font-black"
              variant="default"
              onClick={() => setSelectedScreenshot(null)}
            >
              CLOSE
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

export default BookmarkList;
