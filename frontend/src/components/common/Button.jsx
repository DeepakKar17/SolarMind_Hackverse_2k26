import { Loader2 } from 'lucide-react';

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  isLoading = false,
  icon: Icon,
  iconPosition = 'left',
  className = '',
  onClick,
  ...props
}) => {
  const variantClass = `sm-btn-${variant}`;
  const sizeClass = `sm-btn-${size}`;

  return (
    <button
      type={type}
      className={`sm-btn ${variantClass} ${sizeClass} ${className}`}
      disabled={disabled || isLoading}
      aria-disabled={disabled || isLoading}
      onClick={onClick}
      {...props}
    >
      {isLoading && <Loader2 size={16} className="sm-spin" style={{ animation: 'spin 1s linear infinite' }} />}
      {!isLoading && Icon && iconPosition === 'left' && <Icon size={16} />}
      <span>{children}</span>
      {!isLoading && Icon && iconPosition === 'right' && <Icon size={16} />}
    </button>
  );
};

export default Button;
