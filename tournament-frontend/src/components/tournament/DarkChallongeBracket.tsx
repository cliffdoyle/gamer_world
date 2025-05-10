// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode } from 'react';

// Defined tournament types
interface Participant {
  id: string;
  participant_name: string; // Ensure this matches your type
  seed?: number;
}

interface Match {
  id: string;
  round: number;
  match_number: number;
  participant1_id: string | null;
  participant2_id: string | null;
  winner_id: string | null;
  loser_id?: string | null; // Make sure this exists in your backend type if used
  next_match_id: string | null;
  loser_next_match_id: string | null; // Crucial for DE
  // participant1_prereq_match_id: string | null; // Can be useful for TBD slots
  // participant2_prereq_match_id: string | null; // Can be useful for TBD slots
  score_participant1: string | number | null; // Allow number type too
  score_participant2: string | number | null; // Allow number type too
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | string; // Allow other statuses
  bracket_type?: 'WINNERS' | 'LOSERS' | 'GRAND_FINALS'; // Explicit from backend is best
  // Add any other fields from your backend Match type
}

type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';

interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
}

// Internal extended match type for UI processing
interface UIExtendedMatch extends Match {
  ui_bracket: 'WINNERS' | 'LOSERS' | 'GRAND_FINALS_SECTION'; // For visual grouping
  ui_is_grand_final_match: boolean; // Is it one of the 1 or 2 GF matches?
  ui_participant1_name: string;
  ui_participant2_name: string;
  ui_participant1_seed?: number;
  ui_participant2_seed?: number;
  // ui_source_match_for_p1_label?: string; // e.g., "W: M1"
  // ui_source_match_for_p2_label?: string; // e.g., "L: M5"
}

interface DarkChallongeBracketProps {
  tournament: Tournament;
  matches: Match[]; // Raw matches from API
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
}

const DarkChallongeBracket = ({
  tournament,
  matches: apiMatches, // Rename to distinguish from processed
  participants,
  onMatchClick,
}: DarkChallongeBracketProps): ReactNode => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the scrollable container

  const [processedMatches, setProcessedMatches] = useState<UIExtendedMatch[]>([]);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // --- Layout Constants (Challonge-like, adjust as needed) ---
  const MATCH_WIDTH = 180;
  const MATCH_HEIGHT = 50; // Increased for better readability
  const PLAYER_SLOT_HEIGHT = MATCH_HEIGHT / 2;
  const HORIZONTAL_GAP_BETWEEN_ROUNDS = 80; // Space between columns
  const VERTICAL_MATCH_SPACING_BASE = 25; // Base vertical gap between matches in a round
  const SECTION_VERTICAL_GAP = 60; // Gap between WB and LB
  const PADDING = 30; // Padding around the entire bracket content

  const participantsMap = React.useMemo(() => {
    return new Map(participants.map(p => [p.id, p]));
  }, [participants]);

  const getParticipantName = (id: string | null) => {
    if (!id) return 'TBD';
    return participantsMap.get(id)?.participant_name || 'Unknown';
  };
  const getParticipantSeed = (id: string | null) => {
    return participantsMap.get(id)?.seed;
  };

  // --- Match Data Processing ---
  useEffect(() => {
    if (!apiMatches || apiMatches.length === 0) {
        setProcessedMatches([]);
        return;
    }

    const extended: UIExtendedMatch[] = apiMatches.map(m => {
        let ui_bracket: UIExtendedMatch['ui_bracket'] = 'WINNERS'; // Default
        let ui_is_grand_final_match = false;

        if (tournament.format === 'SINGLE_ELIMINATION') {
            ui_bracket = 'WINNERS';
        } else if (tournament.format === 'DOUBLE_ELIMINATION') {
            if (m.bracket_type === 'WINNERS') ui_bracket = 'WINNERS';
            else if (m.bracket_type === 'LOSERS') ui_bracket = 'LOSERS';
            else if (m.bracket_type === 'GRAND_FINALS') {
                ui_bracket = 'GRAND_FINALS_SECTION';
                ui_is_grand_final_match = true;
            } else { // Fallback if bracket_type is missing for DE (less ideal)
                const numParticipantsPowerOfTwo = Math.pow(2, Math.ceil(Math.log2(participants.length || 2)));
                const winnersRounds = Math.log2(numParticipantsPowerOfTwo);
                 ui_bracket = m.round <= winnersRounds ? 'WINNERS' : 'LOSERS'; // Basic inference
            }
        }
        
        return {
            ...m,
            ui_bracket,
            ui_is_grand_final_match,
            ui_participant1_name: getParticipantName(m.participant1_id),
            ui_participant2_name: getParticipantName(m.participant2_id),
            ui_participant1_seed: getParticipantSeed(m.participant1_id),
            ui_participant2_seed: getParticipantSeed(m.participant2_id),
        };
    });
    setProcessedMatches(extended);
  }, [apiMatches, participantsMap, tournament.format, participants.length]);


  // --- Layout Calculation ---
  useEffect(() => {
    if (processedMatches.length === 0) {
        setMatchPositions({});
        setCanvasSize({width: PADDING*2, height: PADDING*2});
        return;
    };

    const newPositions: Record<string, { x: number; y: number }> = {};
    let maxOverallX = 0;
    let maxOverallY = 0;
    let currentYOffset = PADDING;

    const layoutBracketSection = (
      matches: UIExtendedMatch[],
      isLosersBracket: boolean = false
    ) => {
      if (matches.length === 0) return;

      const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b);
      const maxRoundInSection = rounds[rounds.length - 1];

      rounds.forEach(roundNum => {
        const matchesInThisRound = matches
          .filter(m => m.round === roundNum)
          .sort((a, b) => a.match_number - b.match_number);

        const roundX = PADDING + (roundNum - 1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
        maxOverallX = Math.max(maxOverallX, roundX + MATCH_WIDTH);

        // Calculate vertical spacing: more space in earlier rounds
        const numPotentialSlotsInNextRound = Math.pow(2, maxRoundInSection - roundNum);
        const verticalSpacing = (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE) * numPotentialSlotsInNextRound - MATCH_HEIGHT;


        matchesInThisRound.forEach((match, indexInRound) => {
          // For the first match in the round, its Y is its natural placement.
          // Subsequent matches are placed relative to the "center" of their feeding structure.
          let matchY = currentYOffset + (indexInRound * verticalSpacing) + (indexInRound * MATCH_HEIGHT);

          if (roundNum > 1) {
              // Try to align with the center of its feeders
              const feederMatches = processedMatches.filter(
                  (feeder) => feeder.next_match_id === match.id || (isLosersBracket && feeder.loser_next_match_id === match.id)
              );

              if (feederMatches.length > 0) {
                  let totalFeederY = 0;
                  let validFeeders = 0;
                  feederMatches.forEach(fm => {
                      if (newPositions[fm.id]) {
                          totalFeederY += newPositions[fm.id].y;
                          validFeeders++;
                      }
                  });
                  if (validFeeders > 0) {
                     matchY = (totalFeederY / validFeeders) + (feederMatches.length > 1 ? 0 : MATCH_HEIGHT / 2) - (MATCH_HEIGHT/2); // Adjust for single feeder alignment
                  }
              }
          }
          
          newPositions[match.id] = { x: roundX, y: matchY };
          maxOverallY = Math.max(maxOverallY, matchY + MATCH_HEIGHT);
        });
      });
      currentYOffset = maxOverallY + (matches.length > 0 ? SECTION_VERTICAL_GAP : 0);
    };

    const winners = processedMatches.filter(m => m.ui_bracket === 'WINNERS');
    const losers = processedMatches.filter(m => m.ui_bracket === 'LOSERS');
    const grandFinals = processedMatches.filter(m => m.ui_bracket === 'GRAND_FINALS_SECTION')
                        .sort((a,b)=> a.match_number - b.match_number); // Ensure GF matches are ordered

    layoutBracketSection(winners);
    if (tournament.format === 'DOUBLE_ELIMINATION') {
        layoutBracketSection(losers, true);
    }
    
    // Layout Grand Finals separately, often centered or at the end of WB
    if (grandFinals.length > 0) {
        const lastWinnerRoundX = PADDING + (Math.max(0, ...winners.map(m=>m.round)) -1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
        const gfRoundX = lastWinnerRoundX + MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS;
        maxOverallX = Math.max(maxOverallX, gfRoundX + MATCH_WIDTH);

        let gfStartY = PADDING;
        if (winners.length > 0) {
             // Try to center GF relative to winners final
            const wfMatch = winners.find(m => !m.next_match_id && !m.ui_is_grand_final_match && m.round === Math.max(...winners.map(wm => wm.round)));
            if (wfMatch && newPositions[wfMatch.id]) {
                gfStartY = newPositions[wfMatch.id].y;
            }
        }
        
        grandFinals.forEach((gfMatch, index) => {
            newPositions[gfMatch.id] = {
                x: gfRoundX,
                y: gfStartY + index * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE)
            };
            maxOverallY = Math.max(maxOverallY, newPositions[gfMatch.id].y + MATCH_HEIGHT);
        });
    }


    setMatchPositions(newPositions);
    setCanvasSize({
      width: Math.max(800, maxOverallX + PADDING),
      height: Math.max(600, maxOverallY + PADDING),
    });
  }, [processedMatches, tournament.format, participants.length]); // Re-calculate if these change

  // --- Rendering Functions ---
  const renderMatchSVG = (match: UIExtendedMatch) => {
    const pos = matchPositions[match.id];
    if (!pos) return null;

    const p1Name = match.ui_participant1_name;
    const p2Name = match.ui_participant2_name;
    const p1Seed = match.ui_participant1_seed;
    const p2Seed = match.ui_participant2_seed;
    
    const p1Score = match.score_participant1 ?? '-';
    const p2Score = match.score_participant2 ?? '-';

    const isP1Winner = match.winner_id === match.participant1_id;
    const isP2Winner = match.winner_id === match.participant2_id;

    return (
      <g
        key={match.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => onMatchClick && onMatchClick(match)}
        style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
        className="match-group hover:opacity-80 transition-opacity"
      >
        {/* Main Box */}
        <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" fill="#2d3748" stroke="#4a5567" />

        {/* Top Player Slot */}
        <rect x="0" y="0" width={MATCH_WIDTH} height={PLAYER_SLOT_HEIGHT} fill="transparent" />
        {p1Seed && (
          <text x="7" y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p1Seed}</text>
        )}
        <text x={p1Seed ? 25 : 10} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"} className="participant-name">{p1Name}</text>
        <text x={MATCH_WIDTH - 10} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"}>{p1Score}</text>

        {/* Divider */}
        <line x1="0" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" />

        {/* Bottom Player Slot */}
        <rect x="0" y={PLAYER_SLOT_HEIGHT} width={MATCH_WIDTH} height={PLAYER_SLOT_HEIGHT} fill="transparent" />
        {p2Seed && (
            <text x="7" y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p2Seed}</text>
        )}
        <text x={p2Seed ? 25 : 10} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"} className="participant-name">{p2Name}</text>
        <text x={MATCH_WIDTH - 10} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"}>{p2Score}</text>
      
        {/* Match Number (optional, can add if desired) */}
         <text x={MATCH_WIDTH / 2} y={-8} textAnchor="middle" fontSize="10" fill="#718096">M{match.match_number}</text>
      </g>
    );
  };

  const renderConnectorLinesSVG = () => {
    const lines: React.ReactNode[] = [];
    processedMatches.forEach(sourceMatch => {
      const sourcePos = matchPositions[sourceMatch.id];
      if (!sourcePos) return;

      // Winner Line
      if (sourceMatch.next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const startX = sourcePos.x + MATCH_WIDTH;
          const startY = sourcePos.y + PLAYER_SLOT_HEIGHT / 2; // Mid-point of the top player slot (winner usually advances from top) OR overall mid. For simplicity: MATCH_HEIGHT/2 for general case.
          const endX = targetPos.x;
          let endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2; // Feeds into P1 slot of next match

           // If this sourceMatch is an odd match_number, it might feed into P1, if even into P2 of target.
           // This needs backend to specify which slot (p1_prereq_match_id vs p2_prereq_match_id)
           // Or, a common convention: first listed feeder goes to P1, second to P2.
           // For simplicity, assume it feeds into the center of the target player slot that the *winner* would occupy.
           // Which slot does a winner of `sourceMatch` go to in `targetMatch`?
           // Let's assume all winners feed generally into the target match's vertical center for now, simplify line.
           
           const targetMidY = targetPos.y + MATCH_HEIGHT / 2;
           // If sourceMatch feeds the first participant of targetMatch OR targetMatch's participant1_id matches winner of sourceMatch if source is COMPLETED
           if (targetMatch.participant1_prereq_match_id === sourceMatch.id || (targetMatch.participant1_id && sourceMatch.winner_id === targetMatch.participant1_id)) {
               endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           } 
           // If sourceMatch feeds the second participant
           else if (targetMatch.participant2_prereq_match_id === sourceMatch.id || (targetMatch.participant2_id && sourceMatch.winner_id === targetMatch.participant2_id)) {
               endY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           } else {
                // Fallback: if not determined, use overall middle
                endY = targetPos.y + MATCH_HEIGHT / 2;
                // More advanced: check if targetMatch.participant1_id is null, if so, this winner likely goes there
                if(targetMatch.participant1_id === null) endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
                else if(targetMatch.participant2_id === null) endY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           }


          lines.push(
            <path key={`w-${sourceMatch.id}`}
                  d={`M ${startX} ${sourcePos.y + MATCH_HEIGHT/2} L ${startX + HORIZONTAL_GAP_BETWEEN_ROUNDS/2} ${sourcePos.y + MATCH_HEIGHT/2} L ${startX + HORIZONTAL_GAP_BETWEEN_ROUNDS/2} ${endY} L ${endX} ${endY}`}
                  stroke="#4b5563" strokeWidth="1.5" fill="none" />
          );
        }
      }
      // Loser Line (for Double Elimination)
      if (tournament.format === 'DOUBLE_ELIMINATION' && sourceMatch.loser_next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.loser_next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const startX = sourcePos.x + MATCH_WIDTH / 2; // Center of source match
          const startY = sourcePos.y + MATCH_HEIGHT;    // Bottom of source match
          const endX = targetPos.x;
          let endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2; // Default to P1 slot

           if (targetMatch.participant1_prereq_match_id === sourceMatch.id || (targetMatch.participant1_id && sourceMatch.loser_id === targetMatch.participant1_id)) { // assuming loser_id is available
               endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           }
           else if (targetMatch.participant2_prereq_match_id === sourceMatch.id || (targetMatch.participant2_id && sourceMatch.loser_id === targetMatch.participant2_id)) {
               endY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           } else {
                if(targetMatch.participant1_id === null) endY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
                else if(targetMatch.participant2_id === null) endY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           }


          lines.push(
            <path key={`l-${sourceMatch.id}`}
                  d={`M ${startX} ${startY} L ${startX} ${startY + SECTION_VERTICAL_GAP/3} L ${endX - HORIZONTAL_GAP_BETWEEN_ROUNDS/2} ${startY + SECTION_VERTICAL_GAP/3} L ${endX - HORIZONTAL_GAP_BETWEEN_ROUNDS/2} ${endY} L ${endX} ${endY}`}
                  stroke="#7f1d1d" strokeWidth="1.5" fill="none" strokeDasharray="3,3" />
          );
        }
      }
    });
    return lines;
  };


  // --- Component Return ---
  return (
    <div ref={containerRef} className="challonge-bracket-viewer bg-gray-800 text-gray-200 p-4 overflow-auto" style={{width: '100%'}}>
      {/* Add zoom/pan controls if desired here */}
      <svg ref={svgRef} width={canvasSize.width} height={canvasSize.height} style={{ minWidth: '100%', display: 'block' }}>
        {/* renderRoundHeadersSVG() if you want SVG round headers */}
        {renderConnectorLinesSVG()}
        {processedMatches.map(match => renderMatchSVG(match))}
      </svg>
      <style jsx global>{`
        .participant-name {
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: ${MATCH_WIDTH - 60}px; /* Adjust based on seed/score box widths */
        }
      `}</style>
    </div>
  );
};

export default DarkChallongeBracket;