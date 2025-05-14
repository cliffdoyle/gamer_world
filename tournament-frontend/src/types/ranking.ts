// src/types/ranking.ts

export interface UserOverallStats {
  userId: string; // UUID
  gameId: string;
  level: number;
  rankTitle: string;
  points: number;
  globalRank: number; // This is the numerical rank position
  winRate: number;    // e.g., 0.75 for 75%
  totalGamesPlayed: number;
  matchesWon: number;
  matchesDrawn: number;
  matchesLost: number;
  tournamentsPlayed: number;
  updatedAt: string; // ISO date string
}

// If you implement getLeaderboard later:

export interface LeaderboardEntry {
  rank: number;
  userId: string; // UUID
  userName?: string; // Populated by ranking service after calling user service
  score: number;
}

export interface PaginatedLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  totalPlayers: number;
  page: number;
  pageSize: number;
  gameId: string;
}
