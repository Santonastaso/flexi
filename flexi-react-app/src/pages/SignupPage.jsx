import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
 * SignupPage component for user registration
 * Provides signup form and handles user creation
 */
function SignupPage() {
  const { signUp, error: authError } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: ''
    },
    resolver: yupResolver(SCHEMAS.SIGNUP)
  });

  const onSubmit = async (formData) => {
    const userData = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      full_name: `${formData.firstName} ${formData.lastName}`,
    };

    const result = await signUp(formData.email, formData.password, userData);
    if (result.success) {
      navigate('/', { replace: true });
    }
  };

  const getFieldError = (fieldName) => {
    return errors[fieldName]?.message ? (
      <span className="error-message" style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>
        {errors[fieldName].message}
      </span>
    ) : null;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-2 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900">Crea Account</h1>
                       <p className="mt-2 text-sm text-gray-600">Registrati per iniziare con il tuo account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                type="text"
                id="firstName"
                {...register('firstName')}
                placeholder="Inserisci il tuo nome"
                className={errors.firstName ? 'border-red-500' : ''}
                disabled={isSubmitting}
                autoComplete="given-name"
              />
              {getFieldError('firstName')}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Cognome</Label>
              <Input
                type="text"
                id="lastName"
                {...register('lastName')}
                placeholder="Inserisci il tuo cognome"
                className={errors.lastName ? 'border-red-500' : ''}
                disabled={isSubmitting}
                autoComplete="family-name"
              />
              {getFieldError('lastName')}
            </div>
          </div>

          {/* Email Field */}
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
            {getFieldError('email')}
          </div>

          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                {...register('password')}
                placeholder="Crea una password"
                className={errors.password ? 'border-red-500' : ''}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {getFieldError('password')}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Conferma Password</Label>
              <Input
                type="password"
                id="confirmPassword"
                {...register('confirmPassword')}
                placeholder="Conferma la tua password"
                className={errors.confirmPassword ? 'border-red-500' : ''}
                disabled={isSubmitting}
                autoComplete="new-password"
              />
              {getFieldError('confirmPassword')}
            </div>
          </div>

          {/* Authentication Error */}
          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-1">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-red-400">●</span>
                </div>
                <div className="ml-3">
                  <p className="text-xs text-red-800">{authError}</p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creazione Account...' : 'Crea Account'}
          </Button>
        </form>

        {/* Additional Links */}
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-1 bg-gray-50 text-gray-500">Hai già un account?</span>
            </div>
          </div>
          <Link to="/login">
                         <Button variant="outline" size="sm" className="w-full">
               Accedi
             </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;
