import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Example/Combobox",
  component: Combobox,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Test = {
  render: () => <Particle />,
} satisfies Story;

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

const items = [
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

export function Particle() {
    const [showAddNew, setShowAddNew] = React.useState(false);


  return (
    <Combobox defaultValue={[items[0], items[4]]} items={items} multiple>
      <ComboboxChips className={"border-0"}>
        <ComboboxValue>
          {(value: { value: string; label: string }[]) => (
            <>
              {value?.map((item) => (
                <ComboboxChip aria-label={item.label} key={item.value}>
                  {item.label}
                </ComboboxChip>
              ))}
              <ComboboxInput
                aria-label="Select a item"
                placeholder={value.length > 0 ? undefined : "Select a item..."}
              />
            </>
          )}
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
        </ComboboxList>
      </ComboboxPopup>
    </Combobox>
  );
}
