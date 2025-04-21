export interface User {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  format: string;
  status: string;
  maxParticipants: number;
  allowWaitlist: boolean;
  startDate: string;
  endDate: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Participant {
  id: string;
  tournamentId: string;
  userId: string;
  name: string;
  seed: number;
  status: string;
  isWaitlisted: boolean;
  createdAt: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  round: number;
  matchNumber: number;
  participant1Id: string | null;
  participant2Id: string | null;
  winnerId: string | null;
  loserId: string | null;
  scoreParticipant1: number;
  scoreParticipant2: number;
  status: string;
  scheduledTime: string | null;
  completedTime: string | null;
  nextMatchId: string | null;
  createdAt: string;
  matchNotes: string[];
  matchProofs: string[];
} 