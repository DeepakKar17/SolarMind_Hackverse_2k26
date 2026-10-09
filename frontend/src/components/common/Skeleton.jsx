export const Skeleton = ({
  variant = 'text',
  width,
  height,
  count = 1,
  className = '',
  style,
}) => {
  const getStyles = () => {
    let baseStyles = { ...style };
    if (width) baseStyles.width = width;
    if (height) baseStyles.height = height;

    if (variant === 'circular') {
      baseStyles.borderRadius = 'var(--radius-full)';
      baseStyles.width = width || height || '40px';
      baseStyles.height = height || width || '40px';
    } else if (variant === 'text') {
      baseStyles.height = height || '16px';
      baseStyles.width = width || '100%';
    } else if (variant === 'rectangular') {
      baseStyles.height = height || '120px';
      baseStyles.width = width || '100%';
    }

    return baseStyles;
  };

  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`sm-skeleton ${className}`} style={getStyles()} />
        ))}
      </div>
    );
  }

  return <div className={`sm-skeleton ${className}`} style={getStyles()} />;
};

export default Skeleton;
