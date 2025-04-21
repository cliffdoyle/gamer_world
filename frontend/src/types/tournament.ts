export type MatchStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DISPUTED';
export type ParticipantStatus = 'REGISTERED' | 'CHECKED_IN' | 'ELIMINATED' | 'WAITLISTED';
export type TournamentStatus = 'DRAFT' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface Tournament {
  id: string;
  name: string;
  description: string;
  game: string;
  format: string;
  status: TournamentStatus;
  maxParticipants: number;
  currentParticipants: number;
  createdAt: string;
  startDate?: string;
  registrationDeadline?: string;
  endTime?: string;
  rules?: string;
  allowWaitlist?: boolean;
  prizePool?: {
    currency: string;
    amount: number;
  };
  customFields?: Record<string, any>;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  participant1Id: string;
  participant2Id?: string;
  winnerId?: string;
  loserId?: string;
  status: MatchStatus;
  scoreParticipant1: number;
  scoreParticipant2: number;
  scheduledTime?: string;
  completedTime?: string;
  nextMatchId?: string;
  createdAt: string;
  matchNotes?: string;
  matchProofs?: string[];
}

export interface Participant {
  id: string;
  userId: string;
  tournamentId: string;
  name: string;
  status: ParticipantStatus;
  isWaitlisted: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  tournamentId: string;
  userId: string;
  content: string;
  createdAt: string;
} 