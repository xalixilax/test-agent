import type { BreadcrumbItem } from '../types';

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-sm overflow-x-auto pb-2" style={{
      fontFamily: 'Crimson Pro, serif',
    }}>
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2 animate-slide-in-right" style={{ animationDelay: `${index * 0.1}s` }}>
          <button
            onClick={() => onNavigate(item.id)}
            className={`px-4 py-2 rounded-lg transition-smooth font-semibold ${
              index === path.length - 1
                ? 'hover-lift'
                : 'opacity-70 hover:opacity-100'
            }`}
            style={index === path.length - 1 ? {
              background: 'linear-gradient(135deg, rgba(255, 140, 66, 0.2), rgba(212, 98, 47, 0.2))',
              color: 'var(--color-accent-secondary)',
              border: '1px solid var(--color-accent-primary)',
            } : {
              color: 'var(--color-text-muted)',
            }}
          >
            {item.title || 'Bookmarks'}
          </button>
          {index < path.length - 1 && (
            <svg
              className="w-4 h-4 flex-shrink-0"
              style={{ color: 'var(--color-text-muted)' }}
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
