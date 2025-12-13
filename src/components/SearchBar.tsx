interface SearchBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  compact?: boolean;
}

function SearchBar({ searchTerm, onSearch, compact = false }: SearchBarProps) {
  return (
    <div className="relative">
      <input
        autoFocus
        type="text"
        placeholder="SEARCH..."
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full input-brutal pl-12 text-sm sm:text-base"
      />
      <svg
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      {searchTerm && (
        <button
          onClick={() => onSearch("")}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 flex items-center justify-center font-black text-lg hover:scale-110 transition-transform"
          title="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default SearchBar;
