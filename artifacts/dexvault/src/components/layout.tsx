import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import logoUrl from '@assets/vault_151_LOGO_blackbg_1779627207357.png';
import { Home, Search, Layers, Library, User, Moon, Sun, AlertTriangle } from 'lucide-react';
import { useTheme } from './theme-provider';
import { Button } from './ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useCollectionStore } from '@/store/collectionStore';

interface LayoutProps {
  children: ReactNode;
}

function Vault151Logo({ size = 32 }: { size?: number }) {
  return (
    <img
      src={logoUrl}
      alt="Vault151 logo"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}

function Vault151Wordmark({ className = '', vaultClassName = 'text-foreground' }: { className?: string; vaultClassName?: string }) {
  return (
    <span className={`font-bold tracking-tight ${className}`}>
      <span className={vaultClassName}>Vault</span>
      <span className="text-red-600 dark:text-red-500">151</span>
    </span>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const dbSetupRequired = useCollectionStore((s) => s.dbSetupRequired);

  const isDark = theme === 'dark';

  const navItems = [
    { href: '/dashboard', icon: Home, label: 'Dashboard' },
    { href: '/search', icon: Search, label: 'Search' },
    { href: '/sets', icon: Layers, label: 'Sets' },
    { href: '/collection', icon: Library, label: 'Collection' },
    { href: '/profile', icon: User, label: 'Profile' },
  ];

  if (!user) return <>{children}</>;

  const isActivePath = (href: string) =>
    href === '/sets'
      ? location === '/sets' || location.startsWith('/sets/')
      : location === href;

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar px-4 py-6 shrink-0 h-screen sticky top-0">
        <div className="flex items-center gap-2.5 mb-8 px-2">
          <Vault151Logo size={32} />
          <Vault151Wordmark className="text-xl" />
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = isActivePath(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                }`}
                data-testid={`nav-link-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="pt-4 border-t border-sidebar-border mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            data-testid="button-toggle-theme"
          >
            {isDark ? <Sun className="w-5 h-5 mr-3" /> : <Moon className="w-5 h-5 mr-3" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 pb-[72px] md:pb-0 [overflow-x:clip]">
        {/* Mobile top bar — always black */}
        <header className="md:hidden flex items-center justify-between px-4 h-16 bg-black border-b border-black sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <Vault151Logo size={28} />
            <Vault151Wordmark className="text-lg" vaultClassName="text-white" />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:text-white hover:bg-white/10"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            data-testid="button-toggle-theme-mobile"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </header>

        {dbSetupRequired && (
          <div className="bg-amber-50 dark:bg-amber-950/50 border-b border-amber-300 dark:border-amber-700 px-4 py-3 flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
              Database setup required — your collection cannot be saved yet.
            </p>
            <Link
              href="/profile"
              className="text-sm font-semibold text-amber-700 dark:text-amber-300 underline underline-offset-2 shrink-0"
              data-testid="link-setup-banner"
            >
              View Setup SQL
            </Link>
          </div>
        )}

        {/* No top padding — sticky page headers own their own top padding */}
        <div className="flex-1 max-w-7xl mx-auto w-full px-4 pb-4 md:px-8 md:pb-8 flex flex-col">
          {children}
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-background border-t border-border flex items-center justify-around px-2 pb-safe z-50">
        {navItems.map((item) => {
          const isActive = isActivePath(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-16 h-full gap-1 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'fill-primary/20' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
