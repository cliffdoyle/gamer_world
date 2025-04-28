import React from 'react';
import Match from './Match';
import { Match as MatchType, Participant } from '@/types/tournament';

interface SingleEliminationBracketProps {
  matches: MatchType[];
  participants: Participant[];
  onMatchClick?: (match: MatchType) => void;
}

const SingleEliminationBracket: React.FC<SingleEliminationBracketProps> = ({ 
  matches, 
  participants, 
  onMatchClick 
}) => {
  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, MatchType[]>);

  // Get participant objects by ID for displaying names
  const participantsById = participants.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, Participant>);

  // Prepare matches with participant info
  const preparedMatches = matches.map(match => ({
    ...match,
    participant1: match.participant1_id ? participantsById[match.participant1_id] : null,
    participant2: match.participant2_id ? participantsById[match.participant2_id] : null
  }));

  // Get max round number
  const maxRound = Math.max(...matches.map(m => m.round));

  return (
    <div className="single-elimination-bracket">
      {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => (
        <div key={round} className="round">
          <h3 className="round-title">
            {round === maxRound ? 'Final' : round === maxRound - 1 ? 'Semifinals' : `Round ${round}`}
          </h3>
          <div className="matches">
            {matchesByRound[round]?.sort((a, b) => a.match_number - b.match_number).map(match => {
              const preparedMatch = preparedMatches.find(m => m.id === match.id);
              return (
                <div className="match-wrapper" key={match.id}>
                  <Match match={preparedMatch!} onClick={onMatchClick} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SingleEliminationBracket; 