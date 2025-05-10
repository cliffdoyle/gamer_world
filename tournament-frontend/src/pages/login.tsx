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
    username: '',
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
      await login(formData.email, formData.password);
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

  // const handleGithubSignIn = async () => {
  //   try {
  //     // You'll need to implement this in your AuthContext
  //     await githubSignIn();
  //     router.push('/dashboard');
  //   } catch (err: any) {
  //     setError((err && err.message) || 'GitHub sign-in failed. Please try email login or try again later.');
  //     console.error('GitHub auth error:', err);
  //   }
  // };

  if (!isClient) {
    return null; 
  }

  return (
    <>
      <Head>
        <title>Sign in</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#18181c] via-[#23232b] to-[#101014] text-gray-100 font-sans p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-lg border border-white/10 shadow-2xl rounded-2xl p-10 flex flex-col items-center transition-all duration-300">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-lg">Sign in to <span className="text-[#50f0b4]">Gamer World</span></h1>
            <p className="text-gray-400 mt-2 text-base font-medium">Welcome back! Please enter your details below.</p>
          </div>
          <h2 className="text-2xl font-semibold text-white text-center mb-6">
            Sign in
          </h2>

          {success && (
            <div className="bg-green-700/30 border border-green-500 text-green-300 px-4 py-3 rounded mb-6 text-sm" role="alert">
              {success}
            </div>
          )}

          {error && (
            <div className="bg-red-700/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6 text-sm" role="alert">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label htmlFor="username" className="text-gray-300 text-sm">
              Username
            </label>
            <input
              type="text"
              name="username"
              id="username"
              value={formData.username}
              onChange={handleInputChange}
              required
              className="mt-1 w-full px-4 py-3 bg-[#2D2D2D] border border-[#3D3D3D] rounded text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="johnDoe"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="text-gray-300 text-sm">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              className="mt-1 w-full px-4 py-3 bg-[#2D2D2D] border border-[#3D3D3D] rounded text-gray-100 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="password123"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading || !formData.username || !formData.password}
            className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isLoading ? 'Signing in...' : 'Continue'}
          </button>

          <div className="flex items-center my-6">
            <hr className="flex-grow border-[#3D3D3D]" />
            <span className="mx-4 text-gray-500 text-sm">OR</span>
            <hr className="flex-grow border-[#3D3D3D]" />
          </div>

          <div className="mb-4 w-full flex items-center justify-center">
            <GoogleLogin
              onSuccess={handleGoogleLogin}
              onError={() => setError('Google login failed')}
              width="100%"
              theme="filled_black"
              shape="rectangular"
            />
          </div>

          {/* <button
            onClick={handleGithubSignIn}
            className="w-full flex items-center justify-center gap-2 bg-[#2D2D2D] hover:bg-[#353535] text-white font-medium py-3 px-4 rounded border border-[#3D3D3D] transition-colors duration-200 mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
            </svg>
            Continue with GitHub
          </button> */}

          <div className="text-center text-sm text-gray-400">
            Don't have an account?{' '}
            <Link href="/signup" className="text-blue-500 hover:text-blue-400 font-medium">
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