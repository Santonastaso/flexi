import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useErrorHandler } from '../hooks';

/**
 * SignupPage component for user registration
 * Provides signup form and handles user creation
 */
function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const { signUp, error: authError } = useAuth();
  const navigate = useNavigate();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('SignupPage');

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
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Conferma la tua password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Le password non coincidono';
    }
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'Nome richiesto';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Cognome richiesto';
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
        const userData = {
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`,
        };

        const result = await signUp(formData.email, formData.password, userData);
        
        if (result.success) {
          navigate('/', { replace: true });
        } else {
          // Handle signup failure silently
        }
      },
      { 
        context: 'Signup', 
        fallbackMessage: 'Creazione account fallita. Riprova.',
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
          <h1>Crea Account</h1>
          <p>Registrati per iniziare con il tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {/* Name Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">Nome</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Inserisci il tuo nome"
                className={formErrors.firstName ? 'error' : ''}
                disabled={isSubmitting}
                autoComplete="given-name"
              />
              {getFieldError('firstName')}
            </div>

            <div className="form-group">
              <label htmlFor="lastName">Cognome</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Inserisci il tuo cognome"
                className={formErrors.lastName ? 'error' : ''}
                disabled={isSubmitting}
                autoComplete="family-name"
              />
              {getFieldError('lastName')}
            </div>
          </div>

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

          {/* Password Fields */}
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Crea una password"
                className={formErrors.password ? 'error' : ''}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {getFieldError('password')}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Conferma Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Conferma la tua password"
                className={formErrors.confirmPassword ? 'error' : ''}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {getFieldError('confirmPassword')}
            </div>
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
            {isSubmitting ? 'Creazione Account...' : 'Crea Account'}
          </button>
        </form>

        {/* Additional Links */}
        <div className="auth-links">
          <div className="auth-divider">
            <span>Hai già un account?</span>
          </div>
          <Link to="/login" className="btn btn-secondary">
            Accedi
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
