import { useEffect, useRef, useState } from 'react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import OtpInput from '../components/OtpInput';
import { ActionButton } from '../components/Bits';
import { apiRequest } from '../lib/api';
import { formatDate } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const fileRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [name, setName] = useState('');
  const [photoBase64, setPhotoBase64] = useState(undefined); // undefined = unchanged
  const [preview, setPreview] = useState('');
  const [saveBusy, setSaveBusy] = useState(false);
  const [alert, setAlert] = useState({ message: '', type: 'info' });

  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confPwd, setConfPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);

  const [emailModal, setEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState(1);
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailAlert, setEmailAlert] = useState({ message: '', type: 'info' });

  const [deleteModal, setDeleteModal] = useState(false);
  const [deletePwd, setDeletePwd] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteAlert, setDeleteAlert] = useState({ message: '', type: 'info' });

  // ─── Saved Vehicles (Rule 3) ───────────────────────────────────────────────
  const [vehicles, setVehicles] = useState([]);
  const [vehicleModal, setVehicleModal] = useState(false);
  const [vCategory, setVCategory] = useState('');
  const [vNumber, setVNumber] = useState('');
  const [vPending, setVPending] = useState(false);
  const [vNickname, setVNickname] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const [vAlert, setVAlert] = useState({ message: '', type: 'info' });

  const isUserRole = user?.role === 'user';

  const loadVehicles = async () => {
    const d = await apiRequest('/auth/vehicles');
    if (d && d.success) setVehicles(d.data);
  };

  useEffect(() => { if (isUserRole) loadVehicles(); }, [isUserRole]);

  function openAddVehicle() {
    setVCategory(''); setVNumber(''); setVPending(false); setVNickname('');
    setVAlert({ message: '', type: 'info' });
    setVehicleModal(true);
  }

  async function saveNewVehicle() {
    if (!vCategory) return setVAlert({ message: 'Select a vehicle category.', type: 'warning' });
    if (!vPending && !vNumber.trim()) return setVAlert({ message: 'Enter a registration number, or mark as Registration Pending.', type: 'warning' });
    setVBusy(true);
    const d = await apiRequest('/auth/vehicles', {
      method: 'POST',
      body: { category: vCategory, vehicleNumber: vPending ? null : vNumber.trim(), registrationPending: vPending, nickname: vNickname.trim() || undefined },
    });
    setVBusy(false);
    if (d && d.success) {
      setVehicleModal(false);
      loadVehicles();
      setAlert({ message: 'Vehicle saved.', type: 'success' });
    } else {
      setVAlert({ message: (d && d.message) || 'Failed to save vehicle.', type: 'danger' });
    }
  }

  async function removeVehicle(id) {
    if (!confirm('Remove this vehicle from your account?')) return;
    const d = await apiRequest('/auth/vehicles/' + id, { method: 'DELETE' });
    if (d && d.success) { loadVehicles(); setAlert({ message: 'Vehicle removed.', type: 'success' }); }
    else setAlert({ message: (d && d.message) || 'Failed to remove vehicle.', type: 'danger' });
  }

  useEffect(() => {
    (async () => {
      const d = await apiRequest('/auth/me');
      if (d && d.success) {
        setProfile(d.user);
        setName(d.user.name);
        setPreview(d.user.profilePhoto || '');
      }
    })();
  }, []);

  function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAlert({ message: 'Photo must be under 2MB.', type: 'warning' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPhotoBase64(ev.target.result);
      setPreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  async function saveProfile(e) {
    e.preventDefault();
    setSaveBusy(true);
    const body = { name: name.trim() };
    if (photoBase64 !== undefined) body.profilePhoto = photoBase64;
    const d = await apiRequest('/auth/profile', { method: 'PUT', body });
    setSaveBusy(false);
    if (d && d.success) {
      updateUser(d.user);
      setProfile((p) => ({ ...p, ...d.user }));
      setAlert({ message: 'Profile updated successfully!', type: 'success' });
    } else {
      setAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (newPwd !== confPwd) return setAlert({ message: 'New passwords do not match.', type: 'danger' });
    setPwdBusy(true);
    const d = await apiRequest('/auth/change-password', { method: 'PUT', body: { currentPassword: curPwd, newPassword: newPwd } });
    setPwdBusy(false);
    if (d && d.success) {
      setAlert({ message: 'Password updated!', type: 'success' });
      setCurPwd(''); setNewPwd(''); setConfPwd('');
    } else {
      setAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  function openEmailChange() {
    setEmailStep(1);
    setNewEmail(''); setEmailOtp('');
    setEmailAlert({ message: '', type: 'info' });
    setEmailModal(true);
  }

  async function sendEmailOTP() {
    if (!newEmail.trim()) return setEmailAlert({ message: 'Enter a new email.', type: 'warning' });
    setEmailBusy(true);
    const d = await apiRequest('/auth/email-change/initiate', { method: 'POST', body: { newEmail: newEmail.trim() } });
    setEmailBusy(false);
    if (d && d.success) {
      setEmailStep(2);
    } else {
      setEmailAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  async function verifyEmailOTP() {
    if (emailOtp.length < 6) return setEmailAlert({ message: 'Enter all 6 digits.', type: 'warning' });
    setEmailBusy(true);
    const d = await apiRequest('/auth/email-change/verify', { method: 'POST', body: { otp: emailOtp } });
    setEmailBusy(false);
    if (d && d.success) {
      updateUser(d.user);
      setProfile((p) => ({ ...p, email: d.user.email }));
      setEmailModal(false);
      setAlert({ message: 'Email updated to ' + d.user.email, type: 'success' });
    } else {
      setEmailAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  async function doDelete() {
    if (!deletePwd) return setDeleteAlert({ message: 'Enter your password.', type: 'warning' });
    setDeleteBusy(true);
    const d = await apiRequest('/auth/account', { method: 'DELETE', body: { password: deletePwd } });
    setDeleteBusy(false);
    if (d && d.success) {
      logout();
    } else {
      setDeleteAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  if (!profile) return <Layout title="Operator Profile"><p style={{ color: 'var(--t2)' }}>Loading...</p></Layout>;

  return (
    <Layout title="Operator Profile" badge={false}>
      <Alert message={alert.message} type={alert.type} />
      <div className="profile-grid">

        <div className="ag-card ag-card-body">
          <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.4rem' }}>Identity</div>

          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div className="profile-avatar-wrap" onClick={() => fileRef.current?.click()}>
              {preview ? (
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
              ) : (
                <span>{profile.name.charAt(0).toUpperCase()}</span>
              )}
              <div className="profile-avatar-overlay"><i className="bi bi-camera-fill" style={{ fontSize: '1.1rem' }} /><span>Change</span></div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            <div style={{ fontSize: '.72rem', color: 'var(--t2)', fontFamily: "'Inter',sans-serif", letterSpacing: '.08em' }}>CLICK TO CHANGE PHOTO</div>
          </div>

          <form onSubmit={saveProfile}>
            <div className="ag-input-group">
              <label className="ag-label">Display Name</label>
              <div className="ag-input-icon"><i className="bi bi-person" /><input className="ag-input" type="text" required value={name} onChange={(e) => setName(e.target.value)} /></div>
            </div>
            <div className="ag-input-group">
              <label className="ag-label">Email</label>
              <div style={{ position: 'relative' }}>
                <div className="ag-input-icon"><i className="bi bi-at" /><input className="ag-input" type="email" disabled value={profile.email} style={{ opacity: .5, cursor: 'default', paddingRight: '5rem' }} /></div>
                <button type="button" className="btn-ag plasma sm" style={{ position: 'absolute', right: '.4rem', top: '50%', transform: 'translateY(-50%)' }} onClick={openEmailChange}>
                  <i className="bi bi-pencil" /> Change
                </button>
              </div>
            </div>
            <div className="ag-input-group">
              <label className="ag-label">Account Status</label>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.5rem 0' }}>
                <span className={`ag-badge ${profile.isEmailVerified ? 'verified' : 'unverified'}`}>{profile.isEmailVerified ? 'Verified' : 'Unverified'}</span>
                <span className={`ag-badge ${profile.role}`}>{profile.role}</span>
                <span style={{ fontSize: '.75rem', color: 'var(--t2)' }}>Since {formatDate(profile.createdAt)}</span>
              </div>
            </div>
            <ActionButton type="submit" busy={saveBusy} busyLabel="Saving..." className="btn-ag primary full">
              <i className="bi bi-cloud-upload" /> Save Changes
            </ActionButton>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="ag-card ag-card-body">
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1.2rem' }}>Security</div>
            <form onSubmit={savePassword}>
              <div className="ag-input-group">
                <label className="ag-label">Current Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock" /><input className="ag-input" type="password" placeholder="Enter current password" required value={curPwd} onChange={(e) => setCurPwd(e.target.value)} /></div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">New Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock-fill" /><input className="ag-input" type="password" placeholder="Min 6 characters" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)} /></div>
              </div>
              <div className="ag-input-group">
                <label className="ag-label">Confirm New Password</label>
                <div className="ag-input-icon"><i className="bi bi-lock-fill" /><input className="ag-input" type="password" placeholder="Repeat new password" required value={confPwd} onChange={(e) => setConfPwd(e.target.value)} /></div>
              </div>
              <ActionButton type="submit" busy={pwdBusy} busyLabel="Updating..." className="btn-ag aurora full">
                <i className="bi bi-shield-lock" /> Update Password
              </ActionButton>
            </form>
          </div>

          {isUserRole && (
            <div className="ag-card ag-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '.65rem', color: 'var(--t2)', letterSpacing: '.15em', textTransform: 'uppercase' }}>My Vehicles</div>
                <button type="button" className="btn-ag plasma sm" onClick={openAddVehicle}><i className="bi bi-plus-lg" /> Add Vehicle</button>
              </div>
              {vehicles.length === 0 ? (
                <p style={{ fontSize: '.82rem', color: 'var(--t2)' }}>No saved vehicles yet. Add one so you can pick it instantly when booking a slot.</p>
              ) : (
                <div
                  className="vehicle-list-scroll"
                  style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', height: '84px', overflowY: 'auto', paddingRight: '.4rem' }}
                >
                  {vehicles.map((v) => (
                    <div key={v._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '.6rem .8rem', border: '1px solid var(--t4)', borderRadius: '10px', flexShrink: 0 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                          {v.registrationPending ? <span className="ag-badge unverified">Pending</span> : v.vehicleNumber}
                        </div>
                        <small style={{ color: 'var(--t2)' }}>{v.nickname ? v.nickname + ' · ' : ''}{v.category}</small>
                      </div>
                      <button className="btn-ag red sm" onClick={() => removeVehicle(v._id)}><i className="bi bi-trash3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="ag-card ag-card-body" style={{ borderColor: 'rgba(176,72,63,.15)' }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontSize: '.65rem', color: 'var(--nova)', letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '1rem' }}>Danger Zone</div>
            <p style={{ fontSize: '.82rem', color: 'var(--t2)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="btn-ag nova full" onClick={() => { setDeletePwd(''); setDeleteAlert({ message: '', type: 'info' }); setDeleteModal(true); }}>
              <i className="bi bi-exclamation-triangle" /> Delete Account
            </button>
          </div>
        </div>
      </div>

      <Modal show={emailModal} onClose={() => setEmailModal(false)} title="Change Email" icon="bi-at" size="sm">
        <Alert message={emailAlert.message} type={emailAlert.type} />
        {emailStep === 1 && (
          <>
            <div className="ag-input-group">
              <label className="ag-label">New Email Address</label>
              <div className="ag-input-icon"><i className="bi bi-at" /><input className="ag-input" type="email" placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /></div>
            </div>
            <ActionButton busy={emailBusy} busyLabel="Sending..." className="btn-ag primary full" onClick={sendEmailOTP}>
              <i className="bi bi-send" /> Send Verification Code
            </ActionButton>
          </>
        )}
        {emailStep === 2 && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '.82rem', color: 'var(--t2)' }}>
              Code sent to <strong style={{ color: 'var(--plasma)' }}>{newEmail}</strong>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <OtpInput value={emailOtp} onChange={setEmailOtp} autoFocus />
            </div>
            <ActionButton busy={emailBusy} busyLabel="Confirming..." className="btn-ag aurora full" onClick={verifyEmailOTP}>
              <i className="bi bi-check-shield" /> Confirm Email Change
            </ActionButton>
          </>
        )}
      </Modal>

      <Modal
        show={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Account"
        icon="bi-exclamation-triangle"
        size="sm"
        headerStyle={{ background: 'linear-gradient(135deg,rgba(176,72,63,.12),rgba(122,46,40,.08))' }}
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
            <ActionButton busy={deleteBusy} busyLabel="Deleting..." className="btn-ag nova" onClick={doDelete}>
              <i className="bi bi-trash3" /> Delete Forever
            </ActionButton>
          </>
        )}
      >
        <Alert message={deleteAlert.message} type={deleteAlert.type} />
        <p style={{ fontSize: '.84rem', color: 'var(--t2)', marginBottom: '1rem' }}>This will permanently delete your account. Enter your password to confirm.</p>
        <div className="ag-input-group">
          <label className="ag-label">Password</label>
          <div className="ag-input-icon"><i className="bi bi-lock" /><input className="ag-input" type="password" placeholder="Your password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} /></div>
        </div>
      </Modal>

      {isUserRole && (
        <Modal
          show={vehicleModal}
          onClose={() => setVehicleModal(false)}
          title="Add Vehicle"
          icon="bi-car-front"
          size="sm"
          footer={(
            <>
              <button className="btn-ag ghost" onClick={() => setVehicleModal(false)}>Cancel</button>
              <ActionButton busy={vBusy} busyLabel="Saving..." className="btn-ag green" onClick={saveNewVehicle}>
                <i className="bi bi-check-circle" /> Save Vehicle
              </ActionButton>
            </>
          )}
        >
          <Alert message={vAlert.message} type={vAlert.type} />
          <div className="ag-input-group">
            <label className="ag-label">Category</label>
            <select className="ag-select" value={vCategory} onChange={(e) => setVCategory(e.target.value)}>
              <option value="">Select category...</option>
              <option value="2 Wheeler">2 Wheeler</option>
              <option value="3 Wheeler">3 Wheeler</option>
              <option value="4 Wheeler">4 Wheeler</option>
            </select>
          </div>
          <div className="ag-input-group">
            <label className="ag-label">Registration Number</label>
            <input
              className="ag-input"
              type="text"
              placeholder="e.g. WB 02 AB 1234"
              value={vPending ? '' : vNumber}
              onChange={(e) => setVNumber(e.target.value.toUpperCase())}
              disabled={vPending}
              style={vPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            />
            <label className="ag-check-row">
              <input type="checkbox" checked={vPending} onChange={(e) => setVPending(e.target.checked)} />
              <span>Registration Pending (New Vehicle)</span>
            </label>
          </div>
          <div className="ag-input-group">
            <label className="ag-label">Nickname (optional)</label>
            <input className="ag-input" type="text" placeholder="e.g. My Scooter" value={vNickname} onChange={(e) => setVNickname(e.target.value)} />
          </div>
        </Modal>
      )}
    </Layout>
  );
}