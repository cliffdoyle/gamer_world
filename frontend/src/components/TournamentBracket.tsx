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

interface ScoreDisplayProps {
  score: number;
  isWinner: boolean;
}

function ScoreDisplay({ score, isWinner }: ScoreDisplayProps) {
  return (
    <span
      className={`
        text-sm font-semibold px-2 py-1 rounded
        ${isWinner
          ? 'bg-green-100 text-green-900'
          : 'bg-gray-100 text-gray-900'}
      `}
    >
      {score}
    </span>
  );
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

interface ParticipantNameProps {
  participantId: string;
  isWinner: boolean;
  participants: Participant[];
}

function ParticipantName({ participantId, isWinner, participants }: ParticipantNameProps) {
  const participant = participants.find(p => p.id === participantId);
  const displayName = participant ? participant.userId : 'TBD';
  
  return (
    <div className="flex items-center">
      <span
        className={`
          text-sm font-medium truncate max-w-[120px]
          ${isWinner ? 'text-green-900' : 'text-gray-900'}
        `}
        title={displayName}
      >
        {displayName}
      </span>
      {isWinner && (
        <svg
          className="w-4 h-4 ml-1 text-green-600"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </div>
  );
}

interface BracketLineProps {
  roundIndex: number;
  matchIndex: number;
  totalRounds: number;
  isWinnerPath: boolean;
}

function BracketLine({ roundIndex, matchIndex, totalRounds, isWinnerPath }: BracketLineProps) {
  const height = Math.pow(2, totalRounds - roundIndex - 2) * 160;
  const marginTop = matchIndex % 2 === 0 ? '0' : `-${height}px`;

  return (
    <div className="absolute top-1/2 right-0 transform translate-x-full">
      <div
        className={`
          border-r-2 border-t-2
          ${isWinnerPath ? 'border-green-300' : 'border-gray-200'}
          transition-colors duration-300 ease-in-out
        `}
        style={{
          width: '2rem',
          height: `${height}px`,
          marginTop,
        }}
      />
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
  }, [matches, prevMatches]);

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

  const isValidScore = (match: Match): boolean => {
    if (!match.score) return false;
    
    const { participant1, participant2 } = match.score;
    
    // Scores must be non-negative
    if (participant1 < 0 || participant2 < 0) return false;
    
    // At least one participant must have a score
    if (participant1 === 0 && participant2 === 0) return false;
    
    // Winner must have higher score
    if (match.winnerId) {
      if (match.winnerId === match.participant1Id && participant1 <= participant2) return false;
      if (match.winnerId === match.participant2Id && participant2 <= participant1) return false;
    }
    
    return true;
  };

  const isWinnerPath = (match: Match, nextRoundMatches: Match[]): boolean => {
    if (!match.winnerId) return false;
    
    const nextMatch = nextRoundMatches.find(m =>
      m.participant1Id === match.winnerId || m.participant2Id === match.winnerId
    );
    
    return nextMatch ? nextMatch.winnerId === match.winnerId : false;
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
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onMatchClick?.(match);
                    }
                  }}
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
                            <ParticipantName
                              participantId={match.participant1Id}
                              isWinner={match.winnerId === match.participant1Id}
                              participants={participants}
                            />
                            {match.score && isValidScore(match) && (
                              <ScoreDisplay
                                score={match.score.participant1}
                                isWinner={match.winnerId === match.participant1Id}
                              />
                            )}
                          </div>
                          <div
                            className={`
                              flex items-center justify-between p-3
                              ${match.winnerId === match.participant2Id ? 'bg-green-50' : ''}
                              transition-colors duration-300 ease-in-out
                            `}
                          >
                            <ParticipantName
                              participantId={match.participant2Id}
                              isWinner={match.winnerId === match.participant2Id}
                              participants={participants}
                            />
                            {match.score && isValidScore(match) && (
                              <ScoreDisplay
                                score={match.score.participant2}
                                isWinner={match.winnerId === match.participant2Id}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                      {roundIndex < rounds.length - 1 && (
                        <BracketLine
                          roundIndex={roundIndex}
                          matchIndex={matchIndex}
                          totalRounds={rounds.length}
                          isWinnerPath={isWinnerPath(match, rounds[roundIndex + 1])}
                        />
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