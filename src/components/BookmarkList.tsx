interface Bookmark {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
}

interface BookmarkListProps {
  bookmarks: Bookmark[];
  onDelete: (id: string) => void;
}

function BookmarkList({ bookmarks, onDelete }: BookmarkListProps) {
  const handleOpenBookmark = (url: string) => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  };

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="w-16 h-16 mx-auto mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <p className="text-lg font-medium">No bookmarks found</p>
        <p className="text-sm mt-1">Add a new bookmark to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {bookmarks.map((bookmark) => (
        <div
          key={bookmark.id}
          className="group p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all bg-white"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3
                className="font-semibold text-gray-900 truncate cursor-pointer hover:text-blue-600"
                onClick={() => bookmark.url && handleOpenBookmark(bookmark.url)}
                title={bookmark.title}
              >
                {bookmark.title}
              </h3>
              {bookmark.url && (
                <a
                  href={bookmark.url}
                  onClick={(e) => {
                    e.preventDefault();
                    handleOpenBookmark(bookmark.url!);
                  }}
                  className="text-sm text-blue-600 hover:underline truncate block"
                  title={bookmark.url}
                >
                  {bookmark.url}
                </a>
              )}
              <p className="text-xs text-gray-500 mt-1">
                Added: {formatDate(bookmark.dateAdded)}
              </p>
            </div>
            <button
              onClick={() => onDelete(bookmark.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-2 text-red-600 hover:bg-red-50 rounded-lg"
              title="Delete bookmark"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default BookmarkList;
