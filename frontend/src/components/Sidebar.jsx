import { NavLink, useLocation } from 'react-router-dom';

const nav = [
  { path: '/', label: 'Mail', d: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
  { path: '/contacts', label: 'People', d: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
  { path: '/settings', label: 'Settings', d: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col items-center py-4 z-50"
      style={{ width: 'var(--sidebar-w)', background: 'var(--bg-sidebar)' }}>

      {/* Logo */}
      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold mb-6"
        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 3px 10px rgba(99,102,241,0.4)' }}>
        EP
      </div>

      {/* Nav Icons */}
      <nav className="flex-1 flex flex-col items-center gap-1">
        {nav.map(item => {
          const active = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
          return (
            <NavLink key={item.path} to={item.path} title={item.label}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150"
              style={{
                background: active ? 'var(--bg-sidebar-active)' : 'transparent',
                color: active ? '#fff' : 'var(--text-sidebar)',
              }}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.6}>
                <path strokeLinecap="round" strokeLinejoin="round" d={item.d} />
              </svg>
            </NavLink>
          );
        })}
      </nav>

      {/* Status */}
      <div className="w-2 h-2 rounded-full mb-2" style={{ background: 'var(--success)' }} title="Connected" />
    </aside>
  );
}
