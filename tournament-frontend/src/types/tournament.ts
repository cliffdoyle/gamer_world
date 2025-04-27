export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string;
  format: TournamentFormat;
  status: TournamentStatus;
  maxParticipants: number;
  registrationDeadline: string | null;
  startTime: string | null;
  endTime: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rules: string;
  prizePool?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface CreateTournamentRequest {
  name: string;
  description: string;
  game: string;
  format: TournamentFormat;
  maxParticipants: number;
  registrationDeadline?: string;
  startTime?: string;
  rules?: string;
  prizePool?: Record<string, any>;
  customFields?: Record<string, any>;
}

export interface Participant {
  id: string;
  tournament_id: string;
  user_id?: string;
  name?: string;
  participant_name: string;
  seed?: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  tournament_id: string;
  round: number;
  match_number: number;
  participant1_id: string | null;
  participant2_id: string | null;
  score_participant1: number | null;
  score_participant2: number | null;
  winner_id: string | null;
  next_match_id: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
  bracket?: 'WINNERS' | 'LOSERS' | null;
} 