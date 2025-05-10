import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext';
import Head from 'next/head';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';

const LoginPage = () => {
  const [isClient, setIsClient] = useState(false);
  const { login, googleSignIn, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    username: '', // Assuming 'email' was a typo and it should be username or email based on input field
    email: '', // Added email for consistency if login uses email
    password: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    
    if (router.query.registered === 'true') {
      setSuccess('Account created successfully! Please log in.');
    }
    
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [router.query, isAuthenticated, isClient, router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ 
      ...formData, 
      [e.target.name]: e.target.value 
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Use formData.email or formData.username depending on your backend requirement
      await login(formData.username, formData.password); // Or formData.email
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    try {
      if (credentialResponse.credential) {
        await googleSignIn(credentialResponse.credential);
        router.push('/dashboard');
      } else {
        setError('Google sign-in failed: No token received.');
      }
    } catch (err: any) {
      setError((err && err.message) || 'Google sign-in failed. Please try email login or try again later.');
      console.error('Google auth error:', err);
    }
  };

  if (!isClient) {
    return null; 
  }

  return (
    <>
      <Head>
        <title>Sign in</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-black text-gray-100 font-sans p-4">
        <div className="w-full max-w-md bg-black border border-teal-500/70 shadow-xl shadow-teal-500/20 rounded-lg p-8 sm:p-10 flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Sign in to <span className="text-teal-400">Gamer World</span></h1>
            <p className="text-gray-400 mt-2 text-base font-medium">Welcome back! Please enter your details.</p>
          </div>
          
          {success && (
            <div className="bg-teal-600/20 border border-teal-500 text-teal-300 px-4 py-3 rounded-lg mb-6 text-sm w-full" role="alert">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-red-600/20 border border-red-500 text-red-300 px-4 py-3 rounded-lg mb-6 text-sm w-full" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div>
              <label htmlFor="username" className="text-gray-300 text-sm font-medium block mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                id="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500"
                placeholder="johnDoe"
              />
            </div>

            <div>
              <label htmlFor="password" className="text-gray-300 text-sm font-medium block mb-1">
                Password
              </label>
              <input
                type="password"
                name="password"
                id="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.username || !formData.password}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg shadow-teal-500/30 hover:shadow-teal-600/40 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Continue'}
            </button>
          </form>

          <div className="flex items-center my-6 w-full">
            <hr className="flex-grow border-gray-700" />
            <span className="mx-4 text-gray-500 text-sm">OR</span>
            <hr className="flex-grow border-gray-700" />
          </div>

          <div className="mb-6 w-full flex items-center justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setError('Google login failed')}
              width="100%" // You might need to wrap this in a div and set its width to 100% for full effect.
              theme="filled_black" // This theme fits well with dark designs
              shape="rectangular"
              containerProps={{ style: { width: '100%' } }}
              logo_alignment="center"
            />
          </div>
          
          <div className="text-center text-sm text-gray-400 mt-4">
            Don't have an account?{' '}
            <Link href="/signup" className="text-teal-400 hover:text-teal-300 font-medium">
              Sign up
            </Link>
          </div>
          
          <div className="mt-8 text-center text-xs text-gray-500">
            Terms of Service and Privacy Policy
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;