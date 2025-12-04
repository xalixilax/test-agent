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
        className="w-full py-3 px-4 btn-brutal font-black text-sm sm:text-base"
        style={{ background: 'var(--color-secondary)' }}
      >
        + ADD BOOKMARK
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 card-brutal" style={{ background: 'var(--color-white)' }}>
      <div>
        <input
          type="text"
          placeholder="TITLE"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full input-brutal text-sm sm:text-base"
          required
        />
      </div>
      <div>
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full input-brutal text-sm sm:text-base"
          required
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-2 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: 'var(--color-success)' }}
        >
          ADD
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setTitle('');
            setUrl('');
          }}
          className="flex-1 py-2 px-4 btn-brutal font-black text-sm sm:text-base"
          style={{ background: 'var(--color-white)' }}
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}

export default AddBookmark;
