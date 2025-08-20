import React from 'react';

/**
 * React Error Boundary Component
 * Catches JavaScript errors anywhere in the component tree and displays a fallback UI
 * This prevents the entire app from crashing and provides a better user experience
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    };
  }

  static generateErrorId() {
    // Generate a unique error ID for tracking
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: ErrorBoundary.generateErrorId()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    // Update state with error information
    this.setState({
      errorInfo,
      errorId: this.state.errorId || ErrorBoundary.generateErrorId()
    });

    // Log to external service in production (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    // In production, you would send this to an error tracking service
    // For now, we'll just log it to console
    if (import.meta.env.MODE === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      console.group('🚨 Production Error Report');
      console.log('Error ID:', this.state.errorId);
      console.log('Error:', error);
      console.log('Error Info:', errorInfo);
      console.log('User Agent:', navigator.userAgent);
      console.log('URL:', window.location.href);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }
  }

  handleRetry = () => {
    // Reset error state and attempt to recover
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
    
    // Force a re-render of the app
    window.location.reload();
  };

  handleGoHome = () => {
    // Navigate to home page
    window.location.href = '/';
  };

  handleReportIssue = () => {
    // Open issue reporting (could be email, form, or external service)
    const subject = encodeURIComponent(`App Error Report - ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error Report Details:
- Error ID: ${this.state.errorId}
- Error: ${this.state.error?.message || 'Unknown error'}
- URL: ${window.location.href}
- User Agent: ${navigator.userAgent}
- Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:
    `);
    
    window.open(`mailto:support@company.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Fallback UI when an error occurs
      return (
        <div className="error-boundary">
          <div className="error-boundary__container">
            <div className="error-boundary__icon">🚨</div>
            
            <h1 className="error-boundary__title">
              Oops! Something went wrong
            </h1>
            
            <p className="error-boundary__message">
              We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue.
            </p>

            {import.meta.env.MODE === 'development' && this.state.error && (
              <details className="error-boundary__details">
                <summary>Error Details (Development)</summary>
                <div className="error-boundary__error-info">
                  <p><strong>Error:</strong> {this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="error-boundary__stack-trace">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="error-boundary__actions">
              <button 
                onClick={this.handleRetry}
                className="error-boundary__button error-boundary__button--primary"
              >
                🔄 Try Again
              </button>
              
              <button 
                onClick={this.handleGoHome}
                className="error-boundary__button error-boundary__button--secondary"
              >
                🏠 Go to Home
              </button>
              
              <button 
                onClick={this.handleReportIssue}
                className="error-boundary__button error-boundary__button--secondary"
              >
                📧 Report Issue
              </button>
            </div>

            <div className="error-boundary__footer">
              <p className="error-boundary__error-id">
                Error ID: <code>{this.state.errorId}</code>
              </p>
              <p className="error-boundary__help">
                If this problem persists, please contact support with the Error ID above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Render children normally when there's no error
    return this.props.children;
  }
}

export default ErrorBoundary;
