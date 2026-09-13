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
import { useState } from "react";

interface TagGroupProps {
  tags: string[];
  allTags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagGroup({
  tags = [],
  allTags = [],
  onChange,
  placeholder = "Add tags...",
}: TagGroupProps) {
  const [newTagName, setNewTagName] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);

  const items = allTags.map((name) => ({ label: name, value: name }));
  const value = tags.map((name) => ({ label: name, value: name }));

  const handleAddNewTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    if (!tags.includes(name)) {
      onChange([...tags, name]);
    }
    setNewTagName("");
    setShowAddNew(false);
  };

  return (
    <Combobox
      value={value}
      items={items}
      multiple
      onValueChange={(newValues) => {
        onChange([...new Set(newValues.map((item) => item.value))]);
      }}
    >
      <ComboboxChips className="border-0 gap-1">
        <ComboboxValue>
          {(values: { value: string; label: string }[]) => {
            return (
              <>
                {values?.map((item) => (
                  <ComboboxChip aria-label={item.label} key={item.value}>
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
