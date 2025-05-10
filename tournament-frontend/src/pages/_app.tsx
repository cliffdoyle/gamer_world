/*
import type { AppProps } from 'next/app';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  // Get Google Client ID from environment variable
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    // Check if Google Client ID is properly configured
    if (!googleClientId) {
      console.error(
        'NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google authentication will not work properly.',
        'Make sure you have added this environment variable to your .env.local file.'
      );
    } else if (googleClientId.includes('your-client-id') || googleClientId.length < 20) {
      console.error(
        'NEXT_PUBLIC_GOOGLE_CLIENT_ID appears to be invalid or a placeholder.',
        'Make sure you have replaced the placeholder with your actual Google Client ID.'
      );
    } else {
      console.log('Google OAuth client ID is configured properly.');
    }
    
    setIsClientReady(true);
  }, [googleClientId]);

  // Don't render until client-side code can run
  if (!isClientReady && typeof window !== 'undefined') {
    return null;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </GoogleOAuthProvider>
  );
} 
*/ 