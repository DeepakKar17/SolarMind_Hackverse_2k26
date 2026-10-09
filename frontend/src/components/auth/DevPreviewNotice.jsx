export const DevPreviewNotice = ({ onQuickFill, role = 'OPERATOR' }) => {
  return (
    <div
      style={{
        padding: 'var(--space-3) var(--space-4)',
        backgroundColor: 'var(--color-accent-amber-light)',
        border: '1px solid var(--color-warning-border)',
        borderRadius: 'var(--radius-md)',
        marginBottom: 'var(--space-4)',
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-warning-text)',
      }}
      role="note"
      aria-label="Development Preview Notice"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ fontSize: '14px' }}>⚡</span>
          <div>
            <strong>Development Preview Mode</strong>
            <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
              Authentication is in local development mode. No real passwords are transmitted or stored.
            </div>
          </div>
        </div>
        {onQuickFill && (
          <button
            type="button"
            onClick={onQuickFill}
            className="sm-btn sm-btn--secondary sm-btn--sm"
            style={{
              padding: '2px 8px',
              fontSize: '11px',
              whiteSpace: 'nowrap',
              height: 'auto',
              flexShrink: 0,
            }}
          >
            Quick Fill Demo
          </button>
        )}
      </div>
    </div>
  );
};

export default DevPreviewNotice;
