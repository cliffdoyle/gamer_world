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
  tournamentId: string;
  name: string;
  userId: string;
  seed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
  score: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  nextMatchId: string | null;
  createdAt: string;
  updatedAt: string;
} 