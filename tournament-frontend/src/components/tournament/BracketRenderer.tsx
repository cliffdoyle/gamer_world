// src/components/tournament/BracketRenderer.tsx
import React from 'react';
import DarkChallongeBracket from './DarkChallongeBracket'; // Or ChallongeLikeBracket, whichever you are using for SE/DE
import RoundRobinTable from './RoundRobinTable';
import EliminationStatsTable from './EliminationStatsTable'; // Import if you render it here (but page.tsx handles it)
import { Tournament, Match, Participant } from '@/types/tournament';

interface BracketRendererProps {
  tournament: Tournament | null;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void; // For modal editor (SE/DE) or triggering inline (RR)

  // Props for inline editing specifically for RoundRobinTable
  inlineEditingMatchId?: string | null;
  inlineScores?: { p1: string; p2: string };
  onInlineScoreChange?: (scores: { p1: string; p2: string }) => void;
  onInlineScoreSubmit?: () => void;
  onCancelInlineEdit?: () => void;
}

const BracketRenderer: React.FC<BracketRendererProps> = ({
  tournament,
  matches,
  participants,
  onMatchClick,
  // Props for RoundRobinTable's inline editing, passed down from page.tsx
  inlineEditingMatchId,
  inlineScores,
  onInlineScoreChange,
  onInlineScoreSubmit,
  onCancelInlineEdit,
}) => {
  if (!tournament) {
    return <div className="p-4 text-center text-slate-500 italic">Loading tournament information...</div>;
  }

  if (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') {
    // EliminationStatsTable is now rendered in page.tsx, above this BracketRenderer
    if (participants.length < 2 && matches.length === 0) {
        return <div className="p-6 text-center text-slate-400 italic">Add at least two participants and generate the bracket.</div>;
    }
    if (matches.length === 0 && participants.length >=2 ) {
        return <div className="p-6 text-center text-slate-400">The bracket has not been generated yet. Click "Generate Bracket".</div>;
    }
    return (
      <DarkChallongeBracket // Or <ChallongeLikeBracket ... /> if you switched
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick} // This will trigger the modal editor from page.tsx
      />
    );
  }

  if (tournament.format === 'ROUND_ROBIN') {
    if (participants.length < 2 && matches.length === 0) {
        return <div className="p-6 text-center text-slate-400 italic">Add at least two participants and generate matches for Round Robin.</div>;
    }
    // RoundRobinTable will show "No matches" internally if matches array is empty but participants exist
    return (
      <RoundRobinTable
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick} // This triggers inline edit setup in page.tsx
        inlineEditingMatchId={inlineEditingMatchId}
        inlineScores={inlineScores}
        onInlineScoreChange={onInlineScoreChange}
        onInlineScoreSubmit={onInlineScoreSubmit}
        onCancelInlineEdit={onCancelInlineEdit}
      />
    );
  }

  if (tournament.format === 'SWISS') {
    return <div className="p-4 text-center text-slate-400">Swiss format display is currently under development.</div>;
  }

  return <div className="p-4 text-center text-red-400">Unsupported tournament format: {tournament.format}.</div>;
};

export default BracketRenderer;