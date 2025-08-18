import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

/**
 * LoginPage component for user authentication
 * Provides login form and handles authentication flow
 */
function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const { signIn, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await signIn(formData.email, formData.password);
      
      if (result.success) {
        console.log('Login successful, redirecting to home');
        navigate('/', { replace: true });
      } else {
        console.log('Login failed:', result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldError = (fieldName) => {
    return formErrors[fieldName] ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {formErrors[fieldName]}
      </span>
    ) : null;
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p>Sign in to your account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={formErrors.email ? 'error' : ''}
              disabled={isSubmitting}
              autoComplete="email"
            />
            {getFieldError('email')}
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={formErrors.password ? 'error' : ''}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {getFieldError('password')}
          </div>

          {/* Authentication Error */}
          {authError && (
            <div className="auth-error">
              <span className="error-icon">⚠️</span>
              {authError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        {/* Additional Links */}
        <div className="auth-links">
          <Link to="/forgot-password" className="auth-link">
            Forgot your password?
          </Link>
          <div className="auth-divider">
            <span>Don't have an account?</span>
          </div>
          <Link to="/signup" className="btn btn-secondary">
            Create Account
          </Link>
        </div>

        {/* Demo Credentials (for development) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="auth-demo">
            <details>
              <summary>Demo Credentials (Development Only)</summary>
              <div className="demo-credentials">
                <p><strong>Email:</strong> demo@example.com</p>
                <p><strong>Password:</strong> demo123</p>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setFormData({ email: 'demo@example.com', password: 'demo123' })}
                >
                  Use Demo Credentials
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
