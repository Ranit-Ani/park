import { useEffect } from 'react';

/**
 * Lightweight modal used across the app for confirmations, forms,
 * bills, etc. Replaces bootstrap.Modal() imperative usage from the
 * original pages with a plain, controlled React component.
 */
export default function Modal({ show, onClose, title, icon, size, headerStyle, footer, children }) {
  useEffect(() => {
    if (!show) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="ag-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`ag-modal-dialog ${size === 'sm' ? 'sm' : ''}`}>
        <div className="ag-modal-content">
          <div className="ag-modal-header" style={headerStyle}>
            <h5 className="ag-modal-title">
              {icon && <i className={`bi ${icon}`} />} {title}
            </h5>
            <button type="button" className="ag-modal-close" onClick={onClose} aria-label="Close">&times;</button>
          </div>
          <div className="ag-modal-body">{children}</div>
          {footer && <div className="ag-modal-footer">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
