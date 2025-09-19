import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useErrorHandler } from '../hooks';
import {
  Button,
  Input,
  Label,
} from '../components/ui';

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-2 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center">
            <h1 className="text-[10px] font-bold text-gray-900">Controlla la Tua Email</h1>
                         <p className="mt-2 text-[10px] text-gray-600">Abbiamo inviato un link per il reset della password a {email}</p>
          </div>
          
                        <div className="bg-green-50 border border-green-200 rounded-md p-1">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-[10px]">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-[10px] text-green-800">Se non vedi l'email, controlla la cartella spam.</p>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <Link to="/login">
                             <Button size="sm" className="w-full">
                 Torna all'Accesso
               </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-2 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-[10px] font-bold text-gray-900">Reset Password</h1>
                       <p className="mt-2 text-[10px] text-gray-600">Inserisci la tua email per ricevere un link per il reset della password</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Indirizzo Email</Label>
            <Input
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
            <div className="bg-red-50 border border-red-200 rounded-md p-1">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">●</span>
                </div>
                <div className="ml-3">
                  <p className="text-[10px] text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Invio...' : 'Invia Link di Reset'}
          </Button>
        </form>

        <div className="text-center">
                       <Link to="/login" className="text-[10px] text-navy-800 hover:text-navy-600">
            Torna all'Accesso
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
