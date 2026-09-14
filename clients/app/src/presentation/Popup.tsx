import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SearchBar from "./components/SearchBar";
import { Button } from "@design-system/ui/button";
import { formatDisplayUrl } from "@/shared/format";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import { useDevices, useMetadataEvents, useRecordsByUrl } from "./hooks/useMetadata";
import { openBookmark, openFullScreen } from "./lib/openBookmark";
import { filterRemoteBookmarks, remoteBookmarkItems } from "./lib/remoteBookmarks";

const queryClient = new QueryClient();

function PopupContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const { byUrl, data: records } = useRecordsByUrl();
  const { data: devices } = useDevices();
  useMetadataEvents();
  const [allBookmarks, setAllBookmarks] = useState<chrome.bookmarks.BookmarkTreeNode[]>([]);

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.bookmarks) return;

    chrome.bookmarks.getTree().then((tree) => {
      const flatten = (
        nodes: chrome.bookmarks.BookmarkTreeNode[],
      ): chrome.bookmarks.BookmarkTreeNode[] => {
        const result: chrome.bookmarks.BookmarkTreeNode[] = [];
        for (const node of nodes) {
          if (node.children) {
            result.push(...flatten(node.children));
          } else if (node.url) {
            result.push(node);
          }
        }
        return result;
      };
      setAllBookmarks(flatten(tree));
    });
  }, []);

  const results = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    return allBookmarks
      .map((bookmark) => ({
        bookmark,
        record: bookmark.url ? byUrl.get(normalizeUrl(bookmark.url)) : undefined,
      }))
      .filter(
        ({ bookmark, record }) =>
          bookmark.title?.toLowerCase().includes(term) ||
          bookmark.url?.toLowerCase().includes(term) ||
          record?.note?.toLowerCase().includes(term) ||
          record?.tags.some((tag) => tag.toLowerCase().includes(term)),
      )
      .slice(0, 10);
  }, [allBookmarks, byUrl, searchTerm]);

  const deviceList = useMemo(() => devices ?? [], [devices]);
  const selfDeviceId = deviceList.find((device) => device.isSelf)?.deviceId;

  const remoteResults = useMemo(() => {
    if (!searchTerm || !selfDeviceId) return [];
    const localUrls = new Set(
      allBookmarks.flatMap((bookmark) => (bookmark.url ? [normalizeUrl(bookmark.url)] : [])),
    );
    const deviceNames = new Map(deviceList.map((device) => [device.deviceId, device.name]));
    const items = remoteBookmarkItems(records ?? [], localUrls, selfDeviceId, deviceNames);
    return filterRemoteBookmarks(items, searchTerm).slice(0, 10);
  }, [searchTerm, selfDeviceId, allBookmarks, records, deviceList]);

  const handleOpenBookmark = (url: string) => {
    openBookmark(url);
  };

  return (
    <div className="w-full h-full p-3" style={{ background: "var(--color-bg)", minWidth: "320px" }}>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <SearchBar searchTerm={searchTerm} onSearch={setSearchTerm} />
          </div>
          <Button onClick={openFullScreen} title="Open full view">
            OPEN
          </Button>
        </div>

        {searchTerm && (
          <div className="max-h-96 overflow-y-auto space-y-2">
            {results.length === 0 && remoteResults.length === 0 ? (
              <div className="text-center py-8 text-sm font-bold">NO RESULTS</div>
            ) : (
              <>
                {results.map(({ bookmark, record }) => (
                  <Button
                    key={bookmark.id}
                    onClick={() => bookmark.url && handleOpenBookmark(bookmark.url)}
                    className="w-full"
                  >
                    <div className="w-full">
                      <div className="font-bold text-sm truncate">{bookmark.title}</div>
                      {bookmark.url && (
                        <div className="text-xs text-gray-600 truncate mt-0.5">
                          {formatDisplayUrl(bookmark.url)}
                        </div>
                      )}
                      {record && record.tags.length > 0 && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {record.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1 border border-black bg-gray-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
                {remoteResults.map((item) => (
                  <Button
                    key={item.record.uuid}
                    onClick={() => handleOpenBookmark(item.url)}
                    className="w-full"
                  >
                    <div className="w-full">
                      <div className="text-xs font-black">
                        IN {item.holderNames.join(", ").toUpperCase()}
                      </div>
                      <div className="font-bold text-sm truncate">{item.title}</div>
                      <div className="text-xs text-gray-600 truncate mt-0.5">
                        {formatDisplayUrl(item.url)}
                      </div>
                    </div>
                  </Button>
                ))}
              </>
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
