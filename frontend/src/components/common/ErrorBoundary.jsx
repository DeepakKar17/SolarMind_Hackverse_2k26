import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * Reusable Error Boundary component to catch rendering errors in child component trees.
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    // In production, error telemetry can be dispatched here
    if (process.env.NODE_ENV !== 'test') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          role="alert"
          style={{
            minHeight: '280px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-danger-border)',
            borderRadius: 'var(--radius-xl)',
            textAlign: 'center',
            margin: '1.5rem 0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--color-danger-bg)',
              color: 'var(--color-danger)',
              marginBottom: '1rem',
            }}
          >
            <AlertTriangle size={28} />
          </div>
          <h3 style={{ color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            {this.props.title || 'An unexpected error occurred'}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', maxWidth: '460px', marginBottom: '1.5rem', fontSize: 'var(--font-size-sm)' }}>
            {this.state.error?.message || 'A component failed to render. Please try resetting the view.'}
          </p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={this.handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
