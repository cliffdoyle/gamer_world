import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/contexts/AuthContext'; // Assuming registerUser might be in useAuth
import Head from 'next/head';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { authApi } from '@/lib/api/auth'; // Import your authApi

interface FormData {
  username: string; // Added username
  email: string;
  password: string;
  confirmPassword: string;
}

const SignupPage = () => {
  const [isClient, setIsClient] = useState(false);
  const { googleSignIn } = useAuth(); // Add `registerUser` if it's in useAuth
  const [formData, setFormData] = useState<FormData>({
    username: '',
    email: '',
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
    const newFormData = { ...formData };
    newFormData[e.target.name as keyof FormData] = e.target.value;
    setFormData(newFormData);
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
    if (!formData.email || !formData.username || !formData.password) {
      setError('All fields are required.');
      setIsLoading(false);
      return;
    }

    try {
      // TODO: Implement your register API call here using formData.username, formData.email, formData.password
      // Example: await registerUser(formData.username, formData.email, formData.password);
    // Implement your actual register API call:
            console.log('Attempting to register user:', formData.username);
           const responseData = await authApi.register(formData);

            // Assuming a successful response means the user was created and the token is returned
            // If your auth context has a 'register' function that also handles login/setting state, call that instead.
            // If not, you might want to automatically log the user in or redirect to login.
             console.log('Registration successful for user:', responseData.user.username);
             // Redirect to login, maybe showing a success message
      router.push('/login?registered=true');
    } catch (err: any) {
      setError((err && err.message) || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async (credentialResponse: CredentialResponse) => {
    try {
      if (credentialResponse.credential) {
        await googleSignIn(credentialResponse.credential);
        router.push('/dashboard'); // Or wherever you redirect after Google sign-up
      } else {
        setError('Google sign-up failed: No token received.');
      }
    } catch (err: any) {
      setError((err && err.message) || 'Google sign-up failed. Please try again later.');
      console.error('Google auth error:', err);
    }
  };

  if (!isClient) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Sign up - Gamer World</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-black text-gray-100 font-sans p-4">
        <div className="w-full max-w-md bg-black border border-teal-500/70 shadow-xl shadow-teal-500/20 rounded-lg p-8 sm:p-10 flex flex-col items-center">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-white">Create your <span className="text-teal-400">Gamer World</span> account</h1>
            <p className="text-gray-400 mt-2 text-base font-medium">Join the ultimate gaming community.</p>
          </div>
          
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
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-gray-300 text-sm font-medium block mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500"
                placeholder="you@example.com"
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
                placeholder="Choose a password (min. 6 characters)"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="text-gray-300 text-sm font-medium block mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-colors placeholder-gray-500"
                placeholder="Confirm your password"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !formData.username || !formData.email || !formData.password || !formData.confirmPassword}
              className="w-full bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:shadow-lg shadow-teal-500/30 hover:shadow-teal-600/40 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Creating account...' : 'Continue'}
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
              width="100%"
              theme="filled_black"
              shape="rectangular"
              containerProps={{ style: { width: '100%' } }}
              logo_alignment="center"
            />
          </div>

          <div className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/login" className="text-teal-400 hover:text-teal-300 font-medium">
              Sign in
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

export default SignupPage;