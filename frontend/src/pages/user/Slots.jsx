import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../../components/Layout';
import { StatusBadge } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { getSocket } from '../../lib/socket';

export default function UserSlots() {
  const [slots, setSlots] = useState([]);
  const [counts, setCounts] = useState({ Available: '--', Booked: '--', Occupied: '--', total: '--' });

  const load = useCallback(async () => {
    const [all, stats] = await Promise.all([apiRequest('/slots/all'), apiRequest('/slots/stats')]);
    if (stats && stats.success) setCounts(stats.data);
    if (all && all.success) setSlots(all.data);
  }, []);

  useEffect(() => {
    load();

    // Live sync: whenever anyone books/cancels/checks in/out, or an admin
    // adds/edits/removes a slot, every open tab refreshes instantly —
    // no manual refresh needed.
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

  return (
    <Layout title="Orbital Slot Map" right={<Link to="/user/book" className="btn-ag primary sm"><i className="bi bi-plus-circle" /> Book</Link>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card green"><div className="stat-label">Available</div><div className="stat-value">{counts.Available}</div></div>
        <div className="stat-card orange"><div className="stat-label">Booked</div><div className="stat-value">{counts.Booked}</div></div>
        <div className="stat-card red"><div className="stat-label">Occupied</div><div className="stat-value">{counts.Occupied}</div></div>
        <div className="stat-card cyan"><div className="stat-label">Total</div><div className="stat-value">{counts.total}</div></div>
      </div>
      <div className="slot-grid">
        {slots.map((s) => (
          <div key={s._id} className={`slot-tile ${s.status.toLowerCase()}`} title={`${s.slotNumber} | ${s.slotType} | ${s.location}`}>
            <div className="slot-number">{s.slotNumber}</div>
            <div className="slot-type">{s.slotType}</div>
            <div><StatusBadge status={s.status} /></div>
            <div className="slot-rate">₹{s.hourlyRate}/hr</div>
            {s.status === 'Available' && (
              <div style={{ marginTop: '0.4rem' }}>
                <Link to="/user/book" className="btn-ag green sm" style={{ fontSize: '0.65rem', padding: '0.2rem 0.6rem' }}>Book</Link>
              </div>
            )}
          </div>
        ))}
      </div>
    </Layout>
  );
}
