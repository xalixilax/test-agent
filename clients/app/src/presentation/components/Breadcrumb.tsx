import type { BreadcrumbItem } from "@/presentation/types";
import { Button } from "@design-system/ui/button";

interface BreadcrumbProps {
  path: BreadcrumbItem[];
  onNavigate: (id: string) => void;
}

function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-2 text-xs sm:text-sm overflow-x-auto pb-1">
      {path.map((item, index) => (
        <div key={item.id} className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => onNavigate(item.id)}
            variant={index === path.length - 1 ? "default" : "default"}
            size="sm"
          >
            {item.title || "Bookmarks"}
          </Button>
          {index < path.length - 1 && (
            <span className="text-xl font-black">›</span>
          )}
        </div>
      ))}
    </nav>
  );
}

export default Breadcrumb;
