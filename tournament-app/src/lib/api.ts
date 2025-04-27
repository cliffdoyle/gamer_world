import axios from 'axios';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  Tournament,
  Participant,
  Match,
  CreateTournamentRequest,
  UpdateMatchRequest,
  AddParticipantRequest,
} from '../types/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8082';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const register = async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
  try {
    const response = await api.post<LoginResponse>('/auth/register', credentials);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Registration failed' };
  }
};

export const login = async (credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> => {
  try {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Login failed' };
  }
};

// Tournament endpoints
export const createTournament = async (tournament: CreateTournamentRequest): Promise<ApiResponse<Tournament>> => {
  try {
    const response = await api.post<Tournament>('/tournaments', tournament);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to create tournament' };
  }
};

export const getTournaments = async (): Promise<ApiResponse<Tournament[]>> => {
  try {
    const response = await api.get<Tournament[]>('/tournaments');
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to fetch tournaments' };
  }
};

export const getTournament = async (id: string): Promise<ApiResponse<Tournament>> => {
  try {
    const response = await api.get<Tournament>(`/tournaments/${id}`);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to fetch tournament' };
  }
};

// Participant endpoints
export const addParticipant = async (
  tournamentId: string,
  participant: AddParticipantRequest
): Promise<ApiResponse<Participant>> => {
  try {
    const response = await api.post<Participant>(
      `/tournaments/${tournamentId}/participants`,
      participant
    );
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to add participant' };
  }
};

export const getParticipants = async (tournamentId: string): Promise<ApiResponse<Participant[]>> => {
  try {
    const response = await api.get<Participant[]>(`/tournaments/${tournamentId}/participants`);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to fetch participants' };
  }
};

// Match endpoints
export const updateMatchScore = async (
  tournamentId: string,
  matchId: string,
  update: UpdateMatchRequest
): Promise<ApiResponse<Match>> => {
  try {
    const response = await api.patch<Match>(
      `/tournaments/${tournamentId}/matches/${matchId}`,
      update
    );
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to update match score' };
  }
};

export const generateBracket = async (tournamentId: string): Promise<ApiResponse<Match[]>> => {
  try {
    const response = await api.post<Match[]>(`/tournaments/${tournamentId}/bracket`);
    return { data: response.data };
  } catch (error: any) {
    return { error: error.response?.data?.message || 'Failed to generate bracket' };
  }
};

// Token management
export const setAuthToken = (token: string) => {
  localStorage.setItem('token', token);
};

export const clearAuthToken = () => {
  localStorage.removeItem('token');
}; 