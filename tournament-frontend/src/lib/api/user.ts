// src/lib/api/user.ts
import { API_CONFIG } from '@/config';
import { User } from '@/types/auth'; // Assuming your main User type from auth.ts is sufficient for now

// DTO for the response from /user/list-for-linking
export interface UserForLinkingResponse {
  id: string; // UUID string
  username: string;
  // displayName?: string;
}

interface ListUsersResponse { // Matches the structure returned by the new Go handler
    users: UserForLinkingResponse[];
    // page?: number;
    // pageSize?: number;
    // total?: number;
}


export const userApi = {
  /**
   * Fetches a list of users for linking to tournament participants.
   * Requires authentication token.
   */
  listUsersForLinking: async (token: string): Promise<ListUsersResponse> => {
    try {
      const response = await fetch(`${API_CONFIG.AUTH_URL}${API_CONFIG.ENDPOINTS.USERS_FOR_LINKING}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          message: `Failed to fetch users for linking (status ${response.status})`,
        }));
        console.error('Error fetching users for linking:', errorData);
        throw new Error(errorData.message || 'Failed to fetch users for linking');
      }
      return await response.json();
    } catch (error) {
      console.error('Error in listUsersForLinking API call:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while fetching users for linking');
    }
  },

  // You can move getProfile and updateProfile from authApi here if you want to separate concerns more.
  // For now, let's leave them in authApi as they are closely tied to auth state.
};