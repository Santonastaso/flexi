import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../store';
import { WORK_CENTERS } from '../constants';
import { useErrorHandler } from '../hooks';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-2 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-[10px] font-bold text-gray-900">Bentornato</h1>
                       <p className="mt-2 text-[10px] text-gray-600">Accedi al tuo account per continuare</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Indirizzo Email</Label>
            <Input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Inserisci la tua email"
              className={formErrors.email ? 'border-red-500' : ''}
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
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Inserisci la tua password"
              className={formErrors.password ? 'border-red-500' : ''}
              disabled={isSubmitting}
              autoComplete="current-password"
            />
            {getFieldError('password')}
          </div>

          {/* Work Center Field */}
          <div className="space-y-2">
            <Label htmlFor="workCenter">Centro di Lavoro *</Label>
            <Select onValueChange={(value) => handleChange({ target: { name: 'workCenter', value } })} value={formData.workCenter}>
              <SelectTrigger className={formErrors.workCenter ? 'border-red-500' : ''}>
                <SelectValue placeholder="Seleziona un centro di lavoro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WORK_CENTERS.ZANICA}>{WORK_CENTERS.ZANICA}</SelectItem>
                <SelectItem value={WORK_CENTERS.BUSTO_GAROLFO}>{WORK_CENTERS.BUSTO_GAROLFO}</SelectItem>
                <SelectItem value={WORK_CENTERS.BOTH}>{WORK_CENTERS.BOTH}</SelectItem>
              </SelectContent>
            </Select>
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
                  <p className="text-[10px] text-red-800">{authError}</p>
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
                       <Link to="/forgot-password" className="text-[10px] text-navy-800 hover:text-navy-600">
            Password dimenticata?
          </Link>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-[10px]">
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
              <summary className="cursor-pointer text-[10px] font-medium text-gray-700 hover:text-gray-900">
                Credenziali Demo (Solo Sviluppo)
              </summary>
              <div className="mt-4 space-y-2">
                               <p className="text-[10px] text-gray-600"><strong>Email:</strong> demo@example.com</p>
               <p className="text-[10px] text-gray-600"><strong>Password:</strong> demo123</p>
                                 <Button
                   type="button"
                   variant="outline"
                   size="xs"
                   onClick={() => setFormData({ email: 'demo@example.com', password: 'demo123', workCenter: WORK_CENTERS.ZANICA })}
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
