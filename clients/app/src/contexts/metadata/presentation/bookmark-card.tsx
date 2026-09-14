import { useState } from "react";
import { Button } from "@design-system/ui/button";
import { Card } from "@design-system/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@design-system/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import { Rating } from "./rating";
import { TagGroup } from "./tag-group";
import { formatDisplayUrl } from "@/shared/format";
import type { MetadataRecordView } from "../domain/metadata";
import type { DeviceInfo } from "@/routers/appRouters";
import {
  useCaptureImage,
  useClearScreenshot,
  useSetNote,
  useSetRating,
  useSetTags,
} from "@/presentation/hooks/useMetadata";

interface BookmarkCardProps {
  item: chrome.bookmarks.BookmarkTreeNode;
  record?: MetadataRecordView;
  allTags: string[];
  devices: DeviceInfo[];
  onDelete: (chromeBookmarkId: string) => void;
  onOpenBookmark: (url: string) => void;
  onViewScreenshot: (screenshot: string) => void;
  onMove: (url: string, target: string) => void;
  formatDate: (timestamp?: Date | null) => string;
}

const recordDefaults = (record?: MetadataRecordView) => ({
  screenshot: record?.imageUrl ?? record?.screenshotUrl,
  rating: record?.rating,
  tags: record?.tags ?? [],
  note: record?.note ?? "",
});

export function BookmarkCard({
  item,
  record,
  allTags,
  devices,
  onDelete,
  onOpenBookmark,
  onViewScreenshot,
  onMove,
  formatDate,
}: BookmarkCardProps) {
  const setNote = useSetNote();
  const setRating = useSetRating();
  const setTags = useSetTags();
  const [isEditing, setIsEditing] = useState(false);
  const { screenshot, rating, tags, note } = recordDefaults(record);
  const pendingNote = setNote.variables?.note;
  const pendingMove = record?.move?.state === "requested" ? record.move : undefined;
  const addedAt = item.dateAdded ? new Date(item.dateAdded) : null;

  return (
    <Card className="relative card-brutal p-3 sm:p-4" style={{ background: "var(--color-white)" }}>
      <div className="flex flex-col h-full gap-2">
        <BookmarkCardMenu
          item={item}
          record={record}
          devices={devices}
          hasScreenshot={!!screenshot}
          onDelete={onDelete}
          onEdit={() => setIsEditing(true)}
          onMove={onMove}
        />
        {pendingMove && (
          <span className="text-xs font-black px-2 py-0.5 border-3 border-black self-start bg-yellow-background">
            ⏳ MOVING TO {deviceLabel(devices, pendingMove.target).toUpperCase()}...
          </span>
        )}
        {isEditing ? (
          <BookmarkEditForm item={item} onDone={() => setIsEditing(false)} />
        ) : (
          <BookmarkIdentity item={item} onOpenBookmark={onOpenBookmark} />
        )}
        <ScreenshotSection screenshot={screenshot} title={item.title} onView={onViewScreenshot} />

        <Rating
          rating={rating}
          setRating={(nextRating) => {
            if (item.url) setRating.mutate({ url: item.url, rating: nextRating });
          }}
        />

        <TagGroup
          tags={tags}
          allTags={allTags}
          onChange={(nextTags) => {
            if (item.url) setTags.mutate({ url: item.url, tags: nextTags });
          }}
          placeholder="Add tags..."
        />

        <Notes
          note={note}
          setNote={(nextNote) => {
            if (item.url) setNote.mutate({ url: item.url, note: nextNote });
          }}
          isPending={setNote.isPending}
          pendingNote={pendingNote}
          isError={setNote.isError}
        />

        <div className="mt-auto text-xs text-gray-600 italic">Added: {formatDate(addedAt)}</div>
      </div>
    </Card>
  );
}

