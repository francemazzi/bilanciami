import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbProps {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: BreadcrumbProps) {
  const parts = path.split('/').filter(Boolean);

  const breadcrumbs = [
    { name: 'Documenti', path: '/' },
    ...parts.map((part, index) => ({
      name: part,
      path: '/' + parts.slice(0, index + 1).join('/'),
    })),
  ];

  return (
    <nav className="flex items-center space-x-1 text-sm text-gray-600 mb-4">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.path} className="flex items-center">
          {index > 0 && (
            <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
          )}
          {index === 0 ? (
            <button
              onClick={() => onNavigate(crumb.path)}
              className="flex items-center hover:text-blue-600 transition-colors"
            >
              <Home className="h-4 w-4" />
            </button>
          ) : index === breadcrumbs.length - 1 ? (
            <span className="font-medium text-gray-900">{crumb.name}</span>
          ) : (
            <button
              onClick={() => onNavigate(crumb.path)}
              className="hover:text-blue-600 transition-colors"
            >
              {crumb.name}
            </button>
          )}
        </div>
      ))}
    </nav>
  );
}
