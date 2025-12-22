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
import { Plus } from "lucide-react";
import React from "react";

const items2 = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Orange", value: "orange" },
  { label: "Grape", value: "grape" },
  { label: "Strawberry", value: "strawberry" },
  { label: "Mango", value: "mango" },
  { label: "Pineapple", value: "pineapple" },
  { label: "Kiwi", value: "kiwi" },
  { label: "Peach", value: "peach" },
  { label: "Pear", value: "pear" },
];

export function TagGroup({
  tags = [],
}: {
  tags?: { id: number; name: string }[];
}) {
  const [newTagName, setNewTagName] = React.useState("");
  const [newTags, setNewTags] =
    React.useState<{ id: number; name: string }[]>(tags);

  const allTags = useTags();
  const addTagMutation = useAddTag();

  const [showAddNew, setShowAddNew] = React.useState(false);

  if (allTags.isLoading) {
    return <div>Loading tags...</div>;
  }

  if (allTags.isError) {
    return <div>Error loading tags: {allTags.error.message}</div>;
  }

  const initial = newTags.map((tag) => ({
    label: tag.name,
    value: tag.id.toString(),
  }));

  const items = (allTags.data || []).map((tag) => ({
    label: tag.name,
    value: tag.id.toString(),
  }));

  return (
    <Combobox defaultValue={initial} items={items2} multiple>
      <ComboboxChips className={"border-0"}>
        <ComboboxValue>
          {(values: { value: string; label: string }[]) => {
            return (
              <>
                {values?.map((item) => (
                  <div>
                    {item.value}
                    <ComboboxChip aria-label={item.label} key={item.value}>
                      {item.label}
                    </ComboboxChip>
                  </div>
                ))}
                <ComboboxInput
                  aria-label="Select a item"
                  placeholder={
                    values.length > 0 ? undefined : "Select a item..."
                  }
                />
              </>
            );
          }}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxPopup>
        <ComboboxEmpty>No items found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
          <div className="border-t-4 border-foreground">
            {showAddNew ? (
              <div className="p-3 bg-muted">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        addTagMutation.mutate({ name: newTagName });
                      if (e.key === "Escape") setShowAddNew(false);
                    }}
                    placeholder="Enter tag name..."
                    className="flex-1 px-3 py-2 border-3 border-foreground bg-card font-medium placeholder:text-muted-foreground outline-none focus:shadow-[3px_3px_0px_0px] focus:shadow-foreground transition-shadow"
                    autoFocus
                  />
                  <Button
                    onClick={() => addTagMutation.mutate({ name: newTagName })}
                  >
                    Add
                  </Button>
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
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
