import React, { useMemo } from 'react';
import { Match, Participant } from '../types/tournament';

interface TournamentBracketProps {
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
  isLoading?: boolean;
  error?: string;
}

export default function TournamentBracket({
  matches,
  participants,
  onMatchClick,
  isLoading,
  error
}: TournamentBracketProps) {
  const rounds = useMemo(() => {
    const roundsMap = new Map<number, Match[]>();
    matches.forEach(match => {
      const roundMatches = roundsMap.get(match.round) || [];
      roundMatches.push(match);
      roundsMap.set(match.round, roundMatches);
    });
    
    return Array.from(roundsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, roundMatches]) => 
        roundMatches.sort((a, b) => a.matchNumber - b.matchNumber)
      );
  }, [matches]);

  const getParticipantName = (participantId?: string) => {
    if (!participantId) return 'TBD';
    const participant = participants.find(p => p.id === participantId);
    return participant ? participant.name : 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-96 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex justify-center items-center h-96 text-gray-500">
        <p>No matches available. Generate the bracket to start the tournament.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex space-x-8 p-4 min-w-full">
        {rounds.map((roundMatches, roundIndex) => (
          <div
            key={roundIndex}
            className="flex flex-col"
            style={{
              minWidth: '240px',
              marginTop: `${Math.pow(2, roundIndex) * 20}px`
            }}
          >
            <div className="mb-4 text-sm font-medium text-gray-500">
              {roundIndex === rounds.length - 1 ? 'Final' :
               roundIndex === rounds.length - 2 ? 'Semi-Finals' :
               roundIndex === rounds.length - 3 ? 'Quarter-Finals' :
               `Round ${roundIndex + 1}`}
            </div>
            <div className="space-y-8">
              {roundMatches.map((match) => (
                <div
                  key={match.id}
                  className={`
                    relative
                    ${onMatchClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onMatchClick?.(match)}
                >
                  <div className="absolute -left-4 top-1/2 w-4 h-px bg-gray-300"></div>
                  <div className="absolute -right-4 top-1/2 w-4 h-px bg-gray-300"></div>
                  <div className={`
                    border rounded-lg overflow-hidden bg-white
                    ${match.status === 'COMPLETED' ? 'border-green-200' :
                      match.status === 'IN_PROGRESS' ? 'border-blue-200' :
                      'border-gray-200'}
                  `}>
                    <div className={`
                      p-3 border-b
                      ${match.winnerId === match.participant1Id ? 'bg-green-50' : ''}
                    `}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {getParticipantName(match.participant1Id)}
                        </span>
                        <span className={`
                          px-2 py-1 text-sm rounded
                          ${match.winnerId === match.participant1Id ? 'bg-green-100 text-green-800' : 'bg-gray-100'}
                        `}>
                          {match.scoreParticipant1 || 0}
                        </span>
                      </div>
                    </div>
                    <div className={`
                      p-3
                      ${match.winnerId === match.participant2Id ? 'bg-green-50' : ''}
                    `}>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {getParticipantName(match.participant2Id)}
                        </span>
                        <span className={`
                          px-2 py-1 text-sm rounded
                          ${match.winnerId === match.participant2Id ? 'bg-green-100 text-green-800' : 'bg-gray-100'}
                        `}>
                          {match.scoreParticipant2 || 0}
                        </span>
                      </div>
                    </div>
                    {match.status === 'IN_PROGRESS' && (
                      <div className="absolute -top-2 -right-2">
                        <span className="flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}