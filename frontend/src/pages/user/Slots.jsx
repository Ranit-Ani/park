import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

export default function UserSlots() {
  const [filterType, setFilterType] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [slots, setSlots] = useState(null); // null = loading
  const [counts, setCounts] = useState({ Available: '--', Booked: '--', Occupied: '--', total: '--' });
  const [alert, setAlert] = useState({ message: '', type: 'info' });
  const [insights, setInsights] = useState(null);
  const [scanBusy, setScanBusy] = useState(false);

  const [selSlot, setSelSlot] = useState(null);
  const [savedVehicles, setSavedVehicles] = useState([]);
  const [vehicleChoice, setVehicleChoice] = useState(''); // saved vehicle _id, or '' = new vehicle
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [registrationPending, setRegistrationPending] = useState(false);
  const [saveVehicle, setSaveVehicle] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(async () => {
    const [all, stats] = await Promise.all([apiRequest('/slots/all'), apiRequest('/slots/stats')]);
    if (stats && stats.success) setCounts(stats.data);
    if (!all || !all.success) return setSlots([]);
    let list = all.data;
    if (filterType) list = list.filter((s) => s.slotType === filterType);
    if (filterLoc) list = list.filter((s) => s.location.toLowerCase().includes(filterLoc.toLowerCase()));
    setSlots(list);
  }, [filterType, filterLoc]);

  useEffect(() => {
    apiRequest('/slots/insights').then((d) => { if (d && d.success) setInsights(d.data); });
  }, []);

  useEffect(() => {
    load();

    // Live sync: whenever anyone books/cancels, or staff checks a vehicle
    // in/out, or an admin adds/edits/removes a slot, every open tab
    // refreshes instantly — no manual refresh needed.
    const socket = getSocket();
    socket.on('slotUpdated', load);
    socket.on('slotDeleted', load);

    // Safety-net poll in case a socket event is ever missed (e.g. brief
    // disconnect on Render's free tier during a cold start).
    const t = setInterval(load, 60000);

    return () => {
      clearInterval(t);
      socket.off('slotUpdated', load);
      socket.off('slotDeleted', load);
    };
  }, [load]);

  async function selectSlot(s) {
    setVehicleCategory('');
    setVehicleNumber('');
    setRegistrationPending(false);
    setSaveVehicle(false);
    setVehicleChoice('');
    setSelSlot(s);

    // Load the user's saved vehicles so they can pick one instead of
    // re-typing details every time (Rule 3).
    const d = await apiRequest('/auth/vehicles');
    if (d && d.success) {
      setSavedVehicles(d.data);
      if (d.data.length > 0) setVehicleChoice(d.data[0]._id);
    }
  }

  function pickVehicle(id) {
    setVehicleChoice(id);
    if (id) {
      setVehicleCategory('');
      setVehicleNumber('');
      setRegistrationPending(false);
    }
  }

  async function confirmBooking() {
    if (!selSlot) return;

    const body = { slotId: selSlot._id };

    if (vehicleChoice) {
      body.vehicleId = vehicleChoice;
    } else {
      if (!vehicleCategory) return setAlert({ message: 'Select a vehicle category.', type: 'warning' });
      if (!registrationPending && !vehicleNumber.trim()) {
        return setAlert({ message: 'Enter your vehicle registration number, or check "Registration Pending".', type: 'warning' });
      }
      body.vehicleCategory = vehicleCategory;
      body.vehicleNumber = registrationPending ? null : vehicleNumber.trim();
      body.registrationPending = registrationPending;
      body.saveVehicle = saveVehicle;
    }

    setConfirmBusy(true);
    const data = await apiRequest('/bookings', { method: 'POST', body });
    setConfirmBusy(false);
    setSelSlot(null);
    if (data && data.success) {
      showToast('Slot ' + selSlot.slotNumber + ' booked! Check in within 1 hour.', 'success');
      load();
    } else {
      setAlert({ message: (data && data.message) || 'Booking failed.', type: 'danger' });
    }
  }

  function hourLabel(h) {
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12} ${period}`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function scanPlate(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file next time
    if (!file) return;

    setScanBusy(true);
    setAlert({ message: '', type: 'info' });
    try {
      const imageBase64 = await fileToBase64(file);
      const d = await apiRequest('/ai/scan-plate', { method: 'POST', body: { imageBase64, mediaType: file.type || 'image/jpeg' } });
      if (d && d.success && d.data.plateNumber) {
        setVehicleNumber(d.data.plateNumber);
        setRegistrationPending(false);
        if (d.data.vehicleCategoryGuess && !vehicleCategory) setVehicleCategory(d.data.vehicleCategoryGuess);
        if (d.data.confidence === 'low') setAlert({ message: 'Plate scanned, but I\'m not fully confident — please double-check it.', type: 'warning' });
      } else {
        setAlert({ message: (d && d.message) || "Couldn't read a plate in that photo. Try a clearer shot or type it in.", type: 'warning' });
      }
    } finally {
      setScanBusy(false);
    }
  }

  return (
    <Layout title="Orbital Slot Map">
      <Alert message={alert.message} type={alert.type} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card green"><div className="stat-label">Available</div><div className="stat-value">{counts.Available}</div></div>
        <div className="stat-card orange"><div className="stat-label">Booked</div><div className="stat-value">{counts.Booked}</div></div>
        <div className="stat-card red"><div className="stat-label">Occupied</div><div className="stat-value">{counts.Occupied}</div></div>
        <div className="stat-card cyan"><div className="stat-label">Total</div><div className="stat-value">{counts.total}</div></div>
      </div>

      {insights && insights.peakHours.length > 0 && (
        <div className="ag-alert info" style={{ marginBottom: '1.25rem', fontSize: '0.8rem' }}>
          <i className="bi bi-stars" />
          Usually busiest around <strong>{insights.peakHours.map((h) => hourLabel(h.hour)).join(', ')}</strong>
          {insights.quietHours.length > 0 && <> — quietest around <strong>{insights.quietHours.map((h) => hourLabel(h.hour)).join(', ')}</strong></>}.
        </div>
      )}

      <div className="ag-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Slot Type</label>
            <select className="ag-select" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="">All Types</option>
              <option value="standard">Standard</option>
              <option value="faculty">Faculty</option>
              <option value="disabled">Disabled</option>
              <option value="ev">EV Charging</option>
            </select>
          </div>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Location</label>
            <input className="ag-input" type="text" placeholder="e.g. Block A" value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} />
          </div>
          <button className="btn-ag primary" onClick={load}><i className="bi bi-search" /> Scan Slots</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--neon-green)', marginRight: 4 }} />Available — Click to book now</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ffc107', marginRight: 4 }} />Booked</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--neon-orange)', marginRight: 4 }} />Occupied</span>
      </div>

      {slots === null ? (
        <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Scanning for available slots...</div>
      ) : slots.length === 0 ? (
        <EmptyState icon="bi-search">No slots found.</EmptyState>
      ) : (
        <div className="slot-grid">
          {slots.map((s) => (
            <div
              key={s._id}
              className={`slot-tile ${s.status.toLowerCase()}`}
              onClick={() => s.status === 'Available' && selectSlot(s)}
            >
              <div className="slot-number">{s.slotNumber}</div>
              <div className="slot-type">{s.slotType}</div>
              <div className="slot-rate">₹{s.hourlyRate}/hr</div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', marginTop: '0.25rem' }}>{s.location}</div>
              {s.status === 'Available' && (
                <div style={{ fontSize: '0.65rem', color: 'var(--neon-green)', marginTop: '0.3rem', letterSpacing: '0.05em' }}>TAP TO BOOK NOW</div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        show={!!selSlot}
        onClose={() => setSelSlot(null)}
        title="Confirm Booking"
        icon="bi-calendar-check"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setSelSlot(null)}>Cancel</button>
            <ActionButton busy={confirmBusy} busyLabel="Booking..." className="btn-ag green" onClick={confirmBooking}>
              <i className="bi bi-check-circle" /> Confirm Booking
            </ActionButton>
          </>
        )}
      >
        {selSlot && (
          <>
            <div className="bill-receipt">
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', marginBottom: '0.3rem' }}>SELECTED SLOT</div>
              <div className="font-orbit" style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--neon-cyan)' }}>{selSlot.slotNumber}</div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>{selSlot.slotType} · {selSlot.location}</div>
            </div>
            <table className="bill-table">
              <tbody>
                <tr><td>Type</td><td>{selSlot.slotType}</td></tr>
                <tr><td>Location</td><td>{selSlot.location}</td></tr>
                <tr><td>Rate</td><td>₹{selSlot.hourlyRate}/hour</td></tr>
                <tr><td>Booking Time</td><td>{new Date().toLocaleString('en-IN')} (now)</td></tr>
              </tbody>
            </table>

            <div className="ag-input-group" style={{ marginTop: '1rem' }}>
              <label className="ag-label">Vehicle</label>
              {savedVehicles.length > 0 && (
                <select className="ag-select" value={vehicleChoice} onChange={(e) => pickVehicle(e.target.value)}>
                  {savedVehicles.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.nickname ? v.nickname + ' — ' : ''}{v.category} · {v.registrationPending ? 'Registration Pending' : v.vehicleNumber}
                    </option>
                  ))}
                  <option value="">+ Use a new vehicle...</option>
                </select>
              )}
            </div>

            {!vehicleChoice && (
              <>
                <div className="ag-input-group">
                  <label className="ag-label">Vehicle Category</label>
                  <select className="ag-select" value={vehicleCategory} onChange={(e) => setVehicleCategory(e.target.value)} required>
                    <option value="">Select category...</option>
                    <option value="2 Wheeler">2 Wheeler</option>
                    <option value="3 Wheeler">3 Wheeler</option>
                    <option value="4 Wheeler">4 Wheeler</option>
                  </select>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-dim)', marginTop: '0.35rem' }}>
                    Buses, trucks, and other heavy vehicles are not supported.
                  </div>
                </div>
                <div className="ag-input-group">
                  <label className="ag-label">Vehicle Registration Number</label>
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'stretch' }}>
                    <div className="ag-input-icon" style={{ flex: 1 }}>
                      <i className="bi bi-car-front" />
                      <input
                        className="ag-input"
                        type="text"
                        placeholder="e.g. WB 02 AB 1234"
                        value={registrationPending ? '' : vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                        disabled={registrationPending}
                        required={!registrationPending}
                        style={registrationPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                      />
                    </div>
                    <label className={`btn-ag plasma sm ${registrationPending || scanBusy ? 'disabled' : ''}`} style={{ flexShrink: 0, cursor: registrationPending || scanBusy ? 'not-allowed' : 'pointer', opacity: registrationPending || scanBusy ? 0.5 : 1 }}>
                      {scanBusy ? <span className="spinner-border-sm" /> : <i className="bi bi-camera" />}
                      <input type="file" accept="image/*" capture="environment" onChange={scanPlate} disabled={registrationPending || scanBusy} style={{ display: 'none' }} />
                    </label>
                  </div>
                  <label className="ag-check-row">
                    <input
                      type="checkbox"
                      checked={registrationPending}
                      onChange={(e) => setRegistrationPending(e.target.checked)}
                    />
                    <span>Registration Pending (New Vehicle)</span>
                  </label>
                  <label className="ag-check-row">
                    <input
                      type="checkbox"
                      checked={saveVehicle}
                      onChange={(e) => setSaveVehicle(e.target.checked)}
                    />
                    <span>Save this vehicle to my account</span>
                  </label>
                </div>
              </>
            )}

            <div className="ag-alert info" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
              <i className="bi bi-info-circle" /> Booking is for right now. You have <strong>1 hour</strong> to check in before it auto-expires and the slot is released. Min 1-hour billing; final bill calculated at check-out.
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}
