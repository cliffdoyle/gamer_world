import React from 'react';
import SingleEliminationBracket from './SingleEliminationBracket';
import AdvancedSingleEliminationBracket from './AdvancedSingleEliminationBracket';
import DoubleEliminationBracket from './DoubleEliminationBracket';
import RoundRobinTable from './RoundRobinTable';

const BracketRenderer = ({ tournament, matches, participants, onMatchClick, useAdvanced = false }) => {
  if (!tournament || !matches || !participants) {
    return <div>Loading tournament data...</div>;
  }

  switch (tournament.format) {
    case 'SINGLE_ELIMINATION':
      return useAdvanced ? (
        <AdvancedSingleEliminationBracket 
          matches={matches} 
          participants={participants} 
          onMatchClick={onMatchClick} 
        />
      ) : (
        <SingleEliminationBracket 
          matches={matches} 
          participants={participants} 
          onMatchClick={onMatchClick} 
        />
      );
    case 'DOUBLE_ELIMINATION':
      return (
        <DoubleEliminationBracket 
          matches={matches} 
          participants={participants} 
          onMatchClick={onMatchClick} 
        />
      );
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