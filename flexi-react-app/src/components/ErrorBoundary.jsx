import React from 'react';
import { logError, getErrorSeverity, ERROR_SEVERITY } from '../utils/errorUtils';

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
    // Update state with error information
    this.setState({
      errorInfo,
      errorId: this.state.errorId || ErrorBoundary.generateErrorId()
    });

    // Use our centralized error logging
    const errorContext = 'ErrorBoundary';
    logError(error, errorContext);

    // Log to external service in production (e.g., Sentry, LogRocket)
    this.logErrorToService(error, errorInfo);
  }

  logErrorToService(error, errorInfo) {
    // In production, you would send this to an error tracking service
    // For now, we'll just log it to console
    if (import.meta.env.MODE === 'production') {
      // Example: Sentry.captureException(error, { extra: errorInfo });
      // Production error logging would go here
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

  getErrorRecommendations = (error) => {
    const severity = getErrorSeverity(error);
    
    switch (severity) {
      case ERROR_SEVERITY.CRITICAL:
        return (
          <div className="error-boundary__recommendation critical">
            <strong>Critical Error:</strong> This is a serious issue. Please contact support immediately.
          </div>
        );
      case ERROR_SEVERITY.HIGH:
        return (
          <div className="error-boundary__recommendation high">
            <strong>High Priority:</strong> Please try refreshing the page or contact support if the problem persists.
          </div>
        );
      case ERROR_SEVERITY.MEDIUM:
        return (
          <div className="error-boundary__recommendation medium">
            <strong>Medium Priority:</strong> Try refreshing the page or navigating to a different section.
          </div>
        );
      case ERROR_SEVERITY.LOW:
        return (
          <div className="error-boundary__recommendation low">
            <strong>Low Priority:</strong> This error should resolve itself. Try continuing with your task.
          </div>
        );
      default:
        return null;
    }
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
                className="btn-primary"
              >
                Try Again
              </button>
              
              <button 
                onClick={this.handleGoHome} 
                className="btn-secondary"
              >
                Go to Home
              </button>
              
              <button 
                onClick={this.handleReportIssue}
                className="error-boundary__button error-boundary__button--secondary"
              >
                📧 Report Issue
              </button>
            </div>

            {/* Show severity-based recommendations */}
            {this.state.error && (
              <div className="error-boundary__recommendations">
                {this.getErrorRecommendations(this.state.error)}
              </div>
            )}

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
