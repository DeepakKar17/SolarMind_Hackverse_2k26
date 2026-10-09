import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

export const Breadcrumbs = ({ items = [], className = '' }) => {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={className} style={{ marginBottom: 'var(--space-2)' }}>
      <ol style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--font-size-xs)' }}>
        <li>
          <Link
            to="/"
            style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--color-text-muted)', textDecoration: 'none' }}
            aria-label="Home"
          >
            <Home size={14} />
          </Link>
        </li>

        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.label || index} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ChevronRight size={12} style={{ color: 'var(--color-border-strong)' }} />
              {isLast || !item.href ? (
                <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)' }} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href}
                  style={{ color: 'var(--color-text-secondary)', textDecoration: 'none' }}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumbs;
