export interface User {
  id: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  confirmPassword: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AuthError {
  message: string;
} 