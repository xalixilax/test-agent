import { Card } from "@design-system/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@design-system/ui/dropdown-menu";
import { EllipsisVertical } from "lucide-react";
import { formatDisplayUrl } from "@/shared/format";
import type { RemoteBookmarkItem } from "@/presentation/lib/remoteBookmarks";

interface RemoteBookmarkCardProps {
  item: RemoteBookmarkItem;
  onOpenBookmark: (url: string) => void;
  onMoveHere: (url: string) => void;
  onViewScreenshot: (screenshot: string) => void;
}

export function RemoteBookmarkCard({
  item,
  onOpenBookmark,
  onMoveHere,
  onViewScreenshot,
}: RemoteBookmarkCardProps) {
  const screenshot = item.record.imageUrl ?? item.record.screenshotUrl;
  const incoming = item.move?.state === "requested";
  const failed = item.move?.state === "failed";

  return (
    <Card className="relative card-brutal p-3 sm:p-4" style={{ background: "var(--color-white)" }}>
      <div className="flex flex-col h-full gap-2">
        <RemoteCardMenu
          item={item}
          incoming={incoming}
          failed={failed}
          onOpenBookmark={onOpenBookmark}
          onMoveHere={onMoveHere}
        />
        <span className="text-xs font-black px-2 py-0.5 border-3 border-black self-start bg-yellow-background">
          IN {item.holderNames.join(", ").toUpperCase()}
        </span>
        <div className="flex flex-col gap-1">
          <h3
            className="font-black text-sm sm:text-base cursor-pointer hover:underline pr-8 text-balance"
            onClick={() => onOpenBookmark(item.url)}
            title={item.title}
          >
            {item.title.toUpperCase()}
          </h3>
          <a
            href={item.url}
            onClick={(e) => {
              e.preventDefault();
              onOpenBookmark(item.url);
            }}
            className="text-xs font-bold hover:underline block wrap-break-word"
            title={item.url}
            style={{ color: "var(--color-primary)" }}
          >
            {formatDisplayUrl(item.url)}
          </a>
        </div>
        {screenshot && (
          <div
            className="w-full border-3 border-black mb-2 sm:mb-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => onViewScreenshot(screenshot)}
            title="Click to view full screenshot"
          >
            <img src={screenshot} alt={`Screenshot of ${item.title}`} className="w-full h-auto" />
          </div>
        )}
        {item.record.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {item.record.tags.map((tag) => (
              <span key={tag} className="text-xs px-1 border border-black bg-gray-100">
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.record.note && <p className="text-xs font-bold">{item.record.note}</p>}
        {item.record.rating !== undefined && (
          <p className="text-xs font-bold" title={`${item.record.rating} star rating`}>
            {"★".repeat(item.record.rating)}
            {"☆".repeat(Math.max(0, 5 - item.record.rating))}
          </p>
        )}
      </div>
    </Card>
  );
}

function RemoteCardMenu({
  item,
  incoming,
  failed,
  onOpenBookmark,
  onMoveHere,
}: {
  item: RemoteBookmarkItem;
  incoming: boolean;
  failed: boolean;
  onOpenBookmark: (url: string) => void;
  onMoveHere: (url: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Bookmark actions menu" className="absolute top-4 right-4">
        <EllipsisVertical />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onOpenBookmark(item.url)}>🔗 OPEN</DropdownMenuItem>
        <DropdownMenuItem disabled={incoming} onClick={() => onMoveHere(item.url)}>
          {incoming ? "⏳ INCOMING..." : failed ? "🔁 RETRY MOVE HERE" : "➡️ MOVE HERE"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
