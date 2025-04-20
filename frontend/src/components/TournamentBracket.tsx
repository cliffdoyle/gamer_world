import { useMemo, useState, useEffect } from 'react';

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
  error?: string;
}

interface MatchTooltipProps {
  match: Match;
  getParticipantName: (id: string) => string;
}

function MatchTooltip({ match, getParticipantName }: MatchTooltipProps) {
  const formattedDate = new Date(match.createdAt).toLocaleDateString();
  const status = match.status.charAt(0).toUpperCase() + match.status.slice(1).toLowerCase();
  
  return (
    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded shadow-lg z-10">
      <div className="font-medium mb-1">{status}</div>
      <div className="text-gray-300 text-xs">Created: {formattedDate}</div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
    </div>
  );
}

export default function TournamentBracket({ matches, participants, onMatchClick, isLoading = false, error }: TournamentBracketProps) {
  const [hoveredMatchId, setHoveredMatchId] = useState<string | null>(null);
  const [animatingMatches, setAnimatingMatches] = useState<Set<string>>(new Set());
  const [prevMatches, setPrevMatches] = useState(matches);

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

  useEffect(() => {
    const changedMatches = new Set<string>();
    matches.forEach(match => {
      const prevMatch = prevMatches.find(m => m.id === match.id);
      if (prevMatch && (
        prevMatch.status !== match.status ||
        prevMatch.winnerId !== match.winnerId ||
        JSON.stringify(prevMatch.score) !== JSON.stringify(match.score)
      )) {
        changedMatches.add(match.id);
      }
    });
    
    if (changedMatches.size > 0) {
      setAnimatingMatches(changedMatches);
      const timer = setTimeout(() => {
        setAnimatingMatches(new Set());
      }, 1000);
      return () => clearTimeout(timer);
    }
    
    setPrevMatches(matches);
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

  const handleMatchKeyPress = (event: React.KeyboardEvent, match: Match) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onMatchClick?.(match);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96" role="alert" aria-live="polite">
        <div className="text-red-500 text-center">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-lg font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" role="status" aria-live="polite">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500">
          <span className="sr-only">Loading tournament bracket...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" role="region" aria-label="Tournament Bracket">
      <div className="inline-flex space-x-8 p-8">
        {rounds.map((roundMatches, roundIndex) => (
          <div
            key={roundIndex}
            className="flex flex-col justify-around"
            role="group"
            aria-label={
              roundIndex === rounds.length - 1 ? 'Final Round' :
              roundIndex === rounds.length - 2 ? 'Semi-Finals' :
              roundIndex === rounds.length - 3 ? 'Quarter-Finals' :
              `Round ${roundIndex + 1}`
            }
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
                    ${animatingMatches.has(match.id) ? 'animate-pulse' : ''}
                    transition-all duration-300 ease-in-out
                  `}
                  onMouseEnter={() => setHoveredMatchId(match.id)}
                  onMouseLeave={() => setHoveredMatchId(null)}
                  onClick={() => onMatchClick?.(match)}
                  onKeyPress={(e) => handleMatchKeyPress(e, match)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Match between ${getParticipantName(match.participant1Id)} and ${getParticipantName(match.participant2Id)}`}
                >
                  {hoveredMatchId === match.id && (
                    <MatchTooltip match={match} getParticipantName={getParticipantName} />
                  )}
                  <div className="absolute left-0 w-full">
                    <div className="mx-2">
                      <div
                        className={`
                          bg-white border rounded-lg shadow-sm overflow-hidden
                          ${getMatchStatus(match) === 'completed' ? 'border-green-200' : 
                            getMatchStatus(match) === 'in_progress' ? 'border-blue-200' :
                            getMatchStatus(match) === 'scheduled' ? 'border-gray-200' : 'border-gray-100'}
                          transition-colors duration-300 ease-in-out
                        `}
                      >
                        <div className="flex flex-col divide-y divide-gray-100">
                          <div
                            className={`
                              flex items-center justify-between p-3
                              ${match.winnerId === match.participant1Id ? 'bg-green-50' : ''}
                              transition-colors duration-300 ease-in-out
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
                              transition-colors duration-300 ease-in-out
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