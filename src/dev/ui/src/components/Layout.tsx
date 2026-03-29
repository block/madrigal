import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/explorer', label: 'Explorer' },
  { to: '/search', label: 'Search' },
  { to: '/build', label: 'Build' },
  { to: '/brands', label: 'Brands' },
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
    <div className="flex h-screen p-2 gap-2" style={{ background: 'var(--bg-muted)' }}>
      {/* Sidebar — inset floating */}
      <aside
        className="w-52 shrink-0 flex flex-col overflow-hidden"
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {/* Masthead */}
        <div className="px-5 pt-5 pb-4">
          <h1 style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'var(--text)',
          }}>
            madrigal
          </h1>
        </div>

        <hr className="rule" style={{ margin: '0 20px' }} />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {links.map(({ to, label, ...rest }) => (
            <NavLink
              key={to}
              to={to}
              end={'end' in rest}
              className="block px-3 py-1.5"
              style={({ isActive }) => ({
                fontSize: '0.8125rem',
                fontWeight: isActive ? 600 : 400,
                letterSpacing: '-0.01em',
                color: isActive ? 'var(--text)' : 'var(--text-muted)',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'var(--bg-muted)' : 'transparent',
              })}
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 flex items-center justify-between">
          <span className="type-overline" style={{ color: 'var(--text-faint)' }}>v0.1</span>
          <button
            onClick={toggle}
            className="type-overline px-2 py-1"
            style={{
              color: 'var(--text-muted)',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
            }}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {dark ? 'Light' : 'Dark'}
          </button>
        </div>
      </aside>

      {/* Main content — also a rounded panel */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          background: 'var(--bg)',
          borderRadius: 'var(--radius-card)',
          boxShadow: 'var(--shadow-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="max-w-[960px] mx-auto px-10 py-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