function BookmarkCardMenu({
  item,
  record,
  devices,
  hasScreenshot,
  onDelete,
  onEdit,
  onMove,
}: {
  item: chrome.bookmarks.BookmarkTreeNode;
  record?: MetadataRecordView;
  devices: DeviceInfo[];
  hasScreenshot: boolean;
  onDelete: (chromeBookmarkId: string) => void;
  onEdit: () => void;
  onMove: (url: string, target: string) => void;
}) {
  const captureImage = useCaptureImage();
  const clearScreenshot = useClearScreenshot();
  const otherDevices = devices.filter((device) => !device.isSelf);
  const pendingMove = record?.move?.state === "requested" ? record.move : undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        aria-label="Bookmark actions menu"
        className="absolute top-4 right-4"
      >
        <EllipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          ✏️ EDIT
        </DropdownMenuItem>
        {item.url &&
          (pendingMove ? (
            <DropdownMenuItem disabled>
              {`⏳ MOVING TO ${deviceLabel(devices, pendingMove.target).toUpperCase()}...`}
            </DropdownMenuItem>
          ) : (
            otherDevices.map((device) => {
              const failedMove =
                record?.move?.state === "failed" && record.move.target === device.deviceId;
              return (
                <DropdownMenuItem
                  key={device.deviceId}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMove(item.url!, device.deviceId);
                  }}
                >
                  {failedMove
                    ? `🔁 RETRY MOVE TO ${device.name.toUpperCase()}`
                    : `➡️ MOVE TO ${device.name.toUpperCase()}`}
                </DropdownMenuItem>
              );
            })
          ))}
        {item.url && (
          <DropdownMenuItem
            disabled={captureImage.isPending}
            onClick={(e) => {
              e.stopPropagation();
              captureImage.mutate({ url: item.url! });
            }}
          >
            {captureImage.isPending ? "📷 CAPTURING..." : "📷 SCREENSHOT"}
          </DropdownMenuItem>
        )}
        {hasScreenshot && item.url && (
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              clearScreenshot.mutate({ url: item.url! });
            }}
          >
            🗑️ DEL SCREENSHOT
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          variant="destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.id);
          }}
        >
          ❌ DELETE
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function BookmarkIdentity({
  item,
  onOpenBookmark,
}: {
  item: chrome.bookmarks.BookmarkTreeNode;
  onOpenBookmark: (url: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3
        className="font-black text-sm sm:text-base cursor-pointer hover:underline pr-8 text-balance"
        onClick={() => item.url && onOpenBookmark(item.url)}
        title={item.title || undefined}
      >
        {(item.title || "Untitled").toUpperCase()}
      </h3>
      {item.url && (
        <a
          href={item.url}
          onClick={(e) => {
            e.preventDefault();
            onOpenBookmark(item.url!);
          }}
          className="text-xs font-bold hover:underline block wrap-break-word"
          title={item.url}
          style={{ color: "var(--color-primary)" }}
        >
          {formatDisplayUrl(item.url)}
        </a>
      )}
    </div>
  );
}

function BookmarkEditForm({
  item,
  onDone,
}: {
  item: chrome.bookmarks.BookmarkTreeNode;
  onDone: () => void;
}) {
  const [title, setTitle] = useState(item.title ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setIsSaving(true);
    setError(null);
    try {
      await chrome.bookmarks.update(item.id, {
        title: title.trim(),
        url: withScheme(trimmedUrl),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save bookmark");
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="w-full input-brutal text-sm font-bold px-2 py-1"
        autoFocus
      />
      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://example.com"
        className="w-full input-brutal text-xs font-bold px-2 py-1"
        required
      />
      {error && <p className="text-xs font-bold text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" size="sm" disabled={isSaving}>
          {isSaving ? "SAVING..." : "SAVE"}
        </Button>
        <Button type="button" onClick={onDone} className="flex-1" size="sm" disabled={isSaving}>
          CANCEL
        </Button>
      </div>
    </form>
  );
}

const withScheme = (url: string): string =>
  /^[a-z][a-z\d+.-]*:/iu.test(url) ? url : `https://${url}`;

const deviceLabel = (devices: DeviceInfo[], deviceId: string): string =>
  devices.find((device) => device.deviceId === deviceId)?.name ?? "Other browser";

function ScreenshotSection({
  screenshot,
  title,
  onView,
}: {
  screenshot?: string;
  title: string;
  onView: (screenshot: string) => void;
}) {
  if (!screenshot) return null;

  return (
    <div
      className="w-full border-3 border-black mb-2 sm:mb-3 cursor-pointer hover:opacity-80 transition-opacity"
      onClick={() => onView(screenshot)}
      title="Click to view full screenshot"
    >
      <img src={screenshot} alt={`Screenshot of ${title}`} className="w-full h-auto" />
    </div>
  );
}

type NotesProps = {
  note: string;
  setNote: (note: string) => void;
  isPending: boolean;
  pendingNote: string | undefined;
  isError: boolean;
};

function Notes({ note, setNote, isPending, pendingNote, isError }: NotesProps) {
  const [editingNote, setEditingNote] = useState<boolean>(false);
  const [value, setValue] = useState<string>("");

  const displayNote = isPending && pendingNote !== undefined ? pendingNote : note;

  const handleStartEdit = () => {
    setValue(displayNote);
    setEditingNote(true);
  };

  return (
    <div className="mb-2">
      {editingNote ? (
        <div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Add a note..."
            className="w-full text-xs font-bold border-3 px-2 py-1 min-h-20"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex gap-2 mt-1">
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setEditingNote(false);
                setNote(value);
              }}
              className="flex-1"
              size="sm"
              disabled={isPending}
            >
              {isPending ? "SAVING..." : "SAVE"}
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                setEditingNote(false);
              }}
              className="flex-1"
              variant="default"
              size="sm"
              disabled={isPending}
            >
              CANCEL
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation();
            handleStartEdit();
          }}
          className="cursor-pointer hover:bg-gray-50 border-2 border-dashed border-gray-300 px-2 py-2 min-h-12"
          style={{ opacity: isPending ? 0.6 : 1 }}
        >
          {displayNote ? (
            <p className="text-xs font-bold">
              {displayNote}
              {isPending && " (saving...)"}
            </p>
          ) : (
            <p className="text-xs font-bold text-gray-400">Click to add note...</p>
          )}
          {isError && (
            <p className="text-xs font-bold text-red-600 mt-1">Failed to save. Click to retry.</p>
          )}
        </div>
      )}
    </div>
  );
}
