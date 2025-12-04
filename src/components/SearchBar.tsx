interface SearchBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
}

function SearchBar({ searchTerm, onSearch }: SearchBarProps) {
  return (
    <div className="relative group">
      <input
        type="text"
        placeholder="Search your vault..."
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full px-5 py-3 pl-12 rounded-xl focus:outline-none transition-smooth border-2"
        style={{
          background: 'var(--color-bg-secondary)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
          fontFamily: 'Crimson Pro, serif',
          fontSize: '1.05rem',
        }}
        onFocus={(e) => {
          e.target.style.borderColor = 'var(--color-accent-primary)';
          e.target.style.boxShadow = 'var(--shadow-glow)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--color-border)';
          e.target.style.boxShadow = 'none';
        }}
      />
      <svg
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors"
        style={{ color: 'var(--color-text-muted)' }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {searchTerm && (
        <button
          onClick={() => onSearch('')}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 transition-smooth hover:scale-110"
          style={{ color: 'var(--color-accent-primary)' }}
          title="Clear search"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default SearchBar;
