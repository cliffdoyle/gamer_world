export type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type BracketType = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS' | null;
// In types/tournament.ts
export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED'; // Or whatever your statuses are

export interface TournamentResponse {
  id: string;
  name: string;
  description: string;
  game: string;
  format: TournamentFormat;
   currentParticipants: number;
  status: TournamentStatus;
  maxParticipants: number;
  registrationDeadline: string | null;
  startTime: string | null;
  endTime: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  rules: string;
  prizePool?: any;
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
  status: MatchStatus;
  created_at?: string;
  updated_at?: string;
  bracket_type?: BracketType;
  isGrandFinal?: boolean;
  match_notes?: string;
  loser_next_match_id?: string | null;
  participant1_prereq_match_id?: string | null;
  participant2_prereq_match_id?: string | null;
} 

// Also add UserActivity here if you need it and it's not defined yet
export interface UserActivity { // If you're using `UserActivity as BackendUserActivity`
  id: string;
  user_id?: string; // Add user_id if your backend sends it
  type: string;
  detail: string;
  related_entity_id?: string | null;
  related_entity_type?: string | null;
  context_url?: string | null;
  date: string; // maps to createdAt
  //   rank?: string;         // Optional if not always present
  // level?: number;        // Optional
  // avatarUrl?: string;   
}