import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Upload, FolderOpen, LogOut, User, Settings, ChevronDown, Menu, X, Shield, Scale, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth.store';
import { isAdmin } from '@/components/auth/AdminRoute';
import { logout as logoutApi } from '@/api/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

const navItems = [
  { to: '/', label: 'Home', icon: Scale },
  { to: '/upload', label: 'Carica PDF', icon: Upload },
  { to: '/documents', label: 'Documenti', icon: FolderOpen },
  { to: '/ddt', label: 'DDT', icon: ClipboardList },
];

export function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logoutApi();
    } catch {
      // Ignore errors, logout locally anyway
    }
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
  };

  const handleNavClick = (to: string) => {
    navigate(to);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center space-x-2.5 group">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 shadow-sm group-hover:shadow-md transition-shadow">
            <Scale className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
            Bilanciami
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
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

        {/* Desktop User Menu */}
        {user && (
          <div className="hidden md:block">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-2 text-sm text-foreground/60 hover:text-foreground transition-colors cursor-pointer outline-none">
                <User className="h-4 w-4" />
                <span className="hidden sm:inline">{user.name}</span>
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User className="mr-2 h-4 w-4" />
                  Profilo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Impostazioni
                </DropdownMenuItem>
                {isAdmin(user?.email) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/admin')}>
                      <Shield className="mr-2 h-4 w-4" />
                      Admin
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Esci
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Mobile Menu Button */}
        <button
          className="md:hidden p-2 -mr-2"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container px-4 py-4 space-y-2">
            {navItems.map(({ to, label, icon: Icon }) => (
              <button
                key={to}
                onClick={() => handleNavClick(to)}
                className={cn(
                  'flex items-center space-x-3 w-full p-3 rounded-lg transition-colors',
                  location.pathname === to
                    ? 'bg-primary/10 text-foreground'
                    : 'text-foreground/60 hover:bg-muted'
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </button>
            ))}

            {user && (
              <>
                <div className="border-t my-2 pt-2" />
                <button
                  onClick={() => handleNavClick('/profile')}
                  className="flex items-center space-x-3 w-full p-3 rounded-lg text-foreground/60 hover:bg-muted"
                >
                  <User className="h-5 w-5" />
                  <span className="font-medium">Profilo</span>
                </button>
                <button
                  onClick={() => handleNavClick('/settings')}
                  className="flex items-center space-x-3 w-full p-3 rounded-lg text-foreground/60 hover:bg-muted"
                >
                  <Settings className="h-5 w-5" />
                  <span className="font-medium">Impostazioni</span>
                </button>
                {isAdmin(user?.email) && (
                  <button
                    onClick={() => handleNavClick('/admin')}
                    className="flex items-center space-x-3 w-full p-3 rounded-lg text-foreground/60 hover:bg-muted"
                  >
                    <Shield className="h-5 w-5" />
                    <span className="font-medium">Admin</span>
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-3 w-full p-3 rounded-lg text-red-600 hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="font-medium">Esci</span>
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
