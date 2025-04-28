import { API_CONFIG } from '../config';
import { Tournament, CreateTournamentRequest, Participant, Match } from '@/types/tournament';

interface TournamentResponse {
  page: number;
  page_size: number;
  total: number;
  tournaments: Tournament[];
}

interface AddParticipantRequest {
  participant_name: string;
}

export const tournamentApi = {
  // Get all tournaments
  getAllTournaments: async (token: string): Promise<TournamentResponse> => {
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
  createTournament: async (token: string, data: CreateTournamentRequest): Promise<Tournament> => {
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

  // Get tournament by ID
  getTournament: async (token: string, id: string): Promise<Tournament> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENT_DETAIL(id)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseData = await response.json();
    
    if (!response.ok) {
      console.error('Server error response:', responseData);
      throw new Error(responseData.message || responseData.error || 'Failed to fetch tournament');
    }

    return responseData;
  },

  // Update tournament status
  updateTournamentStatus: async (
    token: string,
    tournamentId: string,
    status: string
  ): Promise<Tournament> => {
    try {
      if (!token) {
        throw new Error('Authentication token is required');
      }

      if (!tournamentId) {
        throw new Error('Tournament ID is required');
      }

      const response = await fetch(
        `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENT_DETAIL(tournamentId)}`,
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
        throw new Error('Failed to update tournament status');
      }

      return await response.json();
    } catch (error) {
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
    console.log('API sending data:', {
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
    console.log('API response:', responseData);
    
    if (!response.ok) {
      console.error('Server error response:', responseData);
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
        throw new Error(`HTTP error! Status: ${response.status}`);
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
  updateMatch: async (token: string, tournamentId: string, matchId: string, match: { 
    participant1Score?: number, 
    participant2Score?: number, 
    winnerId?: string,
    status?: string
  }): Promise<Match> => {
    try {
      console.log(`Sending match update: Tournament=${tournamentId}, Match=${matchId}`, match);
      
      // Map frontend field names to what the backend expects
      const requestBody = {
        score_participant1: match.participant1Score,
        score_participant2: match.participant2Score,
        // Backend doesn't need winnerId or status as they're determined server-side
      };
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_MATCH(tournamentId, matchId)}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Error response from server:', errorData);
        throw new Error(errorData?.message || `Failed to update match (Status: ${response.status})`);
      }

      // Parse the response data
      const matchData = await response.json();
      console.log('Updated match data received:', matchData);
      
      return matchData;
    } catch (error) {
      console.error('Error in updateMatch:', error);
      throw error;
    }
  },
}; 