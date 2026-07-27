import { useState } from 'react';
import Sidebar from './Sidebar';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps every authenticated page: sidebar + top bar + `.page-content`.
 * `title` -> top-bar-title text. `badge` -> optional badge on the right
 * (defaults to the current user's role badge, matching the original pages).
 */
export default function Layout({ title, badge, badgeClass, right, children }) {
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <>
      <Sidebar open={navOpen} onNavigate={() => setNavOpen(false)} />
      {navOpen && <div className="sidebar-overlay" onClick={() => setNavOpen(false)} />}
      <div className="main-content">
        <div className="top-bar">
          <button
            type="button"
            className="mobile-menu-btn"
            aria-label="Toggle menu"
            onClick={() => setNavOpen((v) => !v)}
          >
            <i className={`bi ${navOpen ? 'bi-x-lg' : 'bi-list'}`} />
          </button>
          <span className="top-bar-title">{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {right}
            {badge !== false && user && (
              <span className={`ag-badge ${badgeClass || user.role}`}>{badge || user.role}</span>
            )}
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="page-header">
      <div>
        <h5>{title}</h5>
        <small>{subtitle}</small>
      </div>
      {action}
    </div>
  );
}