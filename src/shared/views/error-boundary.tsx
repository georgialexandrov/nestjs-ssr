import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo, retry: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * React Error Boundary component that catches errors in child components.
 * Prevents full page crashes and provides a fallback UI.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <App />
 * </ErrorBoundary>
 * ```
 *
 * @example
 * // Custom fallback UI
 * <ErrorBoundary
 *   fallback={(error, errorInfo, retry) => (
 *     <div>
 *       <h1>Something went wrong</h1>
 *       <button onClick={retry}>Try again</button>
 *     </div>
 *   )}
 * >
 *   <App />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error details
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Update state with error info for display
    this.setState({
      errorInfo,
    });

    // In production, you might want to send this to an error reporting service
    // Example: Sentry.captureException(error, { extra: errorInfo });
  }

  retry = (): void => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      // If custom fallback provided, use it
      if (fallback) {
        return fallback(error, errorInfo!, this.retry);
      }

      // Default fallback UI
      return <DefaultErrorFallback error={error} errorInfo={errorInfo} retry={this.retry} />;
    }

    return children;
  }
}

/**
 * Default fallback UI for ErrorBoundary.
 * Shows detailed error in development, user-friendly message in production.
 */
function DefaultErrorFallback({
  error,
  errorInfo,
  retry,
}: {
  error: Error;
  errorInfo: React.ErrorInfo | null;
  retry: () => void;
}): ReactNode {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '800px',
        margin: '0 auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#fee',
          border: '2px solid #c00',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ margin: '0 0 1rem 0', color: '#c00', fontSize: '1.5rem' }}>
          {isDevelopment ? 'Component Error' : 'Something went wrong'}
        </h1>

        <p style={{ margin: '0 0 1rem 0', color: '#333' }}>
          {isDevelopment
            ? 'An error occurred while rendering this component.'
            : 'We encountered an unexpected error. Please try again.'}
        </p>

        {isDevelopment && (
          <>
            <div
              style={{
                backgroundColor: '#fff',
                border: '1px solid #ddd',
                borderRadius: '4px',
                padding: '1rem',
                marginBottom: '1rem',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                overflow: 'auto',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#c00' }}>
                {error.name}: {error.message}
              </strong>
              {error.stack && (
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#666',
                  }}
                >
                  {error.stack}
                </pre>
              )}
            </div>

            {errorInfo?.componentStack && (
              <details style={{ marginBottom: '1rem' }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    color: '#666',
                    fontWeight: 'bold',
                    marginBottom: '0.5rem',
                  }}
                >
                  Component Stack
                </summary>
                <div
                  style={{
                    backgroundColor: '#fff',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '1rem',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    overflow: 'auto',
                  }}
                >
                  <pre
                    style={{
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: '#666',
                    }}
                  >
                    {errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}
          </>
        )}

        <button
          onClick={retry}
          style={{
            backgroundColor: '#c00',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
          onMouseOver={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#a00';
          }}
          onMouseOut={(e) => {
            (e.target as HTMLButtonElement).style.backgroundColor = '#c00';
          }}
        >
          Try Again
        </button>
      </div>

      {isDevelopment && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            backgroundColor: '#ffe',
            border: '1px solid #dd6',
            borderRadius: '4px',
            fontSize: '0.875rem',
            color: '#666',
          }}
        >
          <strong>Development Mode:</strong> This detailed error view is only shown in development.
          In production, users will see a user-friendly error message.
        </div>
      )}
    </div>
  );
}
