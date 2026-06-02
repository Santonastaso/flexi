import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { useAuth } from '../auth/useAuth';
import { useUIStore } from '../store';
import { WORK_CENTERS } from '../constants';
import { SCHEMAS } from '../utils';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from '../components/ui';

/**
 * LoginPage component for user authentication
 * Provides login form and handles authentication flow
 */
function LoginPage() {
  const { signIn, error: authError } = useAuth();
  const { setSelectedWorkCenter } = useUIStore();
  const navigate = useNavigate();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
      workCenter: ''
    },
    resolver: yupResolver(SCHEMAS.LOGIN)
  });

  const onSubmit = async (formData) => {
    const result = await signIn(formData.email, formData.password);
    if (result.success) {
      setSelectedWorkCenter(formData.workCenter);
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
          <h1 className="text-xl font-bold text-gray-900">Bentornato</h1>
                       <p className="mt-2 text-sm text-gray-600">Accedi al tuo account per continuare</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
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

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              type="password"
              id="password"
              {...register('password')}
              placeholder="Inserisci la tua password"
              className={errors.password ? 'border-red-500' : ''}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {getFieldError('password')}
          </div>

          {/* Work Center Field */}
          <div className="space-y-2">
            <Label htmlFor="workCenter">Centro di Lavoro *</Label>
            <Controller
              control={control}
              name="workCenter"
              render={({ field }) => (
                <Select onValueChange={field.onChange} value={field.value} disabled={isSubmitting}>
                  <SelectTrigger className={errors.workCenter ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Seleziona un centro di lavoro" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</SelectItem>
                    <SelectItem value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</SelectItem>
                    <SelectItem value={WORK_CENTERS.BOTH}>{WORK_CENTERS.BOTH}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {getFieldError('workCenter')}
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
            {isSubmitting ? 'Accesso in corso...' : 'Accedi'}
          </Button>
        </form>

        {/* Additional Links */}
        <div className="text-center space-y-4">
                       <Link to="/forgot-password" className="text-xs text-navy-800 hover:text-navy-600">
            Password dimenticata?
          </Link>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-1 bg-gray-50 text-gray-500">Non hai un account?</span>
            </div>
          </div>
          <Link to="/signup">
                         <Button variant="outline" size="sm" className="w-full">
               Crea Account
             </Button>
          </Link>
        </div>

        {/* Demo Credentials (for development) */}
        {import.meta.env.MODE === 'development' && (
          <div className="mt-4 p-1 bg-gray-50 rounded-lg">
            <details className="group">
              <summary className="cursor-pointer text-xs font-medium text-gray-700 hover:text-gray-900">
                Credenziali Demo (Solo Sviluppo)
              </summary>
              <div className="mt-4 space-y-2">
                               <p className="text-xs text-gray-600"><strong>Email:</strong> demo@example.com</p>
               <p className="text-xs text-gray-600"><strong>Password:</strong> demo123</p>
                                 <Button
                   type="button"
                   variant="outline"
                   size="xs"
                   onClick={() => {
                     setValue('email', 'demo@example.com', { shouldDirty: true, shouldValidate: true });
                     setValue('password', 'demo123', { shouldDirty: true, shouldValidate: true });
                     setValue('workCenter', WORK_CENTERS.ZANICA, { shouldDirty: true, shouldValidate: true });
                   }}
                 >
                  Usa Credenziali Demo
                </Button>
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
