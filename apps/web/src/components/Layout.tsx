import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', end: true },
  { to: '/programs', label: '프로그램 관리' },
  { to: '/devices', label: '장비 관리' },
  { to: '/apache', label: 'Apache 상태' },
  { to: '/backups', label: '설정 백업' },
  { to: '/audit-logs', label: '변경 이력' },
  { to: '/settings', label: '시스템 설정' },
  { to: '/users', label: '사용자 관리' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">MW Gateway Manager</div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span>{user?.username}</span>
          <button type="button" className="btn" onClick={() => logout()}>
            로그아웃
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
