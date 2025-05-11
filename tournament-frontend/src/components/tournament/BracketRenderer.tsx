// src/components/tournament/BracketRenderer.tsx
import React from 'react';
import DarkChallongeBracket from './DarkChallongeBracket';
import RoundRobinTable from './RoundRobinTable';
import { Tournament, Match, Participant } from '@/types/tournament';

interface BracketRendererProps {
  tournament: Tournament | null;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void; // Keep this as Match type if DarkChallongeBracket's onMatchClick expects base Match.
                                        // If DarkChallongeBracket's internal UIExtendedMatch is needed by the page, adjust type here.
                                        // For simplicity and compatibility, let's keep it as base Match for now as the ID is what's used.
}

const BracketRenderer: React.FC<BracketRendererProps> = ({
  tournament,
  matches,
  participants,
  onMatchClick
}) => {
  if (!tournament) {
    return <div className="p-4 text-center text-gray-500">Tournament data is not available.</div>;
  }
  // No need to check for matches or participants here, the child components can handle empty states

  if (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') {
    if (matches.length === 0) return <div className="p-4 text-center text-gray-500">No matches generated for this bracket yet.</div>
    return (
      <DarkChallongeBracket
        tournament={tournament}
        matches={matches} // DarkChallongeBracket will process these internally
        participants={participants}
        onMatchClick={onMatchClick} // onMatchClick from DarkChallonge will send UIExtendedMatch
                                   // page.tsx handler needs to be aware if it uses fields specific to UIExtendedMatch
                                   // Or, DarkChallongeBracket's onMatchClick should just pass the original 'Match' part.
                                   // Simplest: onMatchClick callback in DarkChallongeBracket will pass `match` (which is UIExtendedMatch),
                                   // if the consuming page needs only Match fields, it's fine due to structural typing.
      />
    );
  }

  if (tournament.format === 'ROUND_ROBIN') {
    return (
      <RoundRobinTable
        tournament={tournament} // Pass tournament for context
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick}
      />
    );
  }

  if (tournament.format === 'SWISS') {
    return <div className="p-4 text-center">Swiss format display is coming soon.</div>;
  }

  return <div className="p-4 text-center">Unknown or unsupported tournament format: {tournament.format}</div>;
};

export default BracketRenderer;