import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import { apiRequest, getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';

export default function Landing() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: '--', avail: '--', occ: '--' });

  useEffect(() => {
    const t = getToken(), u = getUser();
    if (t && u) {
      navigate(homeForRole(u.role), { replace: true });
      return;
    }
    (async () => {
      const d = await apiRequest('/slots/stats');
      if (d && d.success) {
        setStats({
          total: d.data.total,
          avail: d.data.Available || 0,
          occ: (d.data.Booked || 0) + (d.data.Occupied || 0),
        });
      }
    })();
  }, [navigate]);

  return (
    <>
      <ThreeBackground />

      <nav className="pub-nav">
        <Link className="pub-nav-brand" to="/">
          <div className="nav-logo"><i className="bi bi-p-square-fill" /></div>
          SMART CAMPUS CAR-PARKING
        </Link>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <Link to="/login" className="btn-ag ghost sm">Sign In</Link>
          <Link to="/register" className="btn-ag primary sm"><i className="bi bi-person-plus" /> Register</Link>
        </div>
      </nav>

      <section className="hero-section">
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680 }}>
          <div className="hero-badge"><span className="dot" /> QUANTUM CAMPUS INFRASTRUCTURE v2.0</div>
          <h1 className="hero-title display-title">SMART CAR<br />PARKING SYSTEM</h1>
          <p className="hero-sub">
            Zero-friction. Real-time. Role-based. The next generation campus parking infrastructure with
            automated billing and live slot tracking.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-ag primary lg"><i className="bi bi-rocket-takeoff" /> Join the Network</Link>
            <Link to="/login" className="btn-ag plasma lg"><i className="bi bi-shield-check" /> Authenticate</Link>
          </div>

          <div style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '3.5rem', flexWrap: 'wrap', animation: 'fadeUp .7s .4s both' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--plasma)' }}>{stats.total}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>Total Slots</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--aurora)' }}>{stats.avail}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>Available</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="font-orbit" style={{ fontSize: '1.9rem', fontWeight: 900, color: 'var(--nova)' }}>{stats.occ}</div>
              <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.12em', textTransform: 'uppercase', marginTop: '.2rem' }}>In Use</div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', zIndex: 1, paddingBottom: '6rem' }}>
        <div className="feature-grid">
          <div className="feature-card s1">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-broadcast-pin" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Live Slot Radar</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Real-time slot status with instant updates across all portals.</p>
          </div>
          <div className="feature-card s2">
            <div className="feature-icon" style={{ background: 'rgba(139,92,246,.1)', color: '#a78bfa' }}><i className="bi bi-shield-lock-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Email OTP Auth</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Secure account creation with email verification codes.</p>
          </div>
          <div className="feature-card s3">
            <div className="feature-icon" style={{ background: 'rgba(0,255,179,.08)', color: 'var(--aurora)' }}><i className="bi bi-calculator-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Zero-Error Billing</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Min 1-hour, auto round-up billing engine. No disputes.</p>
          </div>
          <div className="feature-card s4">
            <div className="feature-icon" style={{ background: 'rgba(255,184,0,.08)', color: 'var(--solar)' }}><i className="bi bi-person-gear" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Full Profile Control</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Avatar, email change (OTP verified), password, account deletion.</p>
          </div>
          <div className="feature-card s5">
            <div className="feature-icon" style={{ background: 'rgba(255,71,87,.08)', color: '#ff4757' }}><i className="bi bi-clock-history" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Full Booking History</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Track every booking, check-in/out time, and receipt in one place.</p>
          </div>
          <div className="feature-card s6">
            <div className="feature-icon" style={{ background: 'rgba(0,240,255,.08)', color: 'var(--plasma)' }}><i className="bi bi-diagram-3-fill" /></div>
            <h5 style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', letterSpacing: '.05em', marginBottom: '.5rem' }}>Role-Based Portals</h5>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', lineHeight: 1.65 }}>Dedicated dashboards for students, staff check-in/out, and admins.</p>
          </div>
        </div>
      </section>
    </>
  );
}