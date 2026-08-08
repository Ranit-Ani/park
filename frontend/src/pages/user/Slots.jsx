import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import InfiniteSentinel from '../../components/InfiniteSentinel';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { useInfiniteList } from '../../lib/useInfiniteList';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

export default function UserSlots() {
  const [filterType, setFilterType] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [counts, setCounts] = useState({ Available: '--', Booked: '--', Occupied: '--', total: '--' });
  const [alert, setAlert] = useState({ message: '', type: 'info' });

  const [selSlot, setSelSlot] = useState(null);
  const [savedVehicles, setSavedVehicles] = useState([]);
  const [vehicleChoice, setVehicleChoice] = useState(''); // saved vehicle _id, or '' = new vehicle
  const [vehicleCategory, setVehicleCategory] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [registrationPending, setRegistrationPending] = useState(false);
  const [saveVehicle, setSaveVehicle] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [invalidField, setInvalidField] = useState(null); // 'category' | 'number' | null

  const buildUrl = useCallback((page, limit) => {
    let url = `/slots/all?page=${page}&limit=${limit}`;
    if (filterType) url += `&type=${encodeURIComponent(filterType)}`;
    if (filterLoc) url += `&search=${encodeURIComponent(filterLoc)}`;
    return url;
  }, [filterType, filterLoc]);

  // Slots load a page at a time and grow as the user scrolls, instead of
  // pulling every slot in the system at once.
  const { items: slotsLoaded, loading, loadingMore, hasMore, loadMore, refresh } =
    useInfiniteList(buildUrl, [filterType, filterLoc], 30);
  const slots = loading && slotsLoaded.length === 0 ? null : slotsLoaded;

  const loadStats = useCallback(async () => {
    const stats = await apiRequest('/slots/stats');
    if (stats && stats.success) setCounts(stats.data);
  }, []);

  useEffect(() => {
    loadStats();

    // Live sync: whenever anyone books/cancels, or staff checks a vehicle
    // in/out, or an admin adds/edits/removes a slot, every open tab
    // refreshes instantly — no manual refresh needed.
    const socket = getSocket();
    const onChange = () => { loadStats(); refresh(); };
    socket.on('slotUpdated', onChange);
    socket.on('slotDeleted', onChange);

    // Safety-net poll in case a socket event is ever missed (e.g. brief
    // disconnect on Render's free tier during a cold start).
    const t = setInterval(onChange, 60000);

    return () => {
      clearInterval(t);
      socket.off('slotUpdated', onChange);
      socket.off('slotDeleted', onChange);
    };
  }, [loadStats, refresh]);

  async function selectSlot(s) {
    setVehicleCategory('');
    setVehicleNumber('');
    setRegistrationPending(false);
    setSaveVehicle(false);
    setVehicleChoice('');
    setAlert({ message: '', type: 'info' });
    setInvalidField(null);
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

  function pulseInvalid(field) {
    // Clear first so the class un-mounts, then re-apply next frame — this
    // lets the blink replay even if the same field was already flagged
    // from a previous click.
    setInvalidField(null);
    requestAnimationFrame(() => setInvalidField(field));
  }

  async function confirmBooking() {
    if (!selSlot) return;

    const body = { slotId: selSlot._id };

    if (vehicleChoice) {
      body.vehicleId = vehicleChoice;
    } else {
      if (!vehicleCategory) {
        pulseInvalid('category');
        return setAlert({ message: 'Select a vehicle category.', type: 'warning' });
      }
      if (!registrationPending && !vehicleNumber.trim()) {
        pulseInvalid('number');
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
      refresh(); loadStats();
    } else {
      setAlert({ message: (data && data.message) || 'Booking failed.', type: 'danger' });
    }
  }

  return (
    <Layout title="Orbital Slot Map">

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card green"><div className="stat-label">Available</div><div className="stat-value">{counts.Available}</div></div>
        <div className="stat-card orange"><div className="stat-label">Booked</div><div className="stat-value">{counts.Booked}</div></div>
        <div className="stat-card red"><div className="stat-label">Occupied</div><div className="stat-value">{counts.Occupied}</div></div>
        <div className="stat-card cyan"><div className="stat-label">Total</div><div className="stat-value">{counts.total}</div></div>
      </div>

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
          <button className="btn-ag primary" onClick={refresh}><i className="bi bi-search" /> Scan Slots</button>
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

      {slots && slots.length > 0 && (
        <InfiniteSentinel onVisible={loadMore} hasMore={hasMore} loading={loadingMore} />
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
            <Alert message={alert.message} type={alert.type} />
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
                  <select
                    className={`ag-select${invalidField === 'category' ? ' field-blink-error' : ''}`}
                    value={vehicleCategory}
                    onChange={(e) => { setVehicleCategory(e.target.value); setInvalidField(null); }}
                    required
                  >
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
                  <div className="ag-input-icon">
                    <i className="bi bi-car-front" />
                    <input
                      className={`ag-input${invalidField === 'number' ? ' field-blink-error' : ''}`}
                      type="text"
                      placeholder="e.g. WB 02 AB 1234"
                      value={registrationPending ? '' : vehicleNumber}
                      onChange={(e) => { setVehicleNumber(e.target.value.toUpperCase()); setInvalidField(null); }}
                      disabled={registrationPending}
                      required={!registrationPending}
                      style={registrationPending ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                    />
                  </div>
                  <label className="ag-check-row">
                    <input
                      type="checkbox"
                      checked={registrationPending}
                      onChange={(e) => { setRegistrationPending(e.target.checked); setInvalidField(null); }}
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
              <i className="bi bi-info-circle" /> Booking is for right now. You have 1 hour to check in before it auto-expires and the slot is released. Min 1-hour billing; final bill calculated at check-out.
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}