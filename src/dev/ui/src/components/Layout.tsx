import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/explorer', label: 'Explorer' },
  { to: '/topology', label: 'Topology' },
  { to: '/search', label: 'Search' },
  { to: '/build', label: 'Build' },
  { to: '/brands', label: 'Brands' },
  { to: '/workbench', label: 'Workbench' },
] as const;

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  return { dark, toggle };
}

export function Layout() {
  const { dark, toggle } = useTheme();

  return (
    <div className="flex h-screen p-2 gap-2 bg-background-muted">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 flex flex-col overflow-hidden bg-background-default rounded-card shadow-card border border-border-card">
        {/* Masthead */}
        <div className="px-5 pt-5 pb-4">
          <h1 className="text-[1.25rem] font-bold tracking-[-0.035em] leading-[0.95] text-text-default">
            madrigal
          </h1>
        </div>

        <Separator className="mx-5" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(({ to, label, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                `block px-3 py-1.5 text-[0.8125rem] tracking-[-0.01em] rounded-card-sm transition-colors ${
                  isActive
                    ? 'font-semibold text-text-default bg-background-muted'
                    : 'font-normal text-text-muted hover:text-text-default hover:bg-background-muted/50'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="type-overline text-text-faint">v0.1</span>
          <Button
            variant="outline"
            size="sm"
            onClick={toggle}
            className="text-[10px] font-medium tracking-[0.1em] uppercase h-7 px-3"
          >
            {dark ? 'Light' : 'Dark'}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden bg-background-default rounded-card shadow-card border border-border-card">
        <ScrollArea className="h-full">
          <div className="max-w-[960px] mx-auto px-10 py-10">
            <Outlet />
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
