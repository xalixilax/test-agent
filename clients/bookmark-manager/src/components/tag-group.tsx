import { useAddTag, useTags } from "@/db/useTag";
import { Button } from "@design-system/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from "@design-system/ui/combobox";
import { Input } from "@design-system/ui/input";
import { Plus } from "lucide-react";
import React, { useEffect } from "react";

interface TagGroupProps {
  tags?: { id: number; name: string }[];
  onTagAdd?: (tagId: number) => void;
  onTagRemove?: (tagId: number) => void;
  onNewTagCreate?: (tagName: string) => void;
  placeholder?: string;
}

export function TagGroup({
  tags = [],
  onTagAdd,
  onTagRemove,
  onNewTagCreate,
  placeholder = "Add tags...",
}: TagGroupProps) {
  const [newTagName, setNewTagName] = React.useState("");
  const [showAddNew, setShowAddNew] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<
    Array<{ label: string; value: string }>
  >(tags.map((tag) => ({ label: tag.name, value: tag.id.toString() })));

  const allTags = useTags();
  const addTagMutation = useAddTag();

  // Sync internal value with tags prop
  React.useEffect(() => {
    setInternalValue(
      tags.map((tag) => ({ label: tag.name, value: tag.id.toString() }))
    );
  }, [tags]);

  if (allTags.isLoading) {
    return (
      <div className="text-xs font-bold text-gray-400">Loading tags...</div>
    );
  }

  if (allTags.isError) {
    return (
      <div className="text-xs font-bold text-red-500">Error loading tags</div>
    );
  }

  const items = (allTags.data || []).map((tag) => ({
    label: tag.name,
    value: tag.id.toString(),
  }));

  const handleAddNewTag = () => {
    if (!newTagName.trim()) return;

    if (onNewTagCreate) {
      onNewTagCreate(newTagName.trim());
    } else {
      addTagMutation.mutate({ name: newTagName.trim() });
    }

    setNewTagName("");
    setShowAddNew(false);
  };

  return (
    <Combobox
      value={internalValue}
      items={items}
      multiple
      onValueChange={(newValues) => {
        console.log("onValueChange called", { newValues, currentTags: tags });
        setInternalValue(newValues);

        const newValueIds = newValues.map((v) => parseInt(v.value));
        const oldValueIds = tags.map((t) => t.id);

        // Find added tags
        const addedIds = newValueIds.filter((id) => !oldValueIds.includes(id));
        console.log("Adding tags:", addedIds);
        addedIds.forEach((id) => onTagAdd?.(id));

        // Find removed tags
        const removedIds = oldValueIds.filter(
          (id) => !newValueIds.includes(id)
        );
        console.log("Removing tags:", removedIds);
        removedIds.forEach((id) => onTagRemove?.(id));
      }}
    >
      <ComboboxChips className="border-0 gap-1">
        <ComboboxValue>
          {(values: { value: string; label: string }[]) => {
            return (
              <>
                {values?.map((item) => (
                  <ComboboxChip
                    aria-label={item.label}
                    key={item.value}
                    className="bg-primary text-primary-foreground border-2 border-foreground font-bold px-2 py-0.5 text-xs"
                  >
                    {item.label}
                  </ComboboxChip>
                ))}
                <ComboboxInput
                  aria-label="Select tags"
                  placeholder={values.length > 0 ? "" : placeholder}
                  className="text-xs font-bold z-10"
                />
              </>
            );
          }}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>No tags found.</ComboboxEmpty>
        <ComboboxList>
          {items.map((item) => (
            <ComboboxItem
              key={item.value}
              value={item}
              className="font-bold text-sm"
            >
              {item.label}
            </ComboboxItem>
          ))}
          <div className="border-t-4 border-foreground">
            {showAddNew ? (
              <div
                className="p-3 bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddNewTag();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        setShowAddNew(false);
                      }
                      // Prevent Tab from closing the combobox
                      if (e.key === "Tab") {
                        e.stopPropagation();
                      }
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onFocus={(e) => e.stopPropagation()}
                    placeholder="Enter tag name..."
                    className="flex-1 px-3 py-2 border-3 border-foreground bg-card font-medium placeholder:text-muted-foreground outline-none focus:shadow-[3px_3px_0px_0px] focus:shadow-foreground transition-shadow"
                    autoFocus
                  />
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddNewTag();
                    }}
                    size="sm"
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddNew(true);
                }}
                className="w-full px-4 py-3 flex items-center gap-2 hover:bg-muted transition-colors font-bold text-left"
              >
                <Plus className="w-5 h-5" />
                <span>Add new tag</span>
              </button>
            )}
          </div>
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
