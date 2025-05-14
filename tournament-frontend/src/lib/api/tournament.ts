// src/lib/api/tournament.ts (or your API file name)

import { API_CONFIG } from '../config';
import {
  TournamentResponse, // This is likely your existing detailed frontend Tournament type
  CreateTournamentRequest,
  Participant,
  Match,
  // Add types needed for dashboard responses if not already covered
  TournamentResponse as BackendTournamentResponse, // Assuming this matches your server's output
  UserActivity as BackendUserActivity,             // Assuming this matches your server's output
} from '@/types/tournament';

interface TournamentListResponse { // Existing response for getAllTournaments
  page: number;
  page_size: number;
  total: number;
  tournaments: TournamentResponse[]; // This uses your existing frontend Tournament type
}

interface AddParticipantRequest {
  participant_name: string;
}


// === START: Dashboard Specific Interfaces (from previous suggestion) ===
// If these backend types (BackendTournamentResponse, BackendUserActivity) are already defined
// and used by your existing types in '@/types/tournament', you might not need separate Dashboard* types.
// The key is that these interfaces match what the /dashboard/... endpoints return.

interface PaginatedTournamentsResponse {
  tournaments: BackendTournamentResponse[];
  total: number;
  page: number;
  pageSize: number; // Or page_size, ensure it matches backend response
}

interface PaginatedActivitiesResponse {
  activities: BackendUserActivity[];
  total: number;
  page: number;
  pageSize: number; // Or page_size
}
// === END: Dashboard Specific Interfaces ===


export const tournamentApi = {
  // ... (your existing getAllTournaments, createTournament, getTournament, etc. methods remain here) ...

  // Get all tournaments
  getAllTournaments: async (token: string): Promise<TournamentListResponse> => { // Note: using TournamentListResponse here
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENTS}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch tournaments');
    }

    return response.json();
  },

  // Create tournament
  createTournament: async (token: string, data: CreateTournamentRequest): Promise<TournamentResponse> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENTS}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create tournament');
    }

    return response.json();
  },

  // Get tournament by ID - NOTE: This should return BackendTournamentResponse if that's what the endpoint provides
  getTournament: async (token: string, id: string): Promise<BackendTournamentResponse> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENT_DETAIL(id)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Server error response (getTournament):', responseData);
      throw new Error(responseData.message || responseData.error || 'Failed to fetch tournament');
    }

    return responseData;
  },

  // Update tournament status
  updateTournamentStatus: async (
    token: string,
    tournamentId: string,
    status: string // Assuming status is a string that matches backend enum
  ): Promise<BackendTournamentResponse> => { // Assuming it returns the updated tournament object
    try {
      if (!token) {
        throw new Error('Authentication token is required');
      }

      if (!tournamentId) {
        throw new Error('Tournament ID is required');
      }

      const response = await fetch(
        // Assuming the status update endpoint is same as tournament detail with PUT
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENT_STATUS(tournamentId)}`, // Use specific status endpoint if different
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to update tournament status (${response.status})` }));
        throw new Error(errorData.message || 'Failed to update tournament status');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating tournament status:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while updating tournament status');
    }
  },

  // Get tournament participants
  getParticipants: async (token: string, tournamentId: string): Promise<Participant[]> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PARTICIPANTS(tournamentId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch participants');
    }

    return response.json();
  },

  // Add participant to tournament
  addParticipant: async (token: string, tournamentId: string, data: { name: string }): Promise<Participant> => {
    console.log('API sending data for addParticipant:', {
      participant_name: data.name
    });
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PARTICIPANTS(tournamentId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participant_name: data.name
      }),
    });

    const responseData = await response.json();
    console.log('API response from addParticipant:', responseData);
    
    if (!response.ok) {
      console.error('Server error response from addParticipant:', responseData);
      throw new Error(responseData.message || responseData.error || 'Failed to add participant');
    }

    return responseData;
  },

  // Get tournament matches
  getMatches: async (token: string, tournamentId: string): Promise<Array<Match>> => {
    try {
      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MATCHES(tournamentId)}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `HTTP error! Status: ${response.status}`}));
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`Error in getMatches:`, error);
      throw error;
    }
  },

  // Generate tournament bracket
  generateBracket: async (token: string, tournamentId: string): Promise<Match[]> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.GENERATE_BRACKET(tournamentId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to generate bracket');
    }

    return response.json();
  },

  // Update match score
  updateMatch: async (token: string, tournamentId: string, matchId: string, matchUpdate: { 
    participant1Score?: number, 
    participant2Score?: number, 
    // Removed winnerId and status as they are determined by backend based on scores
  }): Promise<Match> => { // Assuming backend returns the updated Match
    try {
      console.log(`Sending match update: Tournament=${tournamentId}, Match=${matchId}`, matchUpdate);
      
      const requestBody = {
        score_participant1: matchUpdate.participant1Score,
        score_participant2: matchUpdate.participant2Score,
      };
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_MATCH(tournamentId, matchId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json(); // Try to parse JSON regardless of status for error details
      
      if (!response.ok) {
        console.error('Error response from updateMatch server:', responseData);
        throw new Error(responseData?.message || `Failed to update match (Status: ${response.status})`);
      }

      console.log('Updated match data received from updateMatch:', responseData);
      return responseData;
    } catch (error) {
      console.error('Error in updateMatch:', error);
      throw error;
    }
  },

  // === NEW DASHBOARD API METHODS ===
  getActiveTournaments: async (token: string, page: number = 1, pageSize: number = 3): Promise<PaginatedTournamentsResponse> => {
    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    const response = await fetch(`${API_CONFIG.BASE_URL}/dashboard/active-tournaments?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch active tournaments' }));
      throw new Error(error.message || 'Failed to fetch active tournaments');
    }
    return response.json();
  },

  getRecentActivities: async (token: string, page: number = 1, pageSize: number = 4): Promise<PaginatedActivitiesResponse> => {
    console.log("Token being sent for /dashboard/activities:", token);
    const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
    });
    const response = await fetch(`${API_CONFIG.BASE_URL}/dashboard/activities?${queryParams.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch recent activities' }));
      throw new Error(error.message || 'Failed to fetch recent activities');
    }
    return response.json();
  },
};