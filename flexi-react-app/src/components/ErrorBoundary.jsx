import React from 'react';
import { reportError } from '../services/sentry';
import { Button } from './ui/button';

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
    return `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorId: ErrorBoundary.generateErrorId()
    };
  }

  componentDidCatch(_error, _errorInfo) {
    this.setState({
      errorInfo: _errorInfo,
      errorId: this.state.errorId || ErrorBoundary.generateErrorId()
    });

    reportError(_error, {
      component: 'ErrorBoundary',
      errorInfo: _errorInfo,
      errorId: this.state.errorId
    });
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center space-y-4">
            <div className="text-5xl">🚨</div>
            
            <h1 className="text-xl font-semibold text-gray-900">
              Qualcosa è andato storto
            </h1>
            
            <p className="text-sm text-gray-600">
              Si è verificato un errore imprevisto. Il nostro team è stato notificato.
            </p>

            {import.meta.env.MODE === 'development' && this.state.error && (
              <details className="text-left bg-gray-50 rounded p-3 text-xs">
                <summary className="cursor-pointer font-medium text-gray-700">Dettagli errore (Development)</summary>
                <div className="mt-2 space-y-2">
                  <p className="text-red-600">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="overflow-auto max-h-40 text-xs text-gray-500 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <div className="pt-2">
              <Button onClick={this.handleRetry} variant="default">
                Ricarica pagina
              </Button>
            </div>

            <p className="text-xs text-gray-400">
              Error ID: <code className="bg-gray-100 px-1 rounded">{this.state.errorId}</code>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
