import { NavLink, Outlet } from 'react-router-dom';

export function Layout() {
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
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
