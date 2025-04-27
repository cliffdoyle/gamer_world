import { Match } from '../../types/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMatchScore } from '../../lib/api';
import { useState } from 'react';

interface BracketProps {
  matches: Match[];
  tournamentId: string;
  isEditable: boolean;
}

interface MatchCardProps {
  match: Match;
  participants: Record<string, string>;
  onUpdateScore?: (matchId: string, score: string, winnerId: string) => void;
  isEditable: boolean;
}

function MatchCard({ match, participants, onUpdateScore, isEditable }: MatchCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [score, setScore] = useState(match.score || '');
  const [winnerId, setWinnerId] = useState(match.winner_id || '');

  const handleSave = () => {
    if (onUpdateScore) {
      onUpdateScore(match.id, score, winnerId);
      setIsEditing(false);
    }
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <div className="space-y-2">
        <div className={`flex justify-between items-center ${match.winner_id === match.player1_id ? 'font-bold' : ''}`}>
          <span>{participants[match.player1_id] || 'TBD'}</span>
          {!isEditing && <span>{match.score?.split('-')[0] || '0'}</span>}
        </div>
        <div className={`flex justify-between items-center ${match.winner_id === match.player2_id ? 'font-bold' : ''}`}>
          <span>{participants[match.player2_id] || 'TBD'}</span>
          {!isEditing && <span>{match.score?.split('-')[1] || '0'}</span>}
        </div>
        {isEditable && (
          <div className="mt-2">
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  placeholder="Score (e.g., 2-1)"
                  className="w-full px-2 py-1 text-sm border rounded"
                />
                <select
                  value={winnerId}
                  onChange={(e) => setWinnerId(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded"
                >
                  <option value="">Select winner</option>
                  <option value={match.player1_id}>{participants[match.player1_id]}</option>
                  <option value={match.player2_id}>{participants[match.player2_id]}</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-2 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Update Score
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function Bracket({ matches, tournamentId, isEditable }: BracketProps) {
  const queryClient = useQueryClient();
  const updateScoreMutation = useMutation({
    mutationFn: ({ matchId, score, winnerId }: { matchId: string; score: string; winnerId: string }) =>
      updateMatchScore(tournamentId, matchId, { score, winner_id: winnerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
    },
  });

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    acc[match.round] = acc[match.round] || [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, Match[]>);

  // Create a map of participant IDs to names
  const participants: Record<string, string> = {};
  matches.forEach((match) => {
    if (match.player1_id) {
      participants[match.player1_id] = match.player1_name || 'Unknown';
    }
    if (match.player2_id) {
      participants[match.player2_id] = match.player2_name || 'Unknown';
    }
  });

  const handleUpdateScore = (matchId: string, score: string, winnerId: string) => {
    updateScoreMutation.mutate({ matchId, score, winnerId });
  };

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Tournament Bracket</h2>
      <div className="flex gap-8 overflow-x-auto pb-4">
        {Object.entries(matchesByRound)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([round, roundMatches]) => (
            <div key={round} className="flex-none w-64">
              <h3 className="text-sm font-medium text-gray-500 mb-4">
                {round === '1'
                  ? 'First Round'
                  : round === '2'
                  ? 'Semi-Finals'
                  : round === '3'
                  ? 'Finals'
                  : `Round ${round}`}
              </h3>
              <div className="space-y-4">
                {roundMatches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    participants={participants}
                    onUpdateScore={handleUpdateScore}
                    isEditable={isEditable}
                  />
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
} 