import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../auth/useAuth';
import { SCHEMAS } from '../utils';
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
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submitError, setSubmitError] = useState('');

  const { resetPassword } = useAuth();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      email: ''
    },
    resolver: yupResolver(SCHEMAS.FORGOT_PASSWORD)
  });

  const onSubmit = async ({ email }) => {
    setSubmitError('');
    try {
      const result = await resetPassword(email);
      
      if (result.success) {
        setSubmittedEmail(email);
        setIsSuccess(true);
      } else {
        setSubmitError(result.error || 'Invio email di reset fallito');
      }
    } catch (error) {
      setSubmitError(error.message || 'Invio email di reset fallito. Riprova.');
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-2 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-4">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">Controlla la Tua Email</h1>
                         <p className="mt-2 text-sm text-gray-600">Abbiamo inviato un link per il reset della password a {submittedEmail}</p>
          </div>
          
                        <div className="bg-green-50 border border-green-200 rounded-md p-1">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-xs">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-xs text-green-800">Se non vedi l'email, controlla la cartella spam.</p>
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
          <h1 className="text-xl font-bold text-gray-900">Reimposta Password</h1>
                       <p className="mt-2 text-sm text-gray-600">Inserisci la tua email per ricevere un link per il reset della password</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Indirizzo Email</Label>
            <Input
              type="email"
              id="email"
              {...register('email')}
              placeholder="Inserisci la tua email"
              className={errors.email ? 'border-red-500' : ''}
              disabled={isSubmitting}
              autoComplete="email"
            />
            {errors.email?.message && (
              <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
                {errors.email.message}
              </span>
            )}
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-1">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">●</span>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-red-800">{submitError}</p>
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
                       <Link to="/login" className="text-xs text-navy-800 hover:text-navy-600">
            Torna all'Accesso
          </Link>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
