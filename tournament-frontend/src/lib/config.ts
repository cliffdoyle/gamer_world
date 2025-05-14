// src/config.ts

export const API_CONFIG = {
  BASE_URL: 'http://localhost:8082', // Tournament Service
  AUTH_URL: 'http://localhost:8081', // User Service (Authentication)
  RANKING_URL: 'http://localhost:8083', // <<< ADD RANKING SERVICE URL
  ENDPOINTS: {
    // User Service Endpoints (via AUTH_URL)
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    GOOGLE_SIGN_IN: '/auth/google/signin',
    PROFILE: '/user/profile', // Used for getProfile and updateProfile

    // Tournament Service Endpoints (via BASE_URL)
    TOURNAMENTS: '/tournaments',
    ACTIVE_TOURNAMENTS_DASHBOARD: '/dashboard/active-tournaments', // Your existing dashboard endpoint
    RECENT_ACTIVITIES_DASHBOARD: '/dashboard/activities',     // Your existing dashboard endpoint
    PARTICIPANTS: (tournamentId: string) => `/tournaments/${tournamentId}/participants`,
    TOURNAMENT_DETAIL: (id: string) => `/tournaments/${id}`,
    MATCHES: (tournamentId: string) => `/tournaments/${tournamentId}/matches`,
    GENERATE_BRACKET: (id: string) => `/tournaments/${id}/bracket`,
    UPDATE_MATCH: (tournamentId: string, matchId: string) => `/tournaments/${tournamentId}/matches/${matchId}`,
    TOURNAMENT_STATUS: (id: string) => `/tournaments/${id}/status`,

    // Ranking Service Endpoints (via RANKING_URL)
    USER_RANKING_STATS: (userId: string, gameId?: string) => // userId is UUID string
      `/rankings/users/${userId}${gameId ? `?gameId=${gameId}` : ''}`,
    LEADERBOARD: (gameId?: string, page?: number, pageSize?: number) => {
        const params = new URLSearchParams();
        if (gameId) params.append('gameId', gameId);
        if (page) params.append('page', page.toString());
        if (pageSize) params.append('pageSize', pageSize.toString());
        return `/rankings/leaderboard${params.size > 0 ? `?${params.toString()}` : ''}`;
    }

  },
} as const;