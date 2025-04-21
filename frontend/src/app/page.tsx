'use client';
import TournamentBracket from '../components/TournamentBracket';
import { Match, Participant, MatchStatus } from '../types/tournament';

const sampleMatches: Match[] = [
  {
    id: '1',
    tournamentId: 'tournament1',
    round: 1,
    participant1Id: 'p1',
    participant2Id: 'p2',
    winnerId: 'p1',
    status: 'completed' as MatchStatus,
    score: {
      participant1: 2,
      participant2: 1
    },
    createdAt: '2024-03-15T12:00:00Z'
  },
  {
    id: '2',
    tournamentId: 'tournament1',
    round: 1,
    participant1Id: 'p3',
    participant2Id: 'p4',
    status: 'in_progress' as MatchStatus,
    createdAt: '2024-03-15T12:00:00Z'
  },
  {
    id: '3',
    tournamentId: 'tournament1',
    round: 2,
    participant1Id: 'p1',
    participant2Id: 'p4',
    status: 'pending' as MatchStatus,
    createdAt: '2024-03-15T12:00:00Z'
  }
];

const sampleParticipants: Participant[] = [
  { id: 'p1', userId: 'John Doe', status: 'active' },
  { id: 'p2', userId: 'Jane Smith', status: 'active' },
  { id: 'p3', userId: 'Bob Johnson', status: 'active' },
  { id: 'p4', userId: 'Alice Brown', status: 'active' }
];

export default function Home() {
  const handleMatchClick = (match: Match) => {
    console.log('Match clicked:', match);
  };

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Tournament Bracket</h1>
        <TournamentBracket
          matches={sampleMatches}
          participants={sampleParticipants}
          onMatchClick={handleMatchClick}
        />
      </div>
    </main>
  );
}
