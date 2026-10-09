export const Badge = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
  ...props
}) => {
  const variantClass = `sm-badge-${variant}`;

  return (
    <span className={`sm-badge ${variantClass} ${className}`} {...props}>
      {dot && <span className={`sm-status-dot sm-status-dot-${variant}`} />}
      {children}
    </span>
  );
};

export default Badge;
