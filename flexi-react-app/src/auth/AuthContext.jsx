import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase/client';
import { WORK_CENTERS } from '../constants';
import { AppError, ERROR_TYPES } from '../utils/errorHandling';

// Create the authentication context
const AuthContext = createContext();

/**
 * AuthProvider component that manages authentication state
 * Provides user session management and authentication functions
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize authentication state
  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          setError('Failed to initialize authentication');
        } else {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
        }
      } catch (_error) {
        const appError = new AppError('Failed to initialize authentication', ERROR_TYPES.AUTHENTICATION_ERROR, 401, _error, 'AuthContext.getInitialSession');
        setError(appError.message);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        setError(null);

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            break;
          case 'SIGNED_OUT':
            break;
          case 'TOKEN_REFRESHED':
            break;
          case 'USER_UPDATED':
            break;
          case 'INITIAL_SESSION':
            break;
        }
      }
    );

    // Cleanup subscription on unmount
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Sign in with email and password
   */
  const signIn = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      return { success: true, user: data.user };
      
    } catch (_error) {
      const appError = _error instanceof AppError ? _error : new AppError(_error.message, ERROR_TYPES.AUTHENTICATION_ERROR, 401, _error, 'AuthContext.signIn');
      setError(appError.message);
      return { success: false, error: appError.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up with email and password
   */
  const signUp = async (email, password, userData = {}) => {
    try {
      setError(null);
      setLoading(true);
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData, // Additional user metadata
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      return { success: true, user: data.user };
      
    } catch (_error) {
      setError(_error.message);
      return { success: false, error: _error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign out the current user
   */
  const signOut = async () => {
    try {
      setError(null);
      setLoading(true);
      
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        throw signOutError;
      }

      return { success: true };
      
    } catch (_error) {
      setError(_error.message);
      return { success: false, error: _error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Reset password for a user
   */
  const resetPassword = async (email) => {
    try {
      setError(null);
      setLoading(true);
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) {
        throw resetError;
      }

      return { success: true };
      
    } catch (_error) {
      setError(_error.message);
      return { success: false, error: _error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Update user profile
   */
  const updateProfile = async (updates) => {
    try {
      setError(null);
      setLoading(true);
      
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: updates,
      });

      if (updateError) {
        throw updateError;
      }

      return { success: true, user: data.user };
      
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get user profile from profiles table
   */
  const getUserProfile = async () => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      return null;
    }
  };

  // Context value
  const value = {
    user,
    session,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updateProfile,
    getUserProfile,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Custom hook to use the authentication context
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
