// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// API Request Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface CreateTournamentRequest {
  name: string;
  description: string;
  game: string;
  format: string;
  maxParticipants: number;
  allowWaitlist: boolean;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  rules?: string;
  prizePool?: any;
  customFields?: any;
}

export interface UpdateMatchRequest {
  scoreParticipant1?: number;
  scoreParticipant2?: number;
  winnerId?: string;
  status?: string;
  matchNotes?: string;
  matchProofs?: string[];
}

export interface AddParticipantRequest {
  userId: string;
  name: string;
} 