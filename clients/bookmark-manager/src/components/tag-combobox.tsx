"use client";

import { useState, useRef, useEffect } from "react";
import { X, ChevronDown, Plus, Search } from "lucide-react";

interface Tag {
  id: string;
  name: string;
  color: string;
}

const TAG_COLORS = [
  "bg-primary",
  "bg-secondary",
  "bg-accent",
  "bg-chart-4",
  "bg-chart-5",
];

const DEFAULT_TAGS: Tag[] = [
  { id: "1", name: "Design", color: "bg-primary" },
  { id: "2", name: "Development", color: "bg-secondary" },
  { id: "3", name: "Marketing", color: "bg-accent" },
  { id: "4", name: "Research", color: "bg-chart-4" },
  { id: "5", name: "Strategy", color: "bg-chart-5" },
];

export function TagCombobox() {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [availableTags, setAvailableTags] = useState<Tag[]>(DEFAULT_TAGS);
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.name.toLowerCase().includes(search.toLowerCase()) &&
      !selectedTags.find((t) => t.id === tag.id)
  );

  const handleSelectTag = (tag: Tag) => {
    setSelectedTags([...selectedTags, tag]);
    setSearch("");
    inputRef.current?.focus();
  };

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter((t) => t.id !== tagId));
  };

  const handleAddNewTag = () => {
    if (newTagName.trim()) {
      const newTag: Tag = {
        id: Date.now().toString(),
        name: newTagName.trim(),
        color: TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)],
      };
      setAvailableTags([...availableTags, newTag]);
      setSelectedTags([...selectedTags, newTag]);
      setNewTagName("");
      setShowAddNew(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowAddNew(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="w-full max-w-md">
      {/* Combobox trigger */}
      <div
        className="relative border-4 border-foreground bg-card shadow-[6px_6px_0px_0px] shadow-foreground cursor-pointer transition-all hover:shadow-[8px_8px_0px_0px] hover:shadow-foreground active:shadow-[2px_2px_0px_0px] active:shadow-foreground active:translate-x-1 active:translate-y-1"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
      >
        <div className="p-3 min-h-[56px]">
          <div className="flex flex-wrap gap-2 items-center">
            {selectedTags.map((tag) => (
              <span
                key={tag.id}
                className={`${tag.color} text-foreground px-3 py-1 text-sm font-bold border-3 border-foreground inline-flex items-center gap-1 shadow-[3px_3px_0px_0px] shadow-foreground`}
              >
                {tag.name}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveTag(tag.id);
                  }}
                  className="hover:bg-foreground/20 p-0.5 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {isOpen ? (
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={selectedTags.length === 0 ? "Search tags..." : ""}
                className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground font-medium"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              selectedTags.length === 0 && (
                <span className="text-muted-foreground font-medium">
                  Select tags...
                </span>
              )
            )}
          </div>
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <ChevronDown
            className={`w-5 h-5 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="mt-2 border-4 border-foreground bg-card shadow-[6px_6px_0px_0px] shadow-foreground overflow-hidden">
          {/* Search indicator */}
          {search && (
            <div className="px-3 py-2 border-b-4 border-foreground bg-muted flex items-center gap-2">
              <Search className="w-4 h-4" />
              <span className="font-medium text-sm">
                Searching for &quot;{search}&quot;
              </span>
            </div>
          )}

          {/* Tags list */}
          <div className="max-h-[200px] overflow-y-auto">
            {filteredTags.length > 0 ? (
              filteredTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleSelectTag(tag)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted border-b-2 border-foreground/20 last:border-b-0 transition-colors text-left"
                >
                  <span
                    className={`${tag.color} w-4 h-4 border-2 border-foreground`}
                  />
                  <span className="font-bold">{tag.name}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-muted-foreground font-medium">
                No tags found
              </div>
            )}
          </div>

          {/* Add new tag section */}
          <div className="border-t-4 border-foreground">
            {showAddNew ? (
              <div className="p-3 bg-muted">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddNewTag();
                      if (e.key === "Escape") setShowAddNew(false);
                    }}
                    placeholder="Enter tag name..."
                    className="flex-1 px-3 py-2 border-3 border-foreground bg-card font-medium placeholder:text-muted-foreground outline-none focus:shadow-[3px_3px_0px_0px] focus:shadow-foreground transition-shadow"
                    autoFocus
                  />
                  <button
                    onClick={handleAddNewTag}
                    className="px-4 py-2 bg-primary text-primary-foreground font-bold border-3 border-foreground shadow-[3px_3px_0px_0px] shadow-foreground hover:shadow-[4px_4px_0px_0px] active:shadow-[1px_1px_0px_0px] active:translate-x-0.5 active:translate-y-0.5 transition-all"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddNew(true)}
                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted transition-colors font-bold text-left"
              >
                <Plus className="w-5 h-5" />
                <span>Add new tag</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
