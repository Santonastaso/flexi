import React from 'react';

/**
 * Async Error Boundary Component
 * Specifically designed to handle async errors, API failures, and network issues
 * Provides more specific error messages and recovery options for async operations
 */
class AsyncErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorType: null,
      retryCount: 0,
      maxRetries: 3
    };
  }

  static getDerivedStateFromError(error) {
    // Determine error type for better user messaging
    let errorType = 'unknown';
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorType = 'network';
    } else if (error.message.includes('timeout') || error.message.includes('time out')) {
      errorType = 'timeout';
    } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
      errorType = 'auth';
    } else if (error.message.includes('forbidden') || error.message.includes('403')) {
      errorType = 'permission';
    } else if (error.message.includes('not found') || error.message.includes('404')) {
      errorType = 'not_found';
    } else if (error.message.includes('server') || error.message.includes('500')) {
      errorType = 'server';
    }

    return { 
      hasError: true, 
      error,
      errorType,
      retryCount: 0
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 Async Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      errorInfo,
      retryCount: this.state.retryCount || 0
    });

    // Log async-specific error details
    this.logAsyncError(error, errorInfo);
  }

  logAsyncError(error, errorInfo) {
    if (process.env.NODE_ENV === 'production') {
      console.group('🚨 Async Error Report');
      console.log('Error Type:', this.state.errorType);
      console.log('Error:', error);
      console.log('Error Info:', errorInfo);
      console.log('Retry Count:', this.state.retryCount);
      console.log('URL:', window.location.href);
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }
  }

  handleRetry = async () => {
    const { retryCount, maxRetries } = this.state;
    
    if (retryCount >= maxRetries) {
      // Show max retries reached message
      this.setState({ 
        hasError: true,
        error: new Error('Maximum retry attempts reached. Please try again later.'),
        errorType: 'max_retries'
      });
      return;
    }

    // Increment retry count
    this.setState(prevState => ({ 
      retryCount: prevState.retryCount + 1,
      hasError: false,
      error: null
    }));

    // Attempt to recover by triggering a re-render
    try {
      // Force parent component to re-render and retry the operation
      if (this.props.onRetry) {
        await this.props.onRetry();
      } else {
        // Default retry behavior
        window.location.reload();
      }
    } catch (retryError) {
      // If retry itself fails, show error
      this.setState({ 
        hasError: true,
        error: retryError,
        errorType: 'retry_failed'
      });
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRefresh = () => {
    window.location.reload();
  };

  getErrorMessage() {
    const { errorType, retryCount, maxRetries } = this.state;
    
    switch (errorType) {
      case 'network':
        return 'Network connection issue. Please check your internet connection and try again.';
      case 'timeout':
        return 'Request timed out. The server is taking too long to respond.';
      case 'auth':
        return 'Authentication error. Please log in again.';
      case 'permission':
        return 'Access denied. You don\'t have permission to perform this action.';
      case 'not_found':
        return 'The requested resource was not found.';
      case 'server':
        return 'Server error. Our team has been notified and is working to fix this issue.';
      case 'max_retries':
        return `Maximum retry attempts (${maxRetries}) reached. Please try again later.`;
      case 'retry_failed':
        return 'Failed to retry the operation. Please refresh the page.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  getRetryMessage() {
    const { retryCount, maxRetries } = this.state;
    const remaining = maxRetries - retryCount;
    
    if (remaining > 0) {
      return `You can retry ${remaining} more time${remaining > 1 ? 's' : ''}.`;
    }
    return 'Maximum retry attempts reached.';
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="async-error-boundary">
          <div className="async-error-boundary__container">
            <div className="async-error-boundary__icon">
              {this.state.errorType === 'network' ? '📡' : 
               this.state.errorType === 'timeout' ? '⏰' : 
               this.state.errorType === 'auth' ? '🔐' : 
               this.state.errorType === 'permission' ? '🚫' : 
               this.state.errorType === 'server' ? '🖥️' : '🚨'}
            </div>
            
            <h1 className="async-error-boundary__title">
              {this.state.errorType === 'network' ? 'Connection Issue' :
               this.state.errorType === 'timeout' ? 'Request Timeout' :
               this.state.errorType === 'auth' ? 'Authentication Error' :
               this.state.errorType === 'permission' ? 'Access Denied' :
               this.state.errorType === 'server' ? 'Server Error' : 'Something went wrong'}
            </h1>
            
            <p className="async-error-boundary__message">
              {this.getErrorMessage()}
            </p>

            {this.state.retryCount > 0 && (
              <p className="async-error-boundary__retry-info">
                {this.getRetryMessage()}
              </p>
            )}

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="async-error-boundary__details">
                <summary>Error Details (Development)</summary>
                <div className="async-error-boundary__error-info">
                  <p><strong>Error Type:</strong> {this.state.errorType}</p>
                  <p><strong>Error:</strong> {this.state.error.toString()}</p>
                  <p><strong>Retry Count:</strong> {this.state.retryCount}</p>
                </div>
              </details>
            )}

            <div className="async-error-boundary__actions">
              {this.state.retryCount < this.state.maxRetries && (
                <button 
                  onClick={this.handleRetry}
                  className="async-error-boundary__button async-error-boundary__button--primary"
                >
                  🔄 Try Again ({this.state.maxRetries - this.state.retryCount} left)
                </button>
              )}
              
              <button 
                onClick={this.handleRefresh}
                className="async-error-boundary__button async-error-boundary__button--secondary"
              >
                🔄 Refresh Page
              </button>
              
              <button 
                onClick={this.handleGoHome}
                className="async-error-boundary__button async-error-boundary__button--secondary"
              >
                🏠 Go to Home
              </button>
            </div>

            <div className="async-error-boundary__footer">
              <p className="async-error-boundary__help">
                If this problem persists, please contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AsyncErrorBoundary;
