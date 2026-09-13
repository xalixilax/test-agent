import type { SyncStatus } from "@/routers/appRouters";

interface BookmarkHeaderProps {
  status?: SyncStatus;
  fetchProgress: { processed: number; total: number };
  isBackfilling: boolean;
  onOpenSync: () => void;
  onBackfill: () => void;
}

export function BookmarkHeader({
  status,
  fetchProgress,
  isBackfilling,
  onOpenSync,
  onBackfill,
}: BookmarkHeaderProps) {
  return (
    <div className="p-2 sm:p-4 md:p-6 border-b-4 border-black bg-orange-foreground-muted">
      <div className="flex items-center justify-between mx-auto max-w-7xl gap-2">
        <div>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-lexend font-black text-foreground">
            BOOKMARKS
          </h1>
          <p className="hidden md:block text-sm text-foreground font-bold mt-1">
            YOUR LINK COLLECTION
            <SyncIndicator status={status} />
            <FetchIndicator progress={fetchProgress} />
          </p>
        </div>
        <div className="flex gap-2">
          <SyncButton status={status} onClick={onOpenSync} />
          <BackfillButton isBackfilling={isBackfilling} onClick={onBackfill} />
        </div>
      </div>
    </div>
  );
}

function SyncIndicator({ status }: { status?: SyncStatus }) {
  if (!status?.loggedIn) return null;
  const lastSync = status.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleTimeString()
    : "NEVER SYNCED";
  return (
    <span className="ml-2 text-xs opacity-75">
      ({status.pendingCount} PENDING · {lastSync})
    </span>
  );
}

function FetchIndicator({ progress }: { progress: { processed: number; total: number } }) {
  if (progress.total === 0) return null;
  return (
    <span className="ml-2 text-xs opacity-75">
      (FETCHING IMAGES: {progress.processed}/{progress.total})
    </span>
  );
}

function SyncButton({ status, onClick }: { status?: SyncStatus; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 sm:px-4 sm:py-2 font-black text-xs sm:text-sm bg-white text-black border-3 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
    >
      {status?.loggedIn ? "SYNCED" : "SYNC"}
    </button>
  );
}

function BackfillButton({
  isBackfilling,
  onClick,
}: {
  isBackfilling: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={isBackfilling}
      className="px-3 py-2 sm:px-4 sm:py-2 font-black text-xs sm:text-sm bg-white text-black border-3 border-black shadow-brutal hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isBackfilling ? "⏳ FETCHING..." : "🖼️ FETCH ALL IMAGES"}
    </button>
  );
}
