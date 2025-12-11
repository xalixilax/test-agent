import { useState, useEffect } from "react";
import type { BookmarkWithTags } from "../types";
import { useUpdateBookmark } from "../db/useBookmark";
import { useTags, useAddTag } from "../db/useTag";
import { useAddBookmarkTag, useDeleteBookmarkTag } from "../db/useBookmarkTag";

interface BookmarkListProps {
  items: BookmarkWithTags[];
  onDelete: (id: number) => void;
  onCaptureScreenshot: (id: number, url: string) => void;
  onDeleteScreenshot: (id: number) => void;
  onNavigateToFolder: (folderId: number, folderTitle: string) => void;
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
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [editingRatingId, setEditingRatingId] = useState<number | null>(null);
  const [selectedTag, setSelectedTag] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");

  const updateBookmarkMutation = useUpdateBookmark();
  const { data: allTags = [] } = useTags();
  const addTagMutation = useAddTag();
  const addBookmarkTagMutation = useAddBookmarkTag();
  const deleteBookmarkTagMutation = useDeleteBookmarkTag();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [openMenuId]);

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

  const handleSaveNote = (id: number) => {
    updateBookmarkMutation.mutate({ id, note: noteText });
    setEditingNoteId(null);
    setNoteText("");
  };

  const handleUpdateRating = (id: number, rating: number) => {
    updateBookmarkMutation.mutate({ id, rating });
    setEditingRatingId(null);
  };

  const handleAddTag = (bookmarkId: number) => {
    if (selectedTag) {
      addBookmarkTagMutation.mutate({ bookmarkId, tagId: selectedTag });
      setSelectedTag(null);
    }
  };

  const handleCreateAndAddTag = (bookmarkId: number) => {
    if (newTagName.trim()) {
      addTagMutation.mutate(
        { name: newTagName.trim() },
        {
          onSuccess: (newTag: any) => {
            addBookmarkTagMutation.mutate({ bookmarkId, tagId: newTag.id });
            setNewTagName("");
          },
        }
      );
    }
  };

  const handleRemoveTag = (bookmarkId: number, tagId: number) => {
    deleteBookmarkTagMutation.mutate({ bookmarkId, tagId });
  };

  const renderStars = (
    rating: number | null,
    bookmarkId: number,
    isEditing: boolean
  ) => {
    const currentRating = rating || 0;
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={(e) => {
              e.stopPropagation();
              if (!isEditing) {
                setEditingRatingId(bookmarkId);
              } else {
                handleUpdateRating(bookmarkId, star);
              }
            }}
            className="text-lg hover:scale-110 transition-transform"
            title={`${star} star${star > 1 ? "s" : ""}`}
          >
            {star <= currentRating ? "⭐" : "☆"}
          </button>
        ))}
        {isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditingRatingId(null);
            }}
            className="ml-2 text-xs font-bold px-2 py-1 border-2 border-black"
            style={{ background: "var(--color-white)" }}
          >
            CANCEL
          </button>
        )}
      </div>
    );
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
      {/* Responsive grid: 1 col on mobile, 2 on tablet, 3 on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {items.map((item) => {
          const isEditingNote = editingNoteId === item.id;
          const isEditingRating = editingRatingId === item.id;
          const isFolder = item.isFolder === 1;

          // Folder card
          if (isFolder) {
            return (
              <div
                key={item.id}
                className="relative card-brutal p-3 sm:p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ background: "var(--color-secondary)" }}
                onClick={() => onNavigateToFolder(item.id, item.title)}
              >
                <div className="flex flex-col h-full items-center justify-center py-8">
                  <div className="text-6xl mb-3">📁</div>
                  <h3 className="font-black text-base sm:text-lg text-center">
                    {item.title.toUpperCase()}
                  </h3>
                </div>

                {/* Delete button */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item.id);
                    }}
                    className="w-8 h-8 flex items-center justify-center hover:bg-red-100 border-2 border-black"
                    style={{
                      background: "var(--color-white)",
                      color: "var(--color-danger)",
                    }}
                    aria-label="Delete folder"
                  >
                    ❌
                  </button>
                </div>
              </div>
            );
          }

          // Regular bookmark card
          return (
            <div
              key={item.id}
              className="relative card-brutal p-3 sm:p-4"
              style={{ background: "var(--color-white)" }}
            >
              {/* Bookmark Card */}
              <div className="flex flex-col h-full">
                {/* Kebab menu */}
                <div className="absolute top-2 right-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === item.id ? null : item.id);
                    }}
                    className="w-8 h-8 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 border-2 border-black"
                    style={{ background: "var(--color-white)" }}
                    aria-label="Bookmark actions menu"
                    aria-expanded={openMenuId === item.id}
                    aria-haspopup="true"
                  >
                    <div className="w-1 h-1 bg-black rounded-full"></div>
                    <div className="w-1 h-1 bg-black rounded-full"></div>
                    <div className="w-1 h-1 bg-black rounded-full"></div>
                  </button>

                  {openMenuId === item.id && (
                    <div
                      className="absolute right-0 mt-1 w-40 border-3 border-black z-10 shadow-brutal"
                      style={{ background: "var(--color-white)" }}
                      role="menu"
                      aria-label="Bookmark actions"
                    >
                      {item.url && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCaptureScreenshot(item.id, item.url!);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 border-b-2 border-black flex items-center gap-2"
                          role="menuitem"
                        >
                          📷 SCREENSHOT
                        </button>
                      )}
                      {item.screenshot && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteScreenshot(item.id);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-gray-100 border-b-2 border-black flex items-center gap-2"
                          role="menuitem"
                        >
                          🗑️ DEL SCREENSHOT
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(item.id);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-bold hover:bg-red-100 flex items-center gap-2"
                        style={{ color: "var(--color-danger)" }}
                        role="menuitem"
                      >
                        ❌ DELETE
                      </button>
                    </div>
                  )}
                </div>

                {item.screenshot && (
                  <div
                    className="w-full h-20 sm:h-24 border-3 border-black mb-2 sm:mb-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setSelectedScreenshot(item.screenshot!)}
                    title="Click to view full screenshot"
                  >
                    <img
                      src={item.screenshot}
                      alt={`Screenshot of ${item.title}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <h3
                  className="font-black text-sm sm:text-base mb-1 cursor-pointer hover:underline pr-8"
                  onClick={() => item.url && handleOpenBookmark(item.url)}
                  title={item.title}
                >
                  {item.title.toUpperCase()}
                </h3>

                {item.url && (
                  <a
                    href={item.url}
                    onClick={(e) => {
                      e.preventDefault();
                      handleOpenBookmark(item.url!);
                    }}
                    className="text-xs font-bold hover:underline block mb-2 wrap-break-word"
                    title={item.url}
                    style={{ color: "var(--color-primary)" }}
                  >
                    {item.url}
                  </a>
                )}

                {/* Rating */}
                <div className="mb-2">
                  {renderStars(item.rating, item.id, isEditingRating)}
                </div>

                {/* Tags */}
                <div className="mb-2">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {item.tags?.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold border-2 border-black"
                        style={{ background: "var(--color-secondary)" }}
                      >
                        {tag.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveTag(item.id, tag.id);
                          }}
                          className="hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <select
                      value={selectedTag || ""}
                      onChange={(e) => setSelectedTag(Number(e.target.value))}
                      className="flex-1 text-xs font-bold border-2 border-black px-2 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">Add tag...</option>
                      {allTags
                        .filter(
                          (tag) => !item.tags?.some((t) => t.id === tag.id)
                        )
                        .map((tag) => (
                          <option key={tag.id} value={tag.id}>
                            {tag.name}
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddTag(item.id);
                      }}
                      disabled={!selectedTag}
                      className="px-2 py-1 text-xs font-bold border-2 border-black disabled:opacity-50"
                      style={{ background: "var(--color-white)" }}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex gap-1 mt-1">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="New tag..."
                      className="flex-1 text-xs font-bold border-2 border-black px-2 py-1"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          handleCreateAndAddTag(item.id);
                        }
                      }}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCreateAndAddTag(item.id);
                      }}
                      disabled={!newTagName.trim()}
                      className="px-2 py-1 text-xs font-bold border-2 border-black disabled:opacity-50"
                      style={{ background: "var(--color-white)" }}
                    >
                      CREATE
                    </button>
                  </div>
                </div>

                {/* Note */}
                <div className="mb-2">
                  {isEditingNote ? (
                    <div>
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note..."
                        className="w-full text-xs font-bold border-2 border-black px-2 py-1 min-h-20"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex gap-1 mt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSaveNote(item.id);
                          }}
                          className="flex-1 px-2 py-1 text-xs font-bold border-2 border-black"
                          style={{ background: "var(--color-success)" }}
                        >
                          SAVE
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNoteId(null);
                            setNoteText("");
                          }}
                          className="flex-1 px-2 py-1 text-xs font-bold border-2 border-black"
                          style={{ background: "var(--color-white)" }}
                        >
                          CANCEL
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNoteId(item.id);
                        setNoteText(item.note || "");
                      }}
                      className="cursor-pointer hover:bg-gray-50 border-2 border-dashed border-gray-300 px-2 py-2 min-h-12"
                    >
                      {item.note ? (
                        <p className="text-xs font-bold">{item.note}</p>
                      ) : (
                        <p className="text-xs font-bold text-gray-400">
                          Click to add note...
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <p
                  className="text-xs font-bold mt-auto"
                  style={{ opacity: 0.6 }}
                >
                  {formatDate(item.dateAdded)}
                </p>
              </div>
            </div>
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
            <button
              className="absolute -top-12 right-0 btn-brutal px-4 py-2 font-black"
              style={{ background: "var(--color-white)" }}
              onClick={() => setSelectedScreenshot(null)}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default BookmarkList;
