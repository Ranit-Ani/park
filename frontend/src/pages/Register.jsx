import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ThreeBackground from '../components/ThreeBackground';
import Alert from '../components/Alert';
import OtpInput from '../components/OtpInput';
import { ActionButton } from '../components/Bits';
import { apiRequest } from '../lib/api';
import { showToast } from '../lib/toast';
import { useAuth } from '../context/AuthContext';

const STRENGTH_LEVELS = [
  { w: '0%', c: 'var(--t4)', t: '' },
  { w: '25%', c: 'var(--nova)', t: 'Weak' },
  { w: '50%', c: 'var(--solar)', t: 'Fair' },
  { w: '75%', c: '#8be8cb', t: 'Good' },
  { w: '100%', c: 'var(--aurora)', t: 'Strong' },
];

function scoreStrength(v) {
  let s = 0;
  if (v.length >= 6) s++;
  if (v.length >= 10) s++;
  if (/[A-Z]/.test(v)) s++;
  if (/[0-9]/.test(v)) s++;
  if (/[^A-Za-z0-9]/.test(v)) s++;
  return STRENGTH_LEVELS[Math.min(s, 4)];
}

export default function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: 'info' });

  const [otp, setOtp] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [seconds, setSeconds] = useState(600);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef(null);

  const strength = scoreStrength(password);

  useEffect(() => () => clearInterval(timerRef.current), []);

  function startTimer(s) {
    clearInterval(timerRef.current);
    setSeconds(s);
    setExpired(false);
    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 0) {
          clearInterval(timerRef.current);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault();
    if (!name || !email || !password) return setAlert({ message: 'All fields are required.', type: 'warning' });
    if (password !== confirm) return setAlert({ message: 'Passwords do not match.', type: 'danger' });
    if (password.length < 6) return setAlert({ message: 'Password must be at least 6 characters.', type: 'warning' });

    setBusy(true);
    const d = await apiRequest('/auth/register/initiate', { method: 'POST', body: { name, email: email.toLowerCase(), password } });
    setBusy(false);

    if (d && d.success) {
      setStep(2);
      setOtp('');
      startTimer(600);
    } else {
      setAlert({ message: (d && d.message) || 'Failed to send code. Try again.', type: 'danger' });
    }
  }

  async function handleVerify() {
    if (otp.length < 6) return setAlert({ message: 'Please enter all 6 digits of the code.', type: 'warning' });
    setVerifyBusy(true);
    const d = await apiRequest('/auth/register/verify', { method: 'POST', body: { email: email.toLowerCase(), otp } });
    setVerifyBusy(false);

    if (d && d.success) {
      clearInterval(timerRef.current);
      login(d.token, d.user);
      setAlert({ message: 'Account activated! Launching...', type: 'success' });
      setTimeout(() => navigate('/user/dashboard', { replace: true }), 900);
    } else {
      setAlert({ message: (d && d.message) || 'Verification failed. Try again.', type: 'danger' });
    }
  }

  function goBack() {
    setStep(1);
    clearInterval(timerRef.current);
  }

  async function resendOTP() {
    const d = await apiRequest('/auth/register/initiate', { method: 'POST', body: { name, email: email.toLowerCase(), password } });
    if (d && d.success) {
      showToast('New code sent to ' + email, 'success');
      setOtp('');
      startTimer(600);
    } else {
      showToast((d && d.message) || 'Failed to resend.', 'danger');
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <>
      <ThreeBackground />
      <div className="auth-wrapper">
        <div style={{ width: '100%', maxWidth: 420 }}>
          <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem', color: 'var(--t2)', textDecoration: 'none', marginBottom: '1.2rem', fontFamily: "'Syne',sans-serif", letterSpacing: '.08em' }}>
            <i className="bi bi-arrow-left" /> BACK TO LOGIN
          </Link>

          <div className="auth-card">
            <div className="auth-logo">
              <div className="logo-icon"><i className="bi bi-person-plus-fill" /></div>
              <h1>NEW OPERATOR</h1>
              <p>Join the Smart Campus Network</p>
            </div>

            <div className="step-indicator">
              <div className={`step-dot ${step === 1 ? 'active' : 'done'}`} />
              <div className={`step-dot ${step === 2 ? 'active' : ''}`} />
            </div>

            <Alert message={alert.message} type={alert.type} />

            {step === 1 && (
              <div className="step active">
                <form onSubmit={handleRegisterSubmit} autoComplete="off">
                  <div className="ag-input-group">
                    <label className="ag-label">Full Name</label>
                    <div className="ag-input-icon">
                      <i className="bi bi-person" />
                      <input className="ag-input" type="text" placeholder="Your full name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                  </div>
                  <div className="ag-input-group">
                    <label className="ag-label">Email Address</label>
                    <div className="ag-input-icon">
                      <i className="bi bi-at" />
                      <input className="ag-input" type="email" placeholder="user@campus.edu" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                  </div>
                  <div className="ag-input-group">
                    <label className="ag-label">Password</label>
                    <div className="ag-input-icon">
                      <i className="bi bi-lock" />
                      <input className="ag-input" type="password" placeholder="Min 6 characters" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <div className="pwd-strength" style={{ width: strength.w, background: strength.c }} />
                    <div style={{ fontSize: '.68rem', color: strength.c, fontFamily: "'Syne',sans-serif" }}>{strength.t}</div>
                  </div>
                  <div className="ag-input-group">
                    <label className="ag-label">Confirm Password</label>
                    <div className="ag-input-icon">
                      <i className="bi bi-lock-fill" />
                      <input className="ag-input" type="password" placeholder="Repeat password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    </div>
                  </div>
                  <ActionButton type="submit" busy={busy} busyLabel="Sending..." className="btn-ag primary full lg">
                    <i className="bi bi-send" /> Send Verification Code
                  </ActionButton>
                </form>
                <hr className="auth-divider" />
                <p style={{ textAlign: 'center', fontSize: '.82rem', color: 'var(--t2)' }}>
                  Already have an account? <Link to="/login" style={{ color: 'var(--plasma)', textDecoration: 'none' }}>Sign in</Link>
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="step active">
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(0,255,179,.1)', border: '2px solid rgba(0,255,179,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto .8rem', fontSize: '1.3rem', color: 'var(--aurora)' }}>
                    <i className="bi bi-envelope-open" />
                  </div>
                  <div style={{ fontFamily: "'Exo 2',sans-serif", fontSize: '.88rem', fontWeight: 700, color: 'var(--t1)', marginBottom: '.3rem' }}>Check Your Inbox</div>
                  <div style={{ fontSize: '.8rem', color: 'var(--t2)' }}>We sent a 6-digit code to</div>
                  <div style={{ fontSize: '.88rem', color: 'var(--plasma)', fontWeight: 600, marginTop: '.2rem' }}>{email}</div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="ag-label" style={{ display: 'block', textAlign: 'center', marginBottom: '.8rem' }}>Enter Verification Code</label>
                  <OtpInput value={otp} onChange={setOtp} autoFocus />
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
                  {!expired ? (
                    <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.72rem', color: 'var(--t2)', letterSpacing: '.08em' }}>
                      CODE EXPIRES IN <span style={{ color: 'var(--solar)' }}>{mm}:{ss}</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: "'Syne',sans-serif", fontSize: '.72rem', letterSpacing: '.08em' }}>
                        <span style={{ color: 'var(--nova)' }}>CODE EXPIRED</span>
                      </div>
                      <button className="btn-ag ghost sm" style={{ marginTop: '.5rem' }} onClick={resendOTP}>
                        <i className="bi bi-arrow-clockwise" /> Resend Code
                      </button>
                    </>
                  )}
                </div>

                <ActionButton busy={verifyBusy} busyLabel="Verifying..." className="btn-ag aurora full lg" onClick={handleVerify}>
                  <i className="bi bi-check-shield" /> Verify &amp; Activate
                </ActionButton>
                <button type="button" className="btn-ag ghost full sm" style={{ marginTop: '.6rem' }} onClick={goBack}>
                  <i className="bi bi-arrow-left" /> Change Email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
