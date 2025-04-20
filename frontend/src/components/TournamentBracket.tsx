import { useMemo } from 'react';

interface Match {
  id: string;
  tournamentId: string;
  round: number;
  participant1Id: string;
  participant2Id: string;
  winnerId?: string;
  status: string;
  score?: {
    participant1: number;
    participant2: number;
  };
  createdAt: string;
}

interface Participant {
  id: string;
  userId: string;
  status: string;
}

interface TournamentBracketProps {
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
  isLoading?: boolean;
}

export default function TournamentBracket({ matches, participants, onMatchClick, isLoading = false }: TournamentBracketProps) {
  const rounds = useMemo(() => {
    const roundsMap = new Map<number, Match[]>();
    matches.forEach(match => {
      const roundMatches = roundsMap.get(match.round) || [];
      roundMatches.push(match);
      roundsMap.set(match.round, roundMatches);
    });
    
    return Array.from(roundsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([_, matches]) => matches);
  }, [matches]);

  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    return participant ? participant.userId : 'TBD';
  };

  const getMatchStatus = (match: Match) => {
    if (match.status === 'completed') {
      return 'completed';
    }
    if (match.status === 'in_progress') {
      return 'in_progress';
    }
    if (!match.participant1Id || !match.participant2Id) {
      return 'pending';
    }
    return 'scheduled';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex space-x-8 p-8">
        {rounds.map((roundMatches, roundIndex) => (
          <div
            key={roundIndex}
            className="flex flex-col justify-around"
            style={{
              height: `${Math.pow(2, rounds.length - roundIndex - 1) * 160}px`,
              minHeight: '160px'
            }}
          >
            <div className="flex flex-col justify-around h-full">
              {roundMatches.map((match, matchIndex) => (
                <div
                  key={match.id}
                  className={`
                    relative flex flex-col justify-center
                    ${onMatchClick ? 'cursor-pointer' : ''}
                  `}
                  onClick={() => onMatchClick?.(match)}
                >
                  <div className="absolute left-0 w-full">
                    <div className="mx-2">
                      <div
                        className={`
                          bg-white border rounded-lg shadow-sm overflow-hidden
                          ${getMatchStatus(match) === 'completed' ? 'border-green-200' : 
                            getMatchStatus(match) === 'in_progress' ? 'border-blue-200' :
                            getMatchStatus(match) === 'scheduled' ? 'border-gray-200' : 'border-gray-100'}
                        `}
                      >
                        <div className="flex flex-col divide-y divide-gray-100">
                          <div
                            className={`
                              flex items-center justify-between p-3
                              ${match.winnerId === match.participant1Id ? 'bg-green-50' : ''}
                            `}
                          >
                            <span className={`
                              text-sm font-medium
                              ${match.winnerId === match.participant1Id ? 'text-green-900' : 'text-gray-900'}
                            `}>
                              {getParticipantName(match.participant1Id)}
                            </span>
                            {match.score && (
                              <span className={`
                                text-sm font-semibold
                                ${match.winnerId === match.participant1Id ? 'text-green-900' : 'text-gray-900'}
                              `}>
                                {match.score.participant1}
                              </span>
                            )}
                          </div>
                          <div
                            className={`
                              flex items-center justify-between p-3
                              ${match.winnerId === match.participant2Id ? 'bg-green-50' : ''}
                            `}
                          >
                            <span className={`
                              text-sm font-medium
                              ${match.winnerId === match.participant2Id ? 'text-green-900' : 'text-gray-900'}
                            `}>
                              {getParticipantName(match.participant2Id)}
                            </span>
                            {match.score && (
                              <span className={`
                                text-sm font-semibold
                                ${match.winnerId === match.participant2Id ? 'text-green-900' : 'text-gray-900'}
                              `}>
                                {match.score.participant2}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {roundIndex < rounds.length - 1 && (
                        <div className="absolute top-1/2 right-0 transform translate-x-full">
                          <div
                            className="border-t-2 border-r-2 border-gray-200"
                            style={{
                              width: '2rem',
                              height: `${Math.pow(2, rounds.length - roundIndex - 2) * 160}px`,
                              marginTop: matchIndex % 2 === 0 ? '0' : `-${Math.pow(2, rounds.length - roundIndex - 2) * 160}px`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-center mt-4">
              <span className="text-sm font-medium text-gray-500">
                {roundIndex === rounds.length - 1 ? 'Final' :
                 roundIndex === rounds.length - 2 ? 'Semi-Finals' :
                 roundIndex === rounds.length - 3 ? 'Quarter-Finals' :
                 `Round ${roundIndex + 1}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}