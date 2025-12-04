interface BreadcrumbItem {
  id: string;
  title: string;
}

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm mb-4 overflow-x-auto">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            onClick={() => onNavigate(item.id)}
            className={`px-3 py-1 rounded transition-colors ${
              index === path.length - 1
                ? 'bg-blue-100 text-blue-700 font-semibold'
                : 'text-blue-600 hover:bg-blue-50'
            }`}
          >
            {item.title || 'Bookmarks'}
          </button>
          {index < path.length - 1 && (
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>
      ))}
    </nav>
  );
}

export default Breadcrumb;
