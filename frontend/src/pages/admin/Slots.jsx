import { useCallback, useEffect, useState } from 'react';
import Layout from '../../components/Layout';
import Alert from '../../components/Alert';
import Modal from '../../components/Modal';
import { StatusBadge, ActionButton, EmptyState } from '../../components/Bits';
import { apiRequest } from '../../lib/api';
import { showToast } from '../../lib/toast';
import { getSocket } from '../../lib/socket';

const emptyForm = { slotNumber: '', hourlyRate: '', slotType: 'standard', location: '', floor: '' };

export default function AdminSlots() {
  const [slots, setSlots] = useState([]);

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [addBusy, setAddBusy] = useState(false);
  const [addAlert, setAddAlert] = useState({ message: '', type: 'info' });

  const [priceOpen, setPriceOpen] = useState(false);
  const [priceId, setPriceId] = useState(null);
  const [priceVal, setPriceVal] = useState('');
  const [priceBusy, setPriceBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await apiRequest('/slots/all');
    if (d && d.success) setSlots(d.data);
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('slotUpdated', load);
    socket.on('slotDeleted', load);
    return () => {
      socket.off('slotUpdated', load);
      socket.off('slotDeleted', load);
    };
  }, [load]);

  function openAdd() {
    setForm(emptyForm);
    setAddAlert({ message: '', type: 'info' });
    setAddOpen(true);
  }

  async function addSlot() {
    setAddBusy(true);
    const d = await apiRequest('/admin/slots', {
      method: 'POST',
      body: {
        slotNumber: form.slotNumber,
        hourlyRate: parseFloat(form.hourlyRate),
        slotType: form.slotType,
        location: form.location || 'Main Campus',
        floor: form.floor || 'Ground',
      },
    });
    setAddBusy(false);
    if (d && d.success) {
      setAddOpen(false);
      showToast('Slot added!', 'success');
      load();
    } else {
      setAddAlert({ message: (d && d.message) || 'Failed.', type: 'danger' });
    }
  }

  function openPrice(id, rate) {
    setPriceId(id);
    setPriceVal(String(rate));
    setPriceOpen(true);
  }

  async function updatePrice() {
    setPriceBusy(true);
    const d = await apiRequest('/admin/slots/' + priceId + '/pricing', { method: 'PUT', body: { hourlyRate: parseFloat(priceVal) } });
    setPriceBusy(false);
    if (d && d.success) {
      setPriceOpen(false);
      showToast('Pricing updated!', 'success');
      load();
    } else {
      showToast((d && d.message) || 'Failed.', 'danger');
    }
  }

  async function delSlot(id, num) {
    if (!confirm('Delete slot ' + num + '?')) return;
    const d = await apiRequest('/admin/slots/' + id, { method: 'DELETE' });
    if (d && d.success) { showToast('Slot deleted.', 'warning'); load(); }
    else showToast((d && d.message) || 'Failed.', 'danger');
  }

  return (
    <Layout title="Slot Management" badge={false} right={<button className="btn-ag primary sm" onClick={openAdd}><i className="bi bi-plus-circle" /> Add Slot</button>}>
      <div className="table-card">
        <div className="tc-header"><h6>Parking Slots Registry</h6><button className="btn-ag ghost sm" onClick={load}><i className="bi bi-arrow-clockwise" /> Refresh</button></div>
        <div className="table-responsive">
          <table className="ag-table">
            <thead><tr><th>Slot #</th><th>Type</th><th>Location</th><th>Floor</th><th>Rate/hr</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {slots.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon="bi-grid-3x3-gap">No slots yet. Add one above.</EmptyState></td></tr>
              ) : slots.map((s) => (
                <tr key={s._id}>
                  <td><strong style={{ color: 'var(--neon-cyan)' }}>{s.slotNumber}</strong></td>
                  <td><span className="ag-badge user" style={{ fontSize: '0.65rem' }}>{s.slotType}</span></td>
                  <td>{s.location}</td>
                  <td>{s.floor}</td>
                  <td style={{ color: 'var(--neon-green)' }}>
                    ₹{s.hourlyRate}{' '}
                    <button onClick={() => openPrice(s._id, s.hourlyRate)} style={{ background: 'none', border: 'none', color: 'var(--neon-cyan)', cursor: 'pointer', fontSize: '0.8rem', padding: '0 0.25rem' }}>
                      <i className="bi bi-pencil" />
                    </button>
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  <td><button className="btn-ag red sm" onClick={() => delSlot(s._id, s.slotNumber)}><i className="bi bi-trash" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        show={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Slot"
        icon="bi-plus-circle"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setAddOpen(false)}>Cancel</button>
            <ActionButton busy={addBusy} busyLabel="Adding..." className="btn-ag primary" onClick={addSlot}><i className="bi bi-plus-circle" /> Add Slot</ActionButton>
          </>
        )}
      >
        <Alert message={addAlert.message} type={addAlert.type} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Slot Number *</label><input className="ag-input" placeholder="P001" value={form.slotNumber} onChange={(e) => setForm({ ...form, slotNumber: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Hourly Rate (₹) *</label><input className="ag-input" type="number" min="0" placeholder="20" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}>
            <label className="ag-label">Type</label>
            <select className="ag-select" value={form.slotType} onChange={(e) => setForm({ ...form, slotType: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="faculty">Faculty</option>
              <option value="disabled">Disabled</option>
              <option value="ev">EV Charging</option>
            </select>
          </div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Location</label><input className="ag-input" placeholder="Block A" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div className="ag-input-group" style={{ margin: 0 }}><label className="ag-label">Floor</label><input className="ag-input" placeholder="Ground" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
        </div>
      </Modal>

      <Modal
        show={priceOpen}
        onClose={() => setPriceOpen(false)}
        title="Update Rate"
        icon="bi-pencil"
        size="sm"
        footer={(
          <>
            <button className="btn-ag ghost" onClick={() => setPriceOpen(false)}>Cancel</button>
            <ActionButton busy={priceBusy} busyLabel="Updating..." className="btn-ag primary" onClick={updatePrice}><i className="bi bi-check-circle" /> Update</ActionButton>
          </>
        )}
      >
        <label className="ag-label">New Rate (₹/hr)</label>
        <input className="ag-input" type="number" min="0" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} />
      </Modal>
    </Layout>
  );
}
