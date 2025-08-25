import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useErrorHandler } from '../hooks';

/**
 * ForgotPasswordPage component for password reset
 * Allows users to request a password reset email
 */
function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const { resetPassword } = useAuth();
  
  // Use unified error handling
  const { handleAsync } = useErrorHandler('ForgotPasswordPage');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Inserisci il tuo indirizzo email');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Inserisci un indirizzo email valido');
      return;
    }

    setIsSubmitting(true);
    setError('');

    await handleAsync(
      async () => {
        const result = await resetPassword(email);
        
        if (result.success) {
          setIsSuccess(true);
        } else {
          setError(result.error || 'Invio email di reset fallito');
        }
      },
      { 
        context: 'Password Reset', 
        fallbackMessage: 'Invio email di reset fallito. Riprova.',
        onFinally: () => setIsSubmitting(false)
      }
    );
  };

  if (isSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1>Controlla la Tua Email</h1>
            <p>Abbiamo inviato un link per il reset della password a {email}</p>
          </div>
          
          <div className="auth-success">
            <div className="success-icon">✅</div>
            <p>Se non vedi l'email, controlla la cartella spam.</p>
          </div>
          
          <div className="auth-links">
            <Link to="/login" className="btn btn-primary">
              Torna all'Accesso
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Inserisci la tua email per ricevere un link per il reset della password</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Indirizzo Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Inserisci la tua email"
              disabled={isSubmitting}
              autoComplete="email"
            />
          </div>

          {error && (
            <div className="auth-error">
              <span className="error-icon">●</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Invio...' : 'Invia Link di Reset'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" className="auth-link">
            Torna all'Accesso
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
