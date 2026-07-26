import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import OtpInput from '../components/OtpInput';
import { ActionButton } from '../components/Bits';
import { apiRequest, getToken, getUser } from '../lib/api';
import { homeForRole } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: 'info' });

  // Forgot-password modal state
  const [fpOpen, setFpOpen] = useState(false);
  const [fpStep, setFpStep] = useState(1);
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPwd, setFpNewPwd] = useState('');
  const [fpConfPwd, setFpConfPwd] = useState('');
  const [fpBusy, setFpBusy] = useState(false);
  const [fpAlert, setFpAlert] = useState({ message: '', type: 'info' });

  useEffect(() => {
    const t = getToken(), u = getUser();
    if (t && u) navigate(homeForRole(u.role), { replace: true });
  }, [navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    const data = await apiRequest('/auth/login', { method: 'POST', body: { email, password } });
    setBusy(false);
    if (data && data.success) {
      login(data.token, data.user);
      setAlert({ message: 'Identity confirmed. Launching...', type: 'success' });
      setTimeout(() => navigate(homeForRole(data.user.role), { replace: true }), 800);
    } else {
      setAlert({ message: (data && data.message) || 'Authentication failed.', type: 'danger' });
    }
  }

  function openForgot() {
    setFpStep(1);
    setFpEmail(''); setFpOtp(''); setFpNewPwd(''); setFpConfPwd('');
    setFpAlert({ message: '', type: 'info' });
    setFpOpen(true);
  }

  async function fpSend() {
    if (!fpEmail.trim()) return setFpAlert({ message: 'Enter your email address.', type: 'warning' });
    setFpBusy(true);
    const d = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: fpEmail.trim() } });
    setFpBusy(false);
    if (d && d.success) {
      setFpStep(2);
      setFpAlert({ message: '', type: 'info' });
    } else {
      setFpAlert({ message: (d && d.message) || 'Failed to send.', type: 'danger' });
    }
  }

  async function fpReset() {
    if (fpOtp.length < 6) return setFpAlert({ message: 'Enter all 6 digits of the reset code.', type: 'warning' });
    if (!fpNewPwd || fpNewPwd.length < 6) return setFpAlert({ message: 'Password must be at least 6 characters.', type: 'warning' });
    if (fpNewPwd !== fpConfPwd) return setFpAlert({ message: 'Passwords do not match.', type: 'danger' });
    setFpBusy(true);
    const d = await apiRequest('/auth/reset-password', { method: 'POST', body: { email: fpEmail.trim(), otp: fpOtp, newPassword: fpNewPwd } });
    setFpBusy(false);
    if (d && d.success) {
      setFpOpen(false);
      setAlert({ message: 'Password reset successful! You can now log in.', type: 'success' });
    } else {
      setFpAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  return (
    <>
      <ThreeBackground />
      <div className="auth-wrapper">
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', color: 'var(--t2)', textDecoration: 'none', marginBottom: '1.2rem', fontFamily: "'Syne',sans-serif", letterSpacing: '.08em' }}>
            <i className="bi bi-arrow-left" /> BACK TO BASE
          </Link>

          <div className="auth-card">
            <div className="auth-logo">
              <div className="logo-icon"><i className="bi bi-shield-lock-fill" /></div>
              <h1>SYSTEM ACCESS</h1>
              <p>Smart Campus Car-Parking</p>
            </div>

            <Alert message={alert.message} type={alert.type} />

            <form onSubmit={handleSubmit} autoComplete="off">
              <div className="ag-input-group">
                <label className="ag-label">Email Address</label>
                <div className="ag-input-icon">
                  <i className="bi bi-at" />
                  <input className="ag-input" type="email" placeholder="user@campus.edu" required value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <div className="ag-input-icon">
                    <i className="bi bi-lock" />
                    <input
                      className="ag-input" type={showPwd ? 'text' : 'password'} placeholder="Enter password" required
                      style={{ paddingRight: '2.8rem' }} value={password} onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <button
                    type="button" onClick={() => setShowPwd((v) => !v)}
                    style={{ position: 'absolute', right: '.8rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '.95rem', padding: 0, lineHeight: 1 }}
                  >
                    <i className={`bi ${showPwd ? 'bi-eye-slash' : 'bi-eye'}`} />
                  </button>
                </div>
                <div style={{ textAlign: 'right', marginTop: '.4rem' }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); openForgot(); }} style={{ fontSize: '.76rem', color: 'rgba(0,240,255,.6)', textDecoration: 'none', fontFamily: "'Syne',sans-serif", letterSpacing: '.05em' }}>
                    Forgot password?
                  </a>
                </div>
              </div>
              <ActionButton type="submit" busy={busy} busyLabel="Authenticate" className="btn-ag primary full lg" style={{ marginTop: '.3rem' }}>
                <i className="bi bi-shield-check" /> Authenticate
              </ActionButton>
            </form>

            <hr className="auth-divider" />
            <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--t2)' }}>
              New to the network? <Link to="/register" style={{ color: 'var(--plasma)', textDecoration: 'none', fontWeight: 600 }}>Create account</Link>
            </p>
          </div>
        </div>
      </div>

      <Modal
        show={fpOpen}
        onClose={() => setFpOpen(false)}
        title="Reset Password"
        icon="bi-key"
        size="sm"
      >
        <Alert message={fpAlert.message} type={fpAlert.type} />

        {fpStep === 1 && (
          <>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', marginBottom: '1rem' }}>
              Enter your registered email. We'll send a 6-digit reset code.
            </p>
            <div className="ag-input-group">
              <label className="ag-label">Email Address</label>
              <div className="ag-input-icon">
                <i className="bi bi-at" />
                <input className="ag-input" type="email" placeholder="your@email.com" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} />
              </div>
            </div>
            <ActionButton busy={fpBusy} busyLabel="Sending..." className="btn-ag primary full" onClick={fpSend}>
              <i className="bi bi-send" /> Send Reset Code
            </ActionButton>
          </>
        )}

        {fpStep === 2 && (
          <>
            <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--t2)', marginBottom: '1.1rem' }}>
              Code sent to <strong style={{ color: 'var(--plasma)', wordBreak: 'break-all' }}>{fpEmail}</strong>
            </p>
            <div className="ag-input-group" style={{ marginBottom: '1.1rem' }}>
              <span className="otp-label">6-Digit Reset Code</span>
              <OtpInput value={fpOtp} onChange={setFpOtp} autoFocus />
            </div>
            <div className="ag-input-group">
              <label className="ag-label">New Password</label>
              <div className="ag-input-icon">
                <i className="bi bi-lock-fill" />
                <input className="ag-input" type="password" placeholder="Min 6 characters" minLength={6} value={fpNewPwd} onChange={(e) => setFpNewPwd(e.target.value)} />
              </div>
            </div>
            <div className="ag-input-group">
              <label className="ag-label">Confirm Password</label>
              <div className="ag-input-icon">
                <i className="bi bi-lock-fill" />
                <input className="ag-input" type="password" placeholder="Repeat new password" value={fpConfPwd} onChange={(e) => setFpConfPwd(e.target.value)} />
              </div>
            </div>
            <ActionButton busy={fpBusy} busyLabel="Resetting..." className="btn-ag aurora full" onClick={fpReset}>
              <i className="bi bi-shield-check" /> Reset Password
            </ActionButton>
            <div style={{ textAlign: 'center', marginTop: '.7rem' }}>
              <a href="#" onClick={(e) => { e.preventDefault(); setFpStep(1); fpSend(); }} style={{ fontSize: '.76rem', color: 'rgba(0,240,255,.6)', textDecoration: 'none', fontFamily: "'Syne',sans-serif", letterSpacing: '.04em' }}>
                <i className="bi bi-arrow-clockwise" style={{ fontSize: '.7rem' }} /> Resend code
              </a>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
