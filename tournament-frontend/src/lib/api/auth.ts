import { API_CONFIG } from '../../config';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '@/types/auth';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const response = await fetch(`${API_CONFIG.AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const { confirmPassword, ...credentials } = data;
    const response = await fetch(`${API_CONFIG.AUTH_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },
  
  googleSignIn: async (idToken: string): Promise<AuthResponse> => {
    const response = await fetch(`${API_CONFIG.AUTH_URL}/auth/google/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Google sign-in failed');
    }

    return response.json();
  },
  
  getProfile: async (token: string): Promise<{ user: User }> => {
    const response = await fetch(`${API_CONFIG.AUTH_URL}/user/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch profile');
    }

    return response.json();
  },
  
  updateProfile: async (token: string, profileData: Partial<User>): Promise<{ message: string }> => {
    const response = await fetch(`${API_CONFIG.AUTH_URL}/user/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json();
  },
}; 