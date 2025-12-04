import { useState } from 'react';

interface AddBookmarkProps {
  onAdd: (title: string, url: string) => void;
}

function AddBookmark({ onAdd }: AddBookmarkProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && url.trim()) {
      onAdd(title, url);
      setTitle('');
      setUrl('');
      setIsExpanded(false);
    }
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
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
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add New Bookmark
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-gray-50 rounded-lg">
      <div>
        <input
          type="text"
          placeholder="Bookmark title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setTitle('');
            setUrl('');
          }}
          className="flex-1 py-2 px-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AddBookmark;
