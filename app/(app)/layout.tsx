 'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE } from '../../lib/api';

const navItems = [
  { href: '/cards', label: 'Card Box' },
  { href: '/boards', label: 'Boards' },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(max-width: 1024px)');
    const apply = () => {
      setIsMobile(media.matches);
      setCollapsed(media.matches);
    };
    apply();
    media.addEventListener('change', apply);
    root.classList.remove('theme-light', 'theme-sand', 'theme-dark');
    root.classList.add('theme-light');
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      appRoot.classList.remove('theme-light', 'theme-sand', 'theme-dark');
      appRoot.classList.add('theme-light');
    }
    return () => media.removeEventListener('change', apply);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/note_tool/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    localStorage.removeItem('userId');
    localStorage.removeItem('note_tool_token');
    router.push('/auth/login');
  };

  return (
    <div
      className="min-h-screen text-[color:var(--app-foreground)] theme-light"
      id="app-root"
      style={
        {
          background: 'var(--app-bg)',
          '--sidebar-width': collapsed ? '0rem' : '16rem',
        } as React.CSSProperties
      }
    >
      <div className="relative flex min-h-screen">
        {!collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="fixed inset-0 z-40 bg-black/30 lg:hidden"
            aria-label="Close sidebar"
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col overflow-hidden transition-all duration-300 lg:static lg:z-auto ${
            collapsed ? 'w-0 lg:w-0' : 'w-full lg:w-64'
          }`}
          style={{ background: 'var(--sidebar-bg)', color: 'var(--sidebar-fg)' }}
        >
          <div className={`px-4 pt-6 ${collapsed ? 'px-3' : 'px-6'}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em]" style={{ color: 'var(--sidebar-muted)' }}>
                  {collapsed ? 'MP' : 'Mipun'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => !prev)}
                className="rounded-full border border-slate-700/50 p-2 text-slate-200/80 hover:bg-slate-800/60"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d={collapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </button>
            </div>
          </div>
          <nav className={`mt-8 space-y-1 ${collapsed ? 'px-2' : 'px-4'}`}>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => {
                  if (isMobile) {
                    setCollapsed(true);
                  }
                }}
                className={`flex items-center rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-slate-800/60 hover:text-white ${
                  collapsed ? 'justify-center' : 'gap-3'
                }`}
                title={item.label}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs uppercase">
                  {item.label.slice(0, 1)}
                </span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ))}
          </nav>
          <div className="px-4 pb-6 pt-10">
            {!collapsed && (
              <div className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
                Connect the Mind, Punch the Memory.
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className={`mt-4 w-full rounded-lg border border-slate-700/50 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800/60 ${
                collapsed ? 'px-0' : ''
              }`}
            >
              {collapsed ? '⏻' : 'Logout'}
            </button>
          </div>
          {!collapsed && (
            <div
              className="mt-auto border-t border-slate-700/40 px-4 pb-6 pt-4 text-center text-[11px] tracking-[0.08em]"
              style={{ color: 'var(--sidebar-muted)' }}
            >
              InstantCheese Shao
            </div>
          )}
        </aside>
        {collapsed && (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            className="absolute left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md hover:bg-slate-50"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <main className="app-main flex-1">
          <div className={`py-8 ${collapsed ? 'pl-16 pr-6 md:pl-20 md:pr-10' : 'px-6 md:px-10'}`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
