import { API_CONFIG } from '../config';
import { Tournament, CreateTournamentRequest, Participant, Match } from '@/types/tournament';

interface TournamentResponse {
  page: number;
  page_size: number;
  total: number;
  tournaments: Tournament[];
}

interface AddParticipantRequest {
  ParticipantName: string;
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
  updateTournamentStatus: async (token: string, id: string, status: string): Promise<Tournament> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.TOURNAMENT_DETAIL(id)}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update tournament status');
    }

    return response.json();
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
  addParticipant: async (token: string, tournamentId: string, data: AddParticipantRequest): Promise<Participant> => {
    console.log('API sending data:', data);
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PARTICIPANTS(tournamentId)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
  getMatches: async (token: string, tournamentId: string): Promise<Match[]> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.MATCHES(tournamentId)}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch matches');
    }

    return response.json();
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
  updateMatch: async (token: string, tournamentId: string, matchId: string, score: string): Promise<Match> => {
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.UPDATE_MATCH(tournamentId, matchId)}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ score }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update match');
    }

    return response.json();
  },
}; 