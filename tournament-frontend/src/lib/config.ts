export const API_CONFIG = {
  BASE_URL: 'http://localhost:8082',
  AUTH_URL: 'http://localhost:8081',
  ENDPOINTS: {
    LOGIN: '/login',
    REGISTER: '/register',
    TOURNAMENTS: '/tournaments',
    PARTICIPANTS: (tournamentId: string) => `/tournaments/${tournamentId}/participants`,
    TOURNAMENT_DETAIL: (id: string) => `/tournaments/${id}`,
    GENERATE_BRACKET: (id: string) => `/tournaments/${id}/bracket`,
    UPDATE_MATCH: (tournamentId: string, matchId: string) => `/tournaments/${tournamentId}/matches/${matchId}`,
  },
} as const; 