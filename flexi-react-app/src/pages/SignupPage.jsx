import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useErrorHandler } from '../hooks';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-6 px-2 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-4">
        <div className="text-center">
          <h1 className="text-[10px] font-bold text-gray-900">Crea Account</h1>
                       <p className="mt-2 text-[10px] text-gray-600">Registrati per iniziare con il tuo account</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Nome</Label>
              <Input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="Inserisci il tuo nome"
                className={formErrors.firstName ? 'border-red-500' : ''}
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
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Inserisci il tuo cognome"
                className={formErrors.lastName ? 'border-red-500' : ''}
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

          {/* Password Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Crea una password"
                className={formErrors.password ? 'border-red-500' : ''}
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
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Conferma la tua password"
                className={formErrors.confirmPassword ? 'border-red-500' : ''}
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
            {isSubmitting ? 'Creazione Account...' : 'Crea Account'}
          </Button>
        </form>

        {/* Additional Links */}
        <div className="text-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-[10px]">
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
