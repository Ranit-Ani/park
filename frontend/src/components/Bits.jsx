import { statusClass } from '../lib/utils';

/** Status pill, mirrors statusBadge(s) from app.js */
export function StatusBadge({ status }) {
  return <span className={`ag-badge ${statusClass(status)}`}>{status}</span>;
}

/** Dashboard stat tile: colored icon + label + value */
export function StatCard({ color, label, value, icon }) {
  return (
    <div className={`stat-card ${color}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        <div className={`stat-icon ${color}`}><i className={`bi ${icon}`} /></div>
      </div>
    </div>
  );
}

/** Button that shows a spinner + "Processing..." while busy */
export function ActionButton({ busy, busyLabel = 'Processing...', className = '', children, ...rest }) {
  return (
    <button className={className} disabled={busy} {...rest}>
      {busy ? (<><span className="spinner-border-sm" /> {busyLabel}</>) : children}
    </button>
  );
}

/** Empty-state placeholder shown inside tables/grids */
export function EmptyState({ icon = 'bi-inbox', children }) {
  return (
    <div className="empty-state">
      <i className={`bi ${icon}`} />
      <p>{children}</p>
    </div>
  );
}
