// src/types/auth.ts
export interface User {
  id: string; // User's UUID
  username: string;
  email?: string;
  display_name?: string;
  profile_picture_url?: string;
  bio?: string;
  // ... other existing fields ...
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

// AuthResponse and other types remain the same
export interface LoginRequest { /* ... */ }
export interface RegisterRequest extends LoginRequest { /* ... */ }
export interface AuthResponse {
  token: string;
  user: User;
}
export interface AuthError { /* ... */ }