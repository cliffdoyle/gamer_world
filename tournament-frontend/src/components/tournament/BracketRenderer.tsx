// src/components/tournament/BracketRenderer.tsx
import React from 'react';
import DarkChallongeBracket from './DarkChallongeBracket';
import RoundRobinTable from './RoundRobinTable';
// EliminationStatsTable is rendered in page.tsx, not here.
import { Tournament, Match, Participant } from '@/types/tournament';

interface BracketRendererProps {
  tournament: Tournament | null;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;

  // Props for inline editing, passed to both RoundRobinTable and DarkChallongeBracket
  inlineEditingMatchId?: string | null;
  inlineScores?: { p1: string; p2: string };
  onInlineScoreChange?: (scores: { p1: string; p2: string }) => void;
  onInlineScoreSubmit?: () => void;
  onCancelInlineEdit?: () => void;
  // currentViewMode?: 'bracket' | 'list'; // If DarkChallongeBracket needs to show a list view too
}

const BracketRenderer: React.FC<BracketRendererProps> = ({
  tournament,
  matches,
  participants,
  onMatchClick,
  inlineEditingMatchId,
  inlineScores,
  onInlineScoreChange,
  onInlineScoreSubmit,
  onCancelInlineEdit,
  // currentViewMode, // Not used by DarkChallongeBracket directly yet
}) => {
  if (!tournament) {
    return <div className="p-4 text-center text-slate-500 italic">Loading tournament information...</div>;
  }

  if (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') {
    if (participants.length < 2 && matches.length === 0) {
        return <div className="p-6 text-center text-slate-400 italic">Add at least two participants and generate the bracket.</div>;
    }
    if (matches.length === 0 && participants.length >=2 ) {
        return <div className="p-6 text-center text-slate-400">The bracket has not been generated yet. Click "Generate Bracket".</div>;
    }
    // DarkChallongeBracket will now also use inline editing props
    return (
      <DarkChallongeBracket
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick} // This will trigger inline edit setup in page.tsx
        inlineEditingMatchId={inlineEditingMatchId}
        inlineScores={inlineScores}
        onInlineScoreChange={onInlineScoreChange}
        onInlineScoreSubmit={onInlineScoreSubmit}
        onCancelInlineEdit={onCancelInlineEdit}
      />
    );
  }

  if (tournament.format === 'ROUND_ROBIN') {
    // This condition is already handled by RoundRobinTable internally if needed.
    // if (participants.length < 2 && matches.length === 0) {
    //     return <div className="p-6 text-center text-slate-400 italic">Add at least two participants and generate matches for Round Robin.</div>;
    // }
    return (
      <RoundRobinTable
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={onMatchClick}
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