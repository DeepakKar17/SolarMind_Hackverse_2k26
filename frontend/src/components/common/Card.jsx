export const Card = ({
  title,
  subtitle,
  headerRight,
  actions,
  footer,
  children,
  hoverable = false,
  className = '',
  style,
  ...props
}) => {
  const actionContent = headerRight || actions;
  const hasHeader = title || subtitle || actionContent;

  return (
    <div
      className={`sm-card ${hoverable ? 'sm-card-hover' : ''} ${className}`}
      style={style}
      {...props}
    >
      {hasHeader && (
        <div className="sm-card-header">
          <div>
            {title && (
              <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {subtitle}
              </p>
            )}
          </div>
          {actionContent && <div>{actionContent}</div>}
        </div>
      )}

      <div className="sm-card-body">{children}</div>

      {footer && <div className="sm-card-footer">{footer}</div>}
    </div>
  );
};

export default Card;
