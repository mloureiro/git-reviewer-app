import { NavLink, Outlet } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useZoom } from '../hooks/useZoom';

export function Layout() {
  const { theme, toggleTheme } = useTheme();
  const { zoom, zoomIn, zoomOut, zoomReset } = useZoom();

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
          <div className="zoom-controls">
            <button
              className="zoom-controls__btn"
              onClick={zoomOut}
              title="Zoom out (Cmd+-)"
              aria-label="Zoom out"
            >
              −
            </button>
            <button
              className="zoom-controls__level"
              onClick={zoomReset}
              title="Reset zoom (Cmd+0)"
              aria-label={`Zoom level: ${Math.round(zoom * 100)}%`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="zoom-controls__btn"
              onClick={zoomIn}
              title="Zoom in (Cmd+=)"
              aria-label="Zoom in"
            >
              +
            </button>
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
