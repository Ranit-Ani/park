import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

function nowLocalDateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

export default function Book() {
  const [scheduledDate, setScheduledDate] = useState(nowLocalDateTime());
  const [filterType, setFilterType] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [slots, setSlots] = useState(null); // null = loading
  const [alert, setAlert] = useState({ message: '', type: 'info' });

  const [selSlot, setSelSlot] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const loadSlots = useCallback(async () => {
    setSlots(null);
    const data = await apiRequest('/slots/all');
    if (!data || !data.success) return setSlots([]);
    let list = data.data;
    if (filterType) list = list.filter((s) => s.slotType === filterType);
    if (filterLoc) list = list.filter((s) => s.location.toLowerCase().includes(filterLoc.toLowerCase()));
    setSlots(list);
  }, [filterType, filterLoc]);

  useEffect(() => {
    loadSlots();

    // Live sync: whenever anyone books/cancels, or staff checks a vehicle
    // in/out, refresh this grid instantly so the slot's color/status is
    // always current — matches the behavior already on the Slots page.
    const socket = getSocket();
    socket.on('slotUpdated', loadSlots);
    socket.on('slotDeleted', loadSlots);

    const t = setInterval(loadSlots, 60000); // safety-net poll
    return () => {
      clearInterval(t);
      socket.off('slotUpdated', loadSlots);
      socket.off('slotDeleted', loadSlots);
    };
  }, [loadSlots]);

  function selectSlot(s) {
    if (!scheduledDate) return setAlert({ message: 'Select a date first.', type: 'warning' });
    setSelSlot(s);
  }

  async function confirmBooking() {
    if (!selSlot) return;
    setConfirmBusy(true);
    const data = await apiRequest('/bookings', { method: 'POST', body: { slotId: selSlot._id, scheduledDate } });
    setConfirmBusy(false);
    setSelSlot(null);
    if (data && data.success) {
      showToast('Slot ' + selSlot.slotNumber + ' booked!', 'success');
      loadSlots();
    } else {
      setAlert({ message: (data && data.message) || 'Booking failed.', type: 'danger' });
    }
  }

  return (
    <Layout title="Book a Slot">
      <Alert message={alert.message} type={alert.type} />

      <div className="ag-card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Scheduled Date &amp; Time</label>
            <input className="ag-input" type="datetime-local" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
          </div>
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
          <button className="btn-ag primary" onClick={loadSlots}><i className="bi bi-search" /> Scan Slots</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--neon-green)', marginRight: 4 }} />Available — Click to book</span>
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
                <div style={{ fontSize: '0.65rem', color: 'var(--neon-green)', marginTop: '0.3rem', letterSpacing: '0.05em' }}>TAP TO BOOK</div>
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
                <tr><td>Date</td><td>{new Date(scheduledDate).toLocaleString('en-IN')}</td></tr>
              </tbody>
            </table>
            <div className="ag-alert info" style={{ marginTop: '1rem', marginBottom: 0, fontSize: '0.8rem' }}>
              <i className="bi bi-info-circle" /> Min 1-hour billing. Final bill calculated at check-out.
            </div>
          </>
        )}
      </Modal>
    </Layout>
  );
}