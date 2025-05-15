// src/components/auth/SignupForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Use next/navigation for App Router
import { useAuth } from '@/contexts/AuthContext';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { authApi } from '@/lib/api/auth'; // Assuming register is in authApi

interface FormData {
  username: string;
  // email: string; // Assuming username is primary, email can be part of profile later or optional
  password: string;
  confirmPassword: string;
}

interface SignupFormProps {
  onSignupSuccess?: () => void; // Optional callback
  showTitle?: boolean; // To control if the "Create Account" title is shown
}

const SignupForm: React.FC<SignupFormProps> = ({ onSignupSuccess, showTitle = true }) => {
  const [isClient, setIsClient] = useState(false);
  const { googleSignIn, login } = useAuth(); // login might be needed after registration for auto-login
  const [formData, setFormData] = useState<FormData>({
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setIsLoading(false);
      return;
    }
    if ( !formData.username || !formData.password) { // Removed email check if not in form
      setError('Username and password are required.');
      setIsLoading(false);
      return;
    }

    try {
      // Use your authApi.register method
      // Pass only username and password if email is not part of the primary registration form
      const authResponse = await authApi.register({ 
        username: formData.username, 
        password: formData.password,
        confirmPassword: formData.confirmPassword, // authApi might not need this if validation is frontend only
      });
      
      // Optional: Automatically log in the user after successful registration
      // await login(formData.username, formData.password); // If your API doesn't auto-login

      if (onSignupSuccess) {
        onSignupSuccess();
      } else {
        // Default redirect if no callback, possibly to login or dashboard
        router.push('/login?registered=true'); 
      }

    } catch (err: any) {
      setError((err && err.message) || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(''); setIsLoading(true);
    try {
      if (credentialResponse.credential) {
        await googleSignIn(credentialResponse.credential); // This should set user and token in AuthContext
        if (onSignupSuccess) {
          onSignupSuccess();
        } else {
          router.push('/dashboard');
        }
      } else {
        setError('Google sign-up failed: No token received.');
      }
    } catch (err: any) {
      setError((err && err.message) || 'Google sign-up failed. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };


  if (!isClient) { // Important for GoogleLogin to render correctly
    return null; 
  }

  return (
    <div className="w-full bg-black/50 border border-teal-500/30 shadow-xl shadow-teal-500/10 rounded-lg p-6 sm:p-8">
      {showTitle && (
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Join <span className="text-teal-400">Gamer World</span>
          </h2>
          <p className="text-gray-400 mt-1 text-sm">Create your account to start competing.</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-600/20 border border-red-500 text-red-300 px-3 py-2.5 rounded-md mb-5 text-sm w-full" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full space-y-5">
        <div>
          <label htmlFor="username-signup" className="text-gray-300 text-xs font-medium block mb-1.5">
            Username
          </label>
          <input
            type="text"
            name="username"
            id="username-signup" // Unique ID
            value={formData.username}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-md text-gray-100 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500 text-sm"
            placeholder="Choose your gamer tag"
          />
        </div>

        {/* Email field removed as per simpler signup approach, can be added later */}

        <div>
          <label htmlFor="password-signup" className="text-gray-300 text-xs font-medium block mb-1.5">
            Password
          </label>
          <input
            type="password"
            name="password"
            id="password-signup" // Unique ID
            value={formData.password}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-md text-gray-100 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500 text-sm"
            placeholder="Min. 6 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword-signup" className="text-gray-300 text-xs font-medium block mb-1.5">
            Confirm Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            id="confirmPassword-signup" // Unique ID
            value={formData.confirmPassword}
            onChange={handleInputChange}
            required
            className="w-full px-3 py-2.5 bg-gray-900 border border-gray-700 rounded-md text-gray-100 focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500 text-sm"
            placeholder="Re-enter your password"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || !formData.username || !formData.password || !formData.confirmPassword}
          className="w-full bg-teal-500 hover:bg-teal-600 text-black font-semibold py-2.5 px-4 rounded-md shadow-md hover:shadow-lg shadow-teal-500/20 hover:shadow-teal-600/30 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
        >
          {isLoading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="flex items-center my-5 w-full">
        <hr className="flex-grow border-gray-700" />
        <span className="mx-3 text-gray-500 text-xs">OR</span>
        <hr className="flex-grow border-gray-700" />
      </div>
      
      <div className="w-full flex items-center justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => { setError('Google Sign-Up Failed. Please try again or use username/password.'); setIsLoading(false); }}
            width="100%" // Adjust as needed, or remove for default width
            theme="filled_black"
            shape="rectangular"
            logo_alignment="center"
            containerProps={{ style: { width: '100%', display: 'flex', justifyContent: 'center' } }} // Center the button
          />
      </div>

      <div className="mt-6 text-center text-xs text-gray-400">
        Already a member?{' '}
        <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium">
          Sign In
        </Link>
      </div>
    </div>
  );
};

export default SignupForm;