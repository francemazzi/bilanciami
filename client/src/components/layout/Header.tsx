import { Link, useLocation } from 'react-router-dom';
import { FileText, Upload, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Home', icon: FileText },
  { to: '/upload', label: 'Carica PDF', icon: Upload },
  { to: '/documents', label: 'Documenti', icon: FolderOpen },
];

export function Header() {
  const location = useLocation();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-8 flex items-center space-x-2">
          <FileText className="h-6 w-6" />
          <span className="font-bold text-lg">Bilanciami</span>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center space-x-2 transition-colors hover:text-foreground/80',
                location.pathname === to
                  ? 'text-foreground'
                  : 'text-foreground/60'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
