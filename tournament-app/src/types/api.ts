export interface User {
  id: string;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  created_by: string;
}

export interface Participant {
  id: string;
  tournament_id: string;
  participant_name: string;
  user_id?: string;
  seed?: number;
}

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  player1_id: string | null;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  winner_id: string | null;
  score: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTournamentRequest {
  name: string;
  description: string;
}

export interface UpdateMatchRequest {
  score: string;
  winner_id: string;
}

export interface AddParticipantRequest {
  participant_name: string;
  seed?: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
} 