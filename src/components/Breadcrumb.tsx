import type { BreadcrumbItem } from '../types';

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-xs sm:text-sm overflow-x-auto pb-1">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => onNavigate(item.id)}
            className={`px-3 py-1 font-bold border-2 border-black transition-all ${
              index === path.length - 1
                ? 'bg-black text-white'
                : 'bg-white hover:bg-gray-100'
            }`}
          >
            {item.title || 'Bookmarks'}
          </button>
          {index < path.length - 1 && (
            <span className="text-xl font-black">›</span>
          )}
        </div>
      ))}
    </nav>
  );
}

export default Breadcrumb;
