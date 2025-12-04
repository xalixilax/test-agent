interface SearchBarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
}

function SearchBar({ searchTerm, onSearch }: SearchBarProps) {
  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search bookmarks..."
        value={searchTerm}
        onChange={(e) => onSearch(e.target.value)}
        className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
      />
      <svg
        className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
    </div>
  );
}

export default SearchBar;
