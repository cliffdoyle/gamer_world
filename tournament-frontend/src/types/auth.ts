// src/types/auth.ts

export interface User {
  id: string; // User's UUID
  username: string;
  email?: string; // Your backend uses email for standard registration
  display_name?: string;
  profile_picture_url?: string;
  bio?: string;
  // ... other existing fields you have ...
  provider?: string;

  // Stats from Ranking Service
  rankTitle?: string | null;     // e.g., "Bronze", "Gold", "Unranked"
  level?: number;                // e.g., 1, 2, 3
  points?: number;
  globalRank?: number | null;    // Numerical rank, e.g., 1, 10, 0 for unranked
  winRate?: number;              // e.g., 0.75 for 75%
  totalGamesPlayed?: number;
  matchesWon?: number;
  matchesDrawn?: number;
  matchesLost?: number;
  tournamentsPlayed?: number;
  statsLastUpdatedAt?: string; // ISO date string from ranking service's UserOverallStats.updatedAt
}

// Type for the data sent to the login endpoint
export interface LoginRequest {
  // Assuming your backend login expects username or email
  username: string; // Or call this 'identifier', but backend specifically uses 'username' key in payload
  password: string;
}

// Type for the data RECEIVED by authApi.register FROM the frontend form.
// This INCLUDES confirmPassword as the frontend form contains it.
// authApi.register is responsible for REMOVING confirmPassword before sending to the backend.
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string; // <--- You need to define this property here
}

// Type for the successful response from auth/login, auth/register, auth/google/signin
export interface AuthResponse {
  token: string;
  user: User;
}

// Optional: Type for error responses if your backend has a standard error structure
// export interface AuthError {
//   message: string; // The error message string
//   code?: string; // Optional error code from your backend
//   details?: any; // Optional field for more error details
// }