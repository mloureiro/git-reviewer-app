import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';

export function Layout() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="app">
      <header className="header">
        <nav className="nav">
          <NavLink to="/" className="nav-brand">
            git-reviewer
          </NavLink>
          <div className="nav-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              Sessions
            </NavLink>
            <NavLink
              to="/new"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              New Review
            </NavLink>
          </div>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
