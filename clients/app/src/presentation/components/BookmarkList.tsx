import { useState } from "react";
import { Button } from "@design-system/ui/button";
import { Folder } from "./folder";
import { BookmarkCard } from "@/contexts/metadata/presentation/bookmark-card";
import { RemoteBookmarkCard } from "@/contexts/metadata/presentation/remote-bookmark-card";
import type { DeviceInfo } from "@/routers/appRouters";
import { openBookmark } from "../lib/openBookmark";
import type { RemoteBookmarkItem } from "../lib/remoteBookmarks";
import type { BookmarkItem } from "../types";

interface BookmarkListProps {
  items: BookmarkItem[];
  remoteItems: RemoteBookmarkItem[];
  allTags: string[];
  devices: DeviceInfo[];
  onDelete: (chromeBookmarkId: string) => void;
  onNavigateToFolder: (chromeBookmarkId: string, folderTitle: string) => void;
  onMove: (url: string, target: string) => void;
  onMoveHere: (url: string) => void;
}

function BookmarkList({
  items,
  remoteItems,
  allTags,
  devices,
  onDelete,
  onNavigateToFolder,
  onMove,
  onMoveHere,
}: BookmarkListProps) {
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);

  const handleOpenBookmark = (url: string) => {
    openBookmark(url);
  };

  const formatDate = (timestamp?: Date | null) => {
    if (!timestamp) return "Unknown";
    return new Date(timestamp).toLocaleDateString();
  };

  if (items.length === 0 && remoteItems.length === 0) {
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
          const isFolder = item.children !== undefined;

          if (isFolder) {
            return (
              <Folder
                key={item.id}
                item={item}
                onNavigateToFolder={onNavigateToFolder}
                onDelete={onDelete}
              />
            );
          }

          return (
            <BookmarkCard
              key={item.id}
              item={item}
              record={item.record}
              allTags={allTags}
              devices={devices}
              onDelete={onDelete}
              onOpenBookmark={handleOpenBookmark}
              onViewScreenshot={setSelectedScreenshot}
              onMove={onMove}
              formatDate={formatDate}
            />
          );
        })}
      </div>

      {remoteItems.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-black border-b-4 border-black pb-1">FROM OTHER BROWSERS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3">
            {remoteItems.map((item) => (
              <RemoteBookmarkCard
                key={item.record.uuid}
                item={item}
                onOpenBookmark={handleOpenBookmark}
                onMoveHere={onMoveHere}
                onViewScreenshot={setSelectedScreenshot}
              />
            ))}
          </div>
        </section>
      )}

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
