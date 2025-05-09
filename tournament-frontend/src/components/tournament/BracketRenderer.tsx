import React from 'react';
// import SingleEliminationBracket from './SingleEliminationBracket'; // Not needed if ChallongeLikeBracket handles SE
// import DoubleEliminationBracket from './DoubleEliminationBracket'; // Old name
import ChallongeLikeBracket from './ChallongeLikeBracket'; // Use the new/refactored component
import RoundRobinTable from './RoundRobinTable';
import { Tournament, Match, Participant } from '@/types/tournament';

interface BracketRendererProps {
  tournament: Tournament | null;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
}

const BracketRenderer: React.FC<BracketRendererProps> = ({ 
  tournament, 
  matches, 
  participants, 
  onMatchClick 
}) => {
  if (!tournament || !matches || !participants) {
    return <div>Loading tournament data...</div>;
  }

  // Use the new Challonge-like visualization for elimination formats
  if (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') {
    return (
      <ChallongeLikeBracket
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick}
      />
    );
  }

  // Use the original components for other formats
  switch (tournament.format) {
    case 'ROUND_ROBIN':
      return (
        <RoundRobinTable 
          matches={matches} 
          participants={participants} 
          onMatchClick={onMatchClick} 
        />
      );
    case 'SWISS':
      return <div>Swiss format display coming soon</div>;
    default:
      return <div>Unknown tournament format: {tournament.format}</div>;
  }
};

export default BracketRenderer;