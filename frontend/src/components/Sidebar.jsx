import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV = {
  user: {
    sub: 'Student Portal',
    home: '/user/dashboard',
    sections: [
      {
        label: 'Navigation',
        links: [
          { to: '/user/dashboard', icon: 'bi-speedometer2', text: 'Dashboard' },
          { to: '/user/slots', icon: 'bi-grid-3x3-gap-fill', text: 'Slots & Booking' },
          { to: '/user/bookings', icon: 'bi-list-check', text: 'My Bookings' },
        ],
      },
      { label: 'Account', links: [{ to: '/profile', icon: 'bi-person-gear', text: 'My Profile' }] },
    ],
  },
  staff: {
    sub: 'Staff Console',
    home: '/staff/dashboard',
    sections: [
      {
        label: 'Operations',
        links: [
          { to: '/staff/dashboard', icon: 'bi-speedometer2', text: 'Dashboard' },
          { to: '/staff/checkin', icon: 'bi-box-arrow-in-right', text: 'Check-In' },
          { to: '/staff/checkout', icon: 'bi-box-arrow-right', text: 'Check-Out' },
          { to: '/staff/bookings', icon: 'bi-list-check', text: 'All Bookings' },
        ],
      },
      { label: 'Account', links: [{ to: '/profile', icon: 'bi-person-gear', text: 'My Profile' }] },
    ],
  },
  admin: {
    sub: 'Admin Command',
    home: '/admin/dashboard',
    sections: [
      {
        label: 'Command Center',
        links: [
          { to: '/admin/dashboard', icon: 'bi-speedometer2', text: 'Dashboard' },
          { to: '/admin/slots', icon: 'bi-grid-3x3-gap-fill', text: 'Manage Slots' },
          { to: '/admin/users', icon: 'bi-people-fill', text: 'Manage Users' },
          { to: '/admin/revenue', icon: 'bi-graph-up-arrow', text: 'Revenue' },
          { to: '/admin/bookings', icon: 'bi-list-check', text: 'All Bookings' },
        ],
      },
      { label: 'Account', links: [{ to: '/profile', icon: 'bi-person-gear', text: 'My Profile' }] },
    ],
  },
};

export default function Sidebar({ open, onNavigate }) {
  const { user, logout } = useAuth();
  const [showPreview, setShowPreview] = useState(false);
  if (!user) return null;

  const cfg = NAV[user.role] || NAV.user;
  const isAdmin = user.role === 'admin';
  const closeNav = () => onNavigate && onNavigate();

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <NavLink className="sidebar-brand" to={cfg.home} onClick={closeNav}>
          <div className="brand-icon" style={isAdmin ? { background: 'linear-gradient(135deg,#ff2d55,#cc0033)', boxShadow: '0 0 20px rgba(255,45,85,0.4)' } : undefined}>
            <i className={`bi ${isAdmin ? 'bi-shield-lock-fill' : 'bi-p-square-fill'}`} />
          </div>
          <div>
            <div className="brand-text">AG PARKING</div>
            <div className="brand-sub">{cfg.sub}</div>
          </div>
        </NavLink>

        <nav className="sidebar-nav">
          {cfg.sections.map((section) => (
            <div key={section.label}>
              <span className="nav-section">{section.label}</span>
              {section.links.map((l) => (
                <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? 'active' : '')} onClick={closeNav}>
                  <i className={`bi ${l.icon}`} /> {l.text}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div
              className="sidebar-avatar"
              style={isAdmin ? { background: 'linear-gradient(135deg,#ff2d55,#cc0033)' } : undefined}
              onClick={() => setShowPreview(true)}
              title="View / edit profile"
            >
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, borderRadius: 'inherit' }} />
              ) : (
                user.name.charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <div className="sidebar-user-name">{user.name}</div>
              <div className="sidebar-user-role">{user.role}</div>
            </div>
          </div>
          <a href="#" className="btn-logout" onClick={(e) => { e.preventDefault(); closeNav(); logout(); }}>
            <i className="bi bi-box-arrow-right" /> Log Out
          </a>
        </div>
      </aside>

      {showPreview && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPreview(false); }}
        >
          <div style={{ background: '#0e1117', border: '1px solid rgba(200,200,200,.18)', borderRadius: 20, padding: '2rem', textAlign: 'center', maxWidth: 300, width: '90%', position: 'relative' }}>
            <button
              onClick={() => setShowPreview(false)}
              style={{ position: 'absolute', top: '.7rem', right: '.8rem', background: 'none', border: 'none', color: 'rgba(255,255,255,.5)', fontSize: '1.4rem', cursor: 'pointer', lineHeight: 1 }}
            >&times;</button>
            {user.profilePhoto ? (
              <img src={user.profilePhoto} alt="" style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(200,200,200,.4)', marginBottom: '1rem', display: 'block', marginLeft: 'auto', marginRight: 'auto' }} />
            ) : (
              <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg,#6c63ff,#00f0ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.8rem', fontWeight: 700, color: 'white', margin: '0 auto 1rem', border: '3px solid rgba(200,200,200,.3)' }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div style={{ fontSize: '1rem', fontWeight: 600, color: 'white', marginBottom: '.25rem' }}>{user.name}</div>
            <div style={{ fontSize: '.7rem', color: 'rgba(200,200,200,.8)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>{user.role}</div>
            <NavLink
              to="/profile"
              onClick={() => setShowPreview(false)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', background: 'rgba(200,200,200,.1)', border: '1px solid rgba(200,200,200,.25)', color: '#00f0ff', padding: '.45rem 1.2rem', borderRadius: 8, fontSize: '.82rem', textDecoration: 'none' }}
            >
              <i className="bi bi-person-gear" /> Edit Profile
            </NavLink>
          </div>
        </div>
      )}
    </>
  );
}