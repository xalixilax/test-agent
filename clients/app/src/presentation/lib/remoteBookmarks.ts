import type { MetadataRecordView, MoveIntent } from "@/contexts/metadata/domain/metadata";
import { normalizeUrl } from "@/contexts/metadata/domain/url";
import { formatDisplayUrl } from "@/shared/format";

export interface RemoteBookmarkItem {
  url: string;
  title: string;
  holderNames: string[];
  record: MetadataRecordView;
  move?: MoveIntent;
}

export const remoteBookmarkItems = (
  records: MetadataRecordView[],
  localUrls: Set<string>,
  selfDeviceId: string,
  deviceNames: Map<string, string>,
): RemoteBookmarkItem[] =>
  records
    .filter((record) => !localUrls.has(normalizeUrl(record.url)))
    .filter((record) => record.holders.some((deviceId) => deviceId !== selfDeviceId))
    .map((record) => ({
      url: record.url,
      title: record.title?.trim() || formatDisplayUrl(record.url),
      holderNames: record.holders
        .filter((deviceId) => deviceId !== selfDeviceId)
        .map((deviceId) => deviceNames.get(deviceId) ?? "Other browser"),
      record,
      move: record.move,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

export const filterRemoteBookmarks = (
  items: RemoteBookmarkItem[],
  searchTerm: string,
): RemoteBookmarkItem[] => {
  const term = searchTerm.trim().toLowerCase();
  if (term === "") return items;
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(term) ||
      item.url.toLowerCase().includes(term) ||
      (item.record.note?.toLowerCase().includes(term) ?? false) ||
      item.record.tags.some((tag) => tag.toLowerCase().includes(term)),
  );
};
