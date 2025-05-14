// src/lib/api/ranking.ts
import { API_CONFIG } from '@/config';
import { UserOverallStats } from '@/types/ranking'; // We'll define this type next

export const rankingApi = {
  /**
   * Fetches the overall ranking statistics for a specific user.
   * @param token - The authentication token (may not be strictly needed by ranking service if it trusts internal calls or uses a different auth mechanism like an API key).
   * @param userId - The UUID of the user.
   * @param gameId - Optional game ID to get stats for a specific game. Defaults to "global" if not provided.
   */
  getUserRankingStats: async (
    token: string, // Pass token for consistency, even if ranking service doesn't use it directly for this endpoint
    userId: string,
    gameId?: string
  ): Promise<UserOverallStats> => {
    try {
      const endpoint = API_CONFIG.ENDPOINTS.USER_RANKING_STATS(userId, gameId);
      const response = await fetch(`${API_CONFIG.RANKING_URL}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // If your ranking service expects an Authorization header or an inter-service key:
          // 'Authorization': `Bearer ${token}`,
          // 'X-Internal-Service-Key': 'YOUR_INTERNAL_KEY_IF_ANY'
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `Failed to fetch user ranking stats (status ${response.status})`,
        }));
        console.error('Error fetching user ranking stats:', errorData);
        throw new Error(errorData.message || 'Failed to fetch user ranking stats');
      }

      return await response.json();
    } catch (error) {
      console.error('Error in getUserRankingStats:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching user ranking stats');
    }
  },

  // You can add getLeaderboard API call here later if needed for a leaderboard page
  /*
  getLeaderboard: async (gameId?: string, page: number = 1, pageSize: number = 20): Promise<PaginatedLeaderboardResponse> => {
    const endpoint = API_CONFIG.ENDPOINTS.LEADERBOARD(gameId, page, pageSize);
    const response = await fetch(`${API_CONFIG.RANKING_URL}${endpoint}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch leaderboard' }));
      throw new Error(error.message || 'Failed to fetch leaderboard');
    }
    return response.json();
  },
  */
};