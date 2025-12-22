import type { BookmarkWithTags } from "@/types";
import { Button } from "@design-system/ui/button";
import { Card } from "@design-system/ui/card";
import { Folder as FolderIcon } from "lucide-react";

interface FolderProps {
  item: BookmarkWithTags;
  onNavigateToFolder: (chromeBookmarkId: string, folderTitle: string) => void;
  onDelete: (chromeBookmarkId: string) => void;
}

export function Folder({ item, onNavigateToFolder, onDelete }: FolderProps) {
  return (
    <Card
      key={item.chromeBookmarkId}
      className="relative card-brutal p-3 sm:p-4 cursor-pointer hover:bg-purple-background transition-colors bg-green-background"
      onClick={() =>
        onNavigateToFolder(item.chromeBookmarkId, item.title || "")
      }
    >
      <div className="flex flex-col h-full items-center justify-center py-8">
        <FolderIcon className="w-12 h-12 text-foreground mb-3" />
        <h3 className="font-black text-base sm:text-lg text-center">
          {item.title.toUpperCase()}
        </h3>
      </div>

      {/* Delete button */}
      <div className="absolute top-2 right-2">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.chromeBookmarkId);
          }}
          variant="destructive"
          size="icon"
          aria-label="Delete folder"
        >
          ❌
        </Button>
      </div>
    </Card>
  );
}
