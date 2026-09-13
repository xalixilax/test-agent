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
  onDelete: (chromeBookmarkId: string) => void;
  onOpenBookmark: (url: string) => void;
  onViewScreenshot: (screenshot: string) => void;
  formatDate: (timestamp?: Date | null) => string;
}

export function BookmarkCard({
  item,
  record,
  allTags,
  onDelete,
  onOpenBookmark,
  onViewScreenshot,
  formatDate,
}: BookmarkCardProps) {
  const setNote = useSetNote();
  const setRating = useSetRating();
  const setTags = useSetTags();
  const captureImage = useCaptureImage();
  const clearScreenshot = useClearScreenshot();

  const screenshot = record?.imageUrl ?? record?.screenshotUrl;

  const handleSaveNote = (note: string) => {
    if (!item.url) return;
    setNote.mutate({ url: item.url, note });
  };

  const handleUpdateRating = (rating: number) => {
    if (!item.url) return;
    setRating.mutate({ url: item.url, rating });
  };

  const handleTagsChange = (tags: string[]) => {
    if (!item.url) return;
    setTags.mutate({ url: item.url, tags });
  };

  return (
    <Card
      className="relative card-brutal p-3 sm:p-4"
      style={{ background: "var(--color-white)" }}
    >
      <div className="flex flex-col h-full gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            aria-label="Bookmark actions menu"
            className="absolute top-4 right-4"
          >
            <EllipsisVertical />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {item.url && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  captureImage.mutate({ url: item.url! });
                }}
              >
                📷 SCREENSHOT
              </DropdownMenuItem>
            )}
            {screenshot && item.url && (
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

        {screenshot && (
          <div
            className="w-full h-20 sm:h-24 border-3 border-black mb-2 sm:mb-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onViewScreenshot(screenshot)}
            title="Click to view full screenshot"
          >
            <img
              src={screenshot}
              alt={`Screenshot of ${item.title}`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <Rating
          rating={record?.rating ?? undefined}
          setRating={handleUpdateRating}
        />

        <TagGroup
          tags={record?.tags ?? []}
          allTags={allTags}
          onChange={handleTagsChange}
          placeholder="Add tags..."
        />

        <Notes
          note={record?.note ?? ""}
          setNote={handleSaveNote}
          isPending={setNote.isPending}
          pendingNote={setNote.variables?.note ?? undefined}
          isError={setNote.isError}
        />

        <div className="mt-auto text-xs text-gray-600 italic">
          Added: {formatDate(item.dateAdded ? new Date(item.dateAdded) : null)}
        </div>
      </div>
    </Card>
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

  const displayNote =
    isPending && pendingNote !== undefined ? pendingNote : note;

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
            <p className="text-xs font-bold text-gray-400">
              Click to add note...
            </p>
          )}
          {isError && (
            <p className="text-xs font-bold text-red-600 mt-1">
              Failed to save. Click to retry.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
