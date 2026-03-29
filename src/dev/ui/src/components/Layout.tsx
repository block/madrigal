import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/explorer', label: 'Explorer' },
  { to: '/search', label: 'Search' },
  { to: '/build', label: 'Build' },
  { to: '/brands', label: 'Brands' },
] as const;

export function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            <span className="text-violet-400">♫</span> Madrigal
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">Knowledge Explorer</p>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {links.map(({ to, label, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-violet-500/15 text-violet-300 font-medium'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-zinc-800 text-xs text-zinc-600">
          madrigal dev
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
