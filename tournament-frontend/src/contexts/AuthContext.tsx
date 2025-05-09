'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '@/types/auth';
import { useRouter as useRouterPagesRouter } from 'next/router';
import { useRouter as useRouterAppRouter } from 'next/navigation';

// Local User interface definition removed, as it's now imported

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  googleSignIn: (googleIdToken: string) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:8081';

async function apiLogin(usernameOrEmail: string, password: string): Promise<{ token: string; user: User }> {
  console.log('Attempting login for:', usernameOrEmail);
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameOrEmail, password }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Login failed with status: ' + response.status }));
    throw new Error(errorData.error || 'Login failed');
  }
  return response.json(); // Expecting { token: string, user: User } directly from API
}

async function apiGoogleSignIn(googleIdToken: string): Promise<{ token: string; user: User }> {
  console.log('Attempting Google sign-in with token...');
  const response = await fetch(`${API_BASE_URL}/auth/google/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: googleIdToken }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Google Sign-In failed with status: ' + response.status }));
    throw new Error(errorData.error || 'Google Sign-In failed');
  }
  return response.json(); // Expecting { token: string, user: User } directly from API
}

async function apiFetchUserProfile(token: string): Promise<User> {
  console.log('Fetching user profile...');
  const response = await fetch(`${API_BASE_URL}/user/profile`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized: Invalid or expired token');
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch profile with status: ' + response.status }));
    throw new Error(errorData.error || 'Failed to fetch user profile');
  }
  const data = await response.json(); // Expecting { user: UserData } from API
  return data.user as User;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Safely check which routing system is available
  let routerPagesRouter = null;
  let routerAppRouter = null;
  
  // Only run in browser
  if (typeof window !== 'undefined') {
    try {
      // Try Pages Router first (wrapped in try-catch to avoid breaking)
      routerPagesRouter = useRouterPagesRouter();
    } catch (e) {
      console.log('Pages Router not available');
    }
    
    try {
      // Try App Router
      routerAppRouter = useRouterAppRouter();
    } catch (e) {
      console.log('App Router not available');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return; // Don't run on server-side

    const storedToken = localStorage.getItem('authToken');
    if (storedToken) {
      setToken(storedToken);
      apiFetchUserProfile(storedToken)
        .then(userData => {
          setUser(userData);
        })
        .catch(error => {
          console.error('Session restore failed:', error);
          localStorage.removeItem('authToken');
          setToken(null);
          setUser(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleAuthSuccess = (responseData: { token: string; user: User }) => {
    setToken(responseData.token);
    localStorage.setItem('authToken', responseData.token);
    setUser(responseData.user); // User from API response is now the full User type
  };

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const responseData = await apiLogin(usernameOrEmail, password);
      // The /auth/login in Go service now returns the full user object with profile fields
      handleAuthSuccess(responseData);
    } catch (error) {
      console.error('Login error:', error);
      setUser(null);
      setToken(null);
      localStorage.removeItem('authToken');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const googleSignIn = async (googleIdToken: string) => {
    setIsLoading(true);
    try {
      const responseData = await apiGoogleSignIn(googleIdToken);
      // The /auth/google/signin in Go service now returns the full user object
      handleAuthSuccess(responseData);
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setUser(null);
      setToken(null);
      localStorage.removeItem('authToken');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    
    // Navigate based on available router
    if (routerPagesRouter) {
      routerPagesRouter.push('/login');
    } else if (routerAppRouter) {
      routerAppRouter.push('/login');
    } else {
      // Fallback if no router available
      window.location.href = '/login';
    }
  };

  const fetchUserProfile = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
        const userData = await apiFetchUserProfile(token);
        setUser(userData);
    } catch (error) {
        console.error("Error fetching user profile in context:", error);
        if (error instanceof Error && error.message.includes('Unauthorized')) {
            logout();
        }
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, isAuthenticated: !!token && !!user, login, googleSignIn, logout, fetchUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 