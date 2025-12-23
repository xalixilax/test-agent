import { useState, useEffect } from "react";
import type { BookmarkWithTags } from "../types";
import { useBookmarkById, useUpdateBookmark } from "../db/useBookmark";
import { useTags, useAddTag } from "../db/useTag";
import { useAddBookmarkTag, useDeleteBookmarkTag } from "../db/useBookmarkTag";
import { Button } from "@design-system/ui/button";
import { Card } from "@design-system/ui/card";
import { EllipsisVertical } from "lucide-react";
import { Rating } from "./rating";
import { TagGroup } from "./tag-group";
import { formatDisplayUrl } from "../lib/utils";

interface BookmarkCardProps {
  item: chrome.bookmarks.BookmarkTreeNode;
  onDelete: (chromeBookmarkId: string) => void;
  onCaptureScreenshot: (chromeBookmarkId: string, url: string) => void;
  onDeleteScreenshot: (chromeBookmarkId: string) => void;
  onOpenBookmark: (url: string) => void;
  onViewScreenshot: (screenshot: string) => void;
  formatDate: (timestamp?: Date | null) => string;
}

export function BookmarkCard({
  item,
  onDelete,
  onCaptureScreenshot,
  onDeleteScreenshot,
  onOpenBookmark,
  onViewScreenshot,
  formatDate,
}: BookmarkCardProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const updateNoteMutation = useUpdateBookmark();
  const updateRatingMutation = useUpdateBookmark();
  const addTagMutation = useAddTag();
  const addBookmarkTagMutation = useAddBookmarkTag();
  const deleteBookmarkTagMutation = useDeleteBookmarkTag();
  const { data } = useBookmarkById(item.id ?? "");

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId]);

  const handleSaveNote = (note: string) => {
    updateNoteMutation.mutate({
      chromeBookmarkId: item.id,
      note,
    });
  };

  const handleUpdateRating = (rating: number) => {
    console.log("Updating rating to:", rating);
    updateRatingMutation.mutate({
      chromeBookmarkId: item.id,
      rating,
    });
  };

  const handleTagAdd = (tagId: number) => {
    addBookmarkTagMutation.mutate({ bookmarkId: item.id, tagId });
  };

  const handleTagRemove = (tagId: number) => {
    deleteBookmarkTagMutation.mutate({
      bookmarkId: item.id,
      tagId,
    });
  };

  const handleNewTagCreate = (tagName: string) => {
    addTagMutation.mutate(
      { name: tagName },
      {
        onSuccess: (newTag: any) => {
          addBookmarkTagMutation.mutate({
            bookmarkId: item.id,
            tagId: newTag.id,
          });
        },
      }
    );
  };

  return (
    <Card
      className="relative card-brutal p-3 sm:p-4"
      style={{ background: "var(--color-white)" }}
    >
      <div className="flex flex-col h-full gap-2">
        {/* Kebab menu */}
        <div className="absolute top-2 right-2">
          <Button
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(openMenuId === item.id ? null : item.id);
            }}
            className="flex-col gap-1"
            variant="default"
            size="icon"
            aria-label="Bookmark actions menu"
            aria-expanded={openMenuId === item.id}
            aria-haspopup="true"
          >
            <EllipsisVertical />
          </Button>

          {openMenuId === item.id && (
            <div
              className="absolute right-0 mt-1 w-40 border-3 border-black z-10 shadow-brutal"
              style={{ background: "var(--color-white)" }}
              role="menu"
              aria-label="Bookmark actions"
            >
              {item.url && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCaptureScreenshot(item.id, item.url!);
                    setOpenMenuId(null);
                  }}
                  className="w-full justify-start gap-2 border-b-2 rounded-none"
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                >
                  📷 SCREENSHOT
                </Button>
              )}
              {item.screenshot && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteScreenshot(item.id);
                    setOpenMenuId(null);
                  }}
                  className="w-full justify-start gap-2 border-b-2 rounded-none"
                  variant="ghost"
                  size="sm"
                  role="menuitem"
                >
                  🗑️ DEL SCREENSHOT
                </Button>
              )}
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                  setOpenMenuId(null);
                }}
                className="w-full justify-start gap-2 hover:bg-red-100 rounded-none"
                style={{ color: "var(--color-danger)" }}
                variant="ghost"
                size="sm"
                role="menuitem"
              >
                ❌ DELETE
              </Button>
            </div>
          )}
        </div>

        {/* Screenshot */}
        {item.screenshot && (
          <div
            className="w-full h-20 sm:h-24 border-3 border-black mb-2 sm:mb-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onViewScreenshot(item.screenshot!)}
            title="Click to view full screenshot"
          >
            <img
              src={item.screenshot}
              alt={`Screenshot of ${item.title}`}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Title */}
        <h3
          className="font-black text-sm sm:text-base mb-1 cursor-pointer hover:underline pr-8"
          onClick={() => item.url && onOpenBookmark(item.url)}
          title={item.title || undefined}
        >
          {(item.title || "Untitled").toUpperCase()}
        </h3>

        {/* URL */}
        {item.url && (
          <a
            href={item.url}
            onClick={(e) => {
              e.preventDefault();
              onOpenBookmark(item.url!);
            }}
            className="text-xs font-bold hover:underline block mb-2 wrap-break-word"
            title={item.url}
            style={{ color: "var(--color-primary)" }}
          >
            {formatDisplayUrl(item.url)}
          </a>
        )}

        <Rating
          rating={data?.rating ?? undefined}
          setRating={handleUpdateRating}
        />

        <TagGroup
          tags={data?.tags || []}
          onTagAdd={handleTagAdd}
          onTagRemove={handleTagRemove}
          onNewTagCreate={handleNewTagCreate}
          placeholder="Add tags..."
        />

        <Notes
          note={data?.note || ""}
          setNote={handleSaveNote}
          isPending={updateNoteMutation.isPending}
          pendingNote={updateNoteMutation.variables?.note ?? undefined}
          isError={updateNoteMutation.isError}
        />

        {/* Display date */}
        <div className="mt-auto text-xs text-gray-600 italic">
          Added: {formatDate(item.dateAdded)}
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

  // Display optimistic value while mutation is pending
  const displayNote =
    isPending && pendingNote !== undefined ? pendingNote : note;

  const handleStartEdit = () => {
    setValue(displayNote); // Initialize with current value when entering edit mode
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
