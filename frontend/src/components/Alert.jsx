const ICONS = {
  success: 'bi-check-circle-fill',
  danger: 'bi-exclamation-triangle-fill',
  warning: 'bi-exclamation-circle-fill',
  info: 'bi-info-circle-fill',
};

/** Inline alert banner, mirrors showAlert(id, msg, type) from app.js. */
export default function Alert({ message, type = 'info' }) {
  if (!message) return null;
  return (
    <div className={`ag-alert ${type}`}>
      <i className={`bi ${ICONS[type] || ICONS.info}`} />
      <span dangerouslySetInnerHTML={{ __html: message }} />
    </div>
  );
}
