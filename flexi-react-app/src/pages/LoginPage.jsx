import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../store';
import { WORK_CENTERS } from '../constants';
import { useErrorHandler } from '../hooks';

/**
 * LoginPage component for user authentication
 * Provides login form and handles authentication flow
 */
function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    workCenter: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const { signIn, error: authError } = useAuth();
  const { setSelectedWorkCenter } = useUIStore();
  const navigate = useNavigate();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('LoginPage');

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
      errors.email = 'Email richiesta';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Inserisci un indirizzo email valido';
    }
    
    if (!formData.password) {
      errors.password = 'Password richiesta';
    } else if (formData.password.length < 6) {
      errors.password = 'La password deve essere di almeno 6 caratteri';
    }

    if (!formData.workCenter) {
      errors.workCenter = 'Centro di lavoro richiesto';
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
    
    await handleAsync(
      async () => {
        const result = await signIn(formData.email, formData.password);
        
        if (result.success) {
          // Set the selected work center
          setSelectedWorkCenter(formData.workCenter);
          navigate('/', { replace: true });
        } else {
          // Handle login failure silently
        }
      },
      { 
        context: 'Login', 
        fallbackMessage: 'Accesso fallito. Riprova.',
        onFinally: () => setIsSubmitting(false)
      }
    );
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
          <h1>Bentornato</h1>
          <p>Accedi al tuo account per continuare</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">Indirizzo Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Inserisci la tua email"
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
              placeholder="Inserisci la tua password"
              className={formErrors.password ? 'error' : ''}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {getFieldError('password')}
          </div>

          {/* Work Center Field */}
          <div className="form-group">
            <label htmlFor="workCenter">Centro di Lavoro *</label>
            <select
              id="workCenter"
              name="workCenter"
              value={formData.workCenter}
              onChange={handleChange}
              className={formErrors.workCenter ? 'error' : ''}
              disabled={isSubmitting}
            >
              <option value="">Seleziona un centro di lavoro</option>
              <option value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</option>
              <option value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</option>
              <option value={WORK_CENTERS.BOTH}>{WORK_CENTERS.BOTH}</option>
            </select>
            {getFieldError('workCenter')}
          </div>

          {/* Authentication Error */}
          {authError && (
            <div className="auth-error">
              <span className="error-icon">●</span>
              {authError}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
          </button>
        </form>

        {/* Additional Links */}
        <div className="auth-links">
          <Link to="/forgot-password" className="auth-link">
            Password dimenticata?
          </Link>
          <div className="auth-divider">
            <span>Non hai un account?</span>
          </div>
          <Link to="/signup" className="btn btn-secondary">
            Crea Account
          </Link>
        </div>

                  {/* Demo Credentials (for development) */}
          {import.meta.env.MODE === 'development' && (
          <div className="auth-demo">
            <details>
              <summary>Credenziali Demo (Solo Sviluppo)</summary>
              <div className="demo-credentials">
                <p><strong>Email:</strong> demo@example.com</p>
                <p><strong>Password:</strong> demo123</p>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => setFormData({ email: 'demo@example.com', password: 'demo123', workCenter: WORK_CENTERS.ZANICA })}
                >
                  Usa Credenziali Demo
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
