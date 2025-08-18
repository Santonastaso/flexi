import React, { useState } from 'react';

/**
 * Test component to demonstrate Error Boundary functionality
 * This component can intentionally trigger different types of errors
 */
function ErrorTest() {
  const [shouldCrash, setShouldCrash] = useState(false);
  const [shouldAsyncError, setShouldAsyncError] = useState(false);

  // Trigger a JavaScript error
  const triggerJavaScriptError = () => {
    setShouldCrash(true);
    // This will cause a render error
    throw new Error('🚨 Intentional JavaScript Error for testing Error Boundary');
  };

  // Trigger an async error
  const triggerAsyncError = async () => {
    setShouldAsyncError(true);
    // Simulate an async error
    await new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('🚨 Intentional Async Error for testing Error Boundary'));
      }, 100);
    });
  };

  // Trigger a network error simulation
  const triggerNetworkError = () => {
    throw new Error('Network connection issue. Please check your internet connection and try again.');
  };

  // Trigger a validation error
  const triggerValidationError = () => {
    throw new Error('Validation error: Invalid input data provided.');
  };

  // If we're supposed to crash, don't render anything
  if (shouldCrash) {
    return null; // This will trigger the error boundary
  }

  return (
    <div className="error-test">
      <div className="error-test__container">
        <h2>🧪 Error Boundary Test Component</h2>
        <p>This component allows you to test the Error Boundary functionality by triggering different types of errors.</p>
        
        <div className="error-test__actions">
          <button 
            onClick={triggerJavaScriptError}
            className="error-test__button error-test__button--danger"
          >
            🚨 Trigger JavaScript Error
          </button>
          
          <button 
            onClick={triggerAsyncError}
            className="error-test__button error-test__button--warning"
          >
            ⏰ Trigger Async Error
          </button>
          
          <button 
            onClick={triggerNetworkError}
            className="error-test__button error-test__button--info"
          >
            📡 Trigger Network Error
          </button>
          
          <button 
            onClick={triggerValidationError}
            className="error-test__button error-test__button--secondary"
          >
            ✅ Trigger Validation Error
          </button>
        </div>

        <div className="error-test__info">
          <h3>What to expect:</h3>
          <ul>
            <li><strong>JavaScript Error:</strong> Triggers the main Error Boundary with a fallback UI</li>
            <li><strong>Async Error:</strong> Shows how async errors are handled</li>
            <li><strong>Network Error:</strong> Demonstrates network-specific error handling</li>
            <li><strong>Validation Error:</strong> Shows validation error handling</li>
          </ul>
          
          <p><strong>Note:</strong> In development mode, you'll see detailed error information. In production, users will see user-friendly error messages.</p>
        </div>
      </div>
    </div>
  );
}

export default ErrorTest;
