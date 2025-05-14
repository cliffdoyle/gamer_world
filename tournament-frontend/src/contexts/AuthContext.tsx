// src/contexts/AuthContext.tsx
'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as AuthUserType } from '@/types/auth'; // Your main User type
import { UserOverallStats } from '@/types/ranking';   // Type for stats from ranking service
import { useRouter as useRouterPagesRouter } from 'next/router'; // Keep if used
import { useRouter as useRouterAppRouter } from 'next/navigation'; // Keep if used
import { rankingApi } from '@/lib/api/ranking'; // Import ranking API

// API_BASE_URL is defined inside the AuthProvider
// Removed local User interface, as it's imported.

interface AuthContextType {
  user: AuthUserType | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  googleSignIn: (googleIdToken: string) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>; // To refresh user data including stats
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Define API_BASE_URL for user-service (auth)
const USER_SERVICE_API_URL = process.env.NEXT_PUBLIC_USER_SERVICE_URL || 'http://localhost:8081';

// --- API Helper Functions for User Service ---
async function apiLogin(usernameOrEmail: string, password: string): Promise<{ token: string; user: AuthUserType }> {
  console.log('Attempting login for:', usernameOrEmail);
  const response = await fetch(`${USER_SERVICE_API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: usernameOrEmail, password }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Login failed with status: ' + response.status }));
    throw new Error(errorData.error || 'Login failed');
  }
  return response.json();
}

async function apiGoogleSignIn(googleIdToken: string): Promise<{ token: string; user: AuthUserType }> {
  console.log('Attempting Google sign-in with token...');
  const response = await fetch(`${USER_SERVICE_API_URL}/auth/google/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id_token: googleIdToken }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Google Sign-In failed with status: ' + response.status }));
    if (errorData.code === 'auth_config_error') throw new Error('Authentication service configuration issue. Please try again later or use email login.');
    if (errorData.code === 'token_expired') throw new Error('Your login session has expired. Please try signing in again.');
    if (errorData.code === 'account_exists') throw new Error(`An account with this email already exists. Please sign in with ${errorData.provider || 'another method'}.`);
    throw new Error(errorData.error || 'Google Sign-In failed. Please try again or use email/password login.');
  }
  return response.json();
}

async function apiFetchUserProfileFromUserService(token: string): Promise<AuthUserType> {
  console.log('Fetching base user profile from User Service...');
  const response = await fetch(`${USER_SERVICE_API_URL}/user/profile`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized: Invalid or expired token');
    const errorData = await response.json().catch(() => ({ error: 'Failed to fetch profile with status: ' + response.status }));
    throw new Error(errorData.error || 'Failed to fetch user profile');
  }
  const data = await response.json(); // Expecting { user: UserData }
  return data.user as AuthUserType;
}
// --- End of API Helper Functions ---


export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUserType | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  let routerPagesRouter = null;
  let routerAppRouter = null;

  if (typeof window !== 'undefined') {
    try { routerPagesRouter = useRouterPagesRouter(); } catch (e) { /* console.log('Pages Router not available'); */ }
    try { routerAppRouter = useRouterAppRouter(); } catch (e) { /* console.log('App Router not available'); */ }
  }

  // Helper function to enrich user data with ranking stats
  const fetchAndMergeRankingStats = async (
    apiToken: string,
    baseUser: AuthUserType
  ): Promise<AuthUserType> => {
    if (!baseUser || !baseUser.id) {
      console.warn("fetchAndMergeRankingStats: baseUser or baseUser.id is missing.");
      return baseUser; // Return base user if ID is not available
    }

    let enrichedUser = { ...baseUser };
    try {
      console.log(`Fetching ranking stats for user ID: ${baseUser.id}`);
      // Assuming baseUser.id is the UUID string. gameId can be "global" or omitted for default.
      const stats: UserOverallStats = await rankingApi.getUserRankingStats(apiToken, baseUser.id);
      
      enrichedUser = {
        ...enrichedUser,
        rankTitle: stats.rankTitle,
        level: stats.level,
        points: stats.points,
        globalRank: stats.globalRank,
        winRate: stats.winRate,
        totalGamesPlayed: stats.totalGamesPlayed,
        matchesWon: stats.matchesWon,
        matchesDrawn: stats.matchesDrawn,
        matchesLost: stats.matchesLost,
        tournamentsPlayed: stats.tournamentsPlayed,
        statsLastUpdatedAt: stats.updatedAt,
      };
      console.log("User enriched with stats:", enrichedUser);
    } catch (statsError) {
      console.warn("AuthContext: Failed to fetch user ranking stats. Proceeding with base user data.", statsError);
      // Set default/fallback values for stats if fetch fails
      enrichedUser.rankTitle = enrichedUser.rankTitle || "Unranked";
      enrichedUser.level = enrichedUser.level || 1;
      enrichedUser.points = enrichedUser.points || 0;
      enrichedUser.globalRank = enrichedUser.globalRank === undefined ? null : enrichedUser.globalRank;
      enrichedUser.winRate = enrichedUser.winRate === undefined ? undefined : enrichedUser.winRate; // Keep as number or undefined
      enrichedUser.totalGamesPlayed = enrichedUser.totalGamesPlayed || 0;
      enrichedUser.matchesWon = enrichedUser.matchesWon || 0;
      enrichedUser.matchesDrawn = enrichedUser.matchesDrawn || 0;
      enrichedUser.matchesLost = enrichedUser.matchesLost || 0;
      enrichedUser.tournamentsPlayed = enrichedUser.tournamentsPlayed || 0;
      enrichedUser.statsLastUpdatedAt = enrichedUser.statsLastUpdatedAt || undefined;
    }
    return enrichedUser;
  };


  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      if (storedToken) {
        setToken(storedToken);
        try {
          const baseUserData = await apiFetchUserProfileFromUserService(storedToken);
          const enrichedUserData = await fetchAndMergeRankingStats(storedToken, baseUserData);
          setUser(enrichedUserData);
        } catch (error) {
          console.error('Session restore failed:', error);
          localStorage.removeItem('authToken');
          setToken(null);
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };
    initializeAuth();
  }, []);

  const handleAuthSuccess = async (responseData: { token: string; user: AuthUserType }) => {
    setToken(responseData.token);
    localStorage.setItem('authToken', responseData.token);
    // Enrich with ranking stats before setting the user
    const enrichedUser = await fetchAndMergeRankingStats(responseData.token, responseData.user);
    setUser(enrichedUser);
  };

  const login = async (usernameOrEmail: string, password: string) => {
    setIsLoading(true);
    try {
      const responseData = await apiLogin(usernameOrEmail, password);
      await handleAuthSuccess(responseData); // handleAuthSuccess now fetches stats
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
      await handleAuthSuccess(responseData); // handleAuthSuccess now fetches stats
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
    if (routerPagesRouter) routerPagesRouter.push('/login');
    else if (routerAppRouter) routerAppRouter.push('/login');
    else window.location.href = '/login';
  };

  const fetchUserProfile = async () => { // This function now refreshes both base profile and ranking stats
    if (!token) {
        console.log("fetchUserProfile: No token, cannot fetch.");
        return;
    }
    setIsLoading(true);
    try {
      const baseUserData = await apiFetchUserProfileFromUserService(token);
      const enrichedUserData = await fetchAndMergeRankingStats(token, baseUserData);
      setUser(enrichedUserData);
    } catch (error) {
      console.error("Error fetching user profile in context:", error);
      if (error instanceof Error && (error.message.includes('Unauthorized') || error.message.includes('Invalid or expired token'))) {
        logout(); // Logout if token is invalid
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