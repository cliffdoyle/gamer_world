export interface User {
  id: string;
  username: string;
  email?: string;
  display_name?: string;
  profile_picture_url?: string;
  bio?: string;
  gaming_handle_psn?: string;
  gaming_handle_xbox?: string;
  gaming_handle_origin_pc?: string;
  preferred_fifa_version?: string;
  favorite_real_world_club?: string;
  provider?: string; // e.g., "google", "credentials"
  // Add any other fields that your user object from the API might have
  // For example, if your API returns created_at, updated_at:
  // created_at?: string; // Or Date
  // updated_at?: string; // Or Date
  rank?: string | null; // Optional rank field
  level?: number; // Optional level field
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  // email?: string; // Consider if email should be part of registration form
  confirmPassword: string;
}

export interface AuthResponse {
  token: string;
  user: User; // This will now use the expanded User type
}

export interface AuthError {
  message: string;
} 