import { Tournament, Match, Participant } from '../types/tournament';
import { ApiResponse, LoginRequest, CreateTournamentRequest, UpdateMatchRequest, AddParticipantRequest } from '../types/api';

const API_BASE_URL = 'http://localhost:8082'; // Update this with your actual API base URL

class ApiService {
  private token: string = '';

  setToken(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        mode: 'cors', // Enable CORS
        credentials: 'include', // Include credentials if needed
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || `HTTP error! status: ${response.status}` };
      }

      return { data };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error occurred' };
    }
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<{ token: string }>> {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  // Tournament endpoints
  async createTournament(tournament: CreateTournamentRequest): Promise<ApiResponse<Tournament>> {
    return this.request('/tournaments', {
      method: 'POST',
      body: JSON.stringify(tournament),
    });
  }

  async getTournaments(): Promise<ApiResponse<Tournament[]>> {
    return this.request('/tournaments');
  }

  async getTournament(id: string): Promise<ApiResponse<Tournament>> {
    return this.request(`/tournaments/${id}`);
  }

  async updateTournament(id: string, update: Partial<Tournament>): Promise<ApiResponse<Tournament>> {
    return this.request(`/tournaments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  // Participant endpoints
  async addParticipant(tournamentId: string, participant: AddParticipantRequest): Promise<ApiResponse<Participant>> {
    return this.request(`/tournaments/${tournamentId}/participants`, {
      method: 'POST',
      body: JSON.stringify(participant),
    });
  }

  async getParticipants(tournamentId: string): Promise<ApiResponse<Participant[]>> {
    return this.request(`/tournaments/${tournamentId}/participants`);
  }

  async updateParticipant(tournamentId: string, participantId: string, update: Partial<Participant>): Promise<ApiResponse<Participant>> {
    return this.request(`/tournaments/${tournamentId}/participants/${participantId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  // Match endpoints
  async getMatches(tournamentId: string): Promise<ApiResponse<Match[]>> {
    return this.request(`/tournaments/${tournamentId}/matches`);
  }

  async updateMatch(tournamentId: string, matchId: string, update: UpdateMatchRequest): Promise<ApiResponse<Match>> {
    return this.request(`/tournaments/${tournamentId}/matches/${matchId}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    });
  }

  // Tournament management
  async generateBracket(tournamentId: string): Promise<ApiResponse<Match[]>> {
    return this.request(`/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST',
    });
  }

  async startTournament(tournamentId: string): Promise<ApiResponse<Tournament>> {
    return this.request(`/tournaments/${tournamentId}/start`, {
      method: 'POST',
    });
  }

  async finishTournament(tournamentId: string): Promise<ApiResponse<Tournament>> {
    return this.request(`/tournaments/${tournamentId}/finish`, {
      method: 'POST',
    });
  }
}

export const api = new ApiService(); 