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
        className="w-full py-3 px-6 rounded-xl font-semibold transition-smooth hover-lift hover-glow flex items-center justify-center gap-3 border-2 border-dashed group"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.1), rgba(212, 98, 47, 0.1))',
          borderColor: 'var(--color-accent-primary)',
          color: 'var(--color-accent-secondary)',
          fontFamily: 'Syne, sans-serif',
        }}
      >
        <svg
          className="w-6 h-6 transition-transform group-hover:rotate-90"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Add to Vault
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-5 rounded-xl border animate-scale-in" style={{
      background: 'rgba(45, 33, 24, 0.5)',
      borderColor: 'var(--color-border)',
    }}>
      <div>
        <input
          type="text"
          placeholder="Bookmark title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-3 rounded-lg focus:outline-none transition-smooth border-2"
          style={{
            background: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'Crimson Pro, serif',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--color-accent-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          required
        />
      </div>
      <div>
        <input
          type="url"
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-4 py-3 rounded-lg focus:outline-none transition-smooth border-2"
          style={{
            background: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
            fontFamily: 'Crimson Pro, serif',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--color-accent-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--color-border)'}
          required
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="flex-1 py-3 px-4 rounded-lg font-semibold transition-smooth hover-lift"
          style={{
            background: 'linear-gradient(135deg, var(--color-accent-primary), var(--color-accent-tertiary))',
            color: 'white',
            fontFamily: 'Syne, sans-serif',
          }}
        >
          ✦ Add
        </button>
        <button
          type="button"
          onClick={() => {
            setIsExpanded(false);
            setTitle('');
            setUrl('');
          }}
          className="flex-1 py-3 px-4 rounded-lg font-semibold transition-smooth hover-lift border-2"
          style={{
            background: 'transparent',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'Syne, sans-serif',
          }}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default AddBookmark;
