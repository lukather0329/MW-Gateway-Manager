import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ActivityIcon,
  ArchiveIcon,
  ClockIcon,
  DashboardIcon,
  DeviceIcon,
  ListIcon,
  LogoMark,
  SettingsIcon,
  UsersIcon,
} from './Icons';

const NAV_ITEMS = [
  { to: '/', label: '대시보드', end: true, icon: DashboardIcon },
  { to: '/programs', label: '프로그램 관리', icon: ListIcon },
  { to: '/devices', label: '장비 관리', icon: DeviceIcon },
  { to: '/apache', label: 'Apache 상태', icon: ActivityIcon },
  { to: '/backups', label: '설정 백업', icon: ArchiveIcon },
  { to: '/audit-logs', label: '변경 이력', icon: ClockIcon },
  { to: '/settings', label: '시스템 설정', icon: SettingsIcon },
  { to: '/users', label: '사용자 관리', icon: UsersIcon },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <LogoMark />
          </span>
          <span className="brand-text">
            <span className="brand-title">MW Gateway Manager</span>
            <span className="brand-subtitle">Apache 관리</span>
          </span>
        </div>
        <nav>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <item.icon className="nav-icon" />
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
