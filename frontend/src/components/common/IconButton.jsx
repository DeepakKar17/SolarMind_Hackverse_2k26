export const IconButton = ({
  icon: Icon,
  children,
  size = 'md',
  variant = 'ghost',
  type = 'button',
  disabled = false,
  ariaLabel,
  className = '',
  onClick,
  ...props
}) => {
  const sizeClass = `sm-icon-btn-${size}`;
  const variantClass = variant === 'primary' ? 'sm-btn-primary' : variant === 'outline' ? 'sm-btn-outline' : '';

  return (
    <button
      type={type}
      className={`sm-icon-btn ${sizeClass} ${variantClass} ${className}`}
      disabled={disabled}
      aria-label={ariaLabel || 'Action button'}
      onClick={onClick}
      {...props}
    >
      {Icon ? <Icon size={size === 'sm' ? 16 : size === 'lg' ? 22 : 18} /> : children}
    </button>
  );
};

export default IconButton;
