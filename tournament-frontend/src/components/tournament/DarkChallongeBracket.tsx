// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode } from 'react';

// Keep existing interface definitions: Participant, Match, TournamentFormat, Tournament
// Your Match interface should include participant1_prereq_match_id and participant2_prereq_match_id (optional strings)
// if you want perfect connector targeting.
// Ensure UIExtendedMatch interface is also as previously discussed

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
  loser_id?: string | null;
  next_match_id: string | null;
  loser_next_match_id: string | null;
  participant1_prereq_match_id?: string | null; // Add this if your API sends it
  participant2_prereq_match_id?: string | null; // Add this if your API sends it
  score_participant1: string | number | null;
  score_participant2: string | number | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | string;
  bracket_type?: 'WINNERS' | 'LOSERS' | 'GRAND_FINALS';
}

type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';

interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
}


// Using ui_bracket_section as suggested before
interface UIExtendedMatch extends Match {
  ui_bracket_section: 'WINNERS' | 'LOSERS' | 'GRAND_FINALS';
  ui_participant1_name: string;
  ui_participant2_name: string;
  ui_participant1_seed?: number;
  ui_participant2_seed?: number;
}


interface DarkChallongeBracketProps {
  tournament: Tournament;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: UIExtendedMatch) => void; // Use UIExtendedMatch
}

const DarkChallongeBracket = ({
  tournament,
  matches: apiMatches,
  participants,
  onMatchClick,
}: DarkChallongeBracketProps): ReactNode => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [processedMatches, setProcessedMatches] = useState<UIExtendedMatch[]>([]);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const MATCH_WIDTH = 180;
  const MATCH_HEIGHT = 55; // Slightly taller
  const PLAYER_SLOT_HEIGHT = MATCH_HEIGHT / 2;
  const HORIZONTAL_GAP_BETWEEN_ROUNDS = 80;
  const VERTICAL_MATCH_SPACING_BASE = 15; // Reduced base spacing significantly
  const SECTION_VERTICAL_GAP = 50;       // Reduced gap between WB and LB
  const PADDING = 30;

  const participantsMap = React.useMemo(() => {
    return new Map(participants.map(p => [p.id, p]));
  }, [participants]);

  const getParticipantName = (id: string | null) => { /* ... (keep as is) ... */ if (!id) return 'TBD'; return participantsMap.get(id)?.participant_name || 'Unknown Player'; };
  const getParticipantSeed = (id: string | null) => { /* ... (keep as is) ... */ return participantsMap.get(id)?.seed; };

  // --- Match Data Processing ---
  useEffect(() => {
    if (!apiMatches || apiMatches.length === 0) {
      setProcessedMatches([]);
      return;
    }
    // This processing logic was better in the previous full component example I gave.
    // Let's use the `ui_bracket_section` for clarity.
    const extended: UIExtendedMatch[] = apiMatches.map(m => {
        let ui_section: UIExtendedMatch['ui_bracket_section'] = 'WINNERS';
        if (tournament.format === 'DOUBLE_ELIMINATION') {
            if (m.bracket_type === 'LOSERS') ui_section = 'LOSERS';
            else if (m.bracket_type === 'GRAND_FINALS') ui_section = 'GRAND_FINALS';
            else ui_section = 'WINNERS'; // Default to winners if not specified for DE
        } // For SE, all are WINNERS implicitly or by backend `bracket_type`

        return {
            ...m,
            ui_bracket_section: ui_section,
            ui_participant1_name: getParticipantName(m.participant1_id),
            ui_participant2_name: getParticipantName(m.participant2_id),
            ui_participant1_seed: getParticipantSeed(m.participant1_id),
            ui_participant2_seed: getParticipantSeed(m.participant2_id),
        };
    });
    setProcessedMatches(extended);
  }, [apiMatches, participantsMap, tournament.format, participants.length]);


  // --- Layout Calculation (REVISED) ---
  useEffect(() => {
    if (processedMatches.length === 0) {
      setMatchPositions({});
      setCanvasSize({ width: PADDING * 2, height: PADDING * 2 });
      return;
    }

    const newPositions: Record<string, { x: number; y: number }> = {};
    let overallMaxX = 0;
    let overallMaxY = 0;

    // Function to lay out one section of the bracket (e.g., Winners, Losers)
    const layoutSection = (
      sectionMatches: UIExtendedMatch[],
      initialY: number,
      isLosers: boolean = false
    ): { sectionMaxY: number; sectionMaxX: number } => {
      if (sectionMatches.length === 0) return { sectionMaxY: initialY, sectionMaxX: 0 };

      let currentSectionMaxY = initialY;
      let currentSectionMaxX = 0;
      const rounds = [...new Set(sectionMatches.map(m => m.round))].sort((a, b) => a - b);
      const roundData: Record<number, { yPositions: number[]; x: number; matches: UIExtendedMatch[] }> = {};


      rounds.forEach((roundNum, roundIndex) => {
        const matchesInThisRound = sectionMatches
          .filter(m => m.round === roundNum)
          .sort((a, b) => a.match_number - b.match_number);

        const roundX = PADDING + roundNum * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
        currentSectionMaxX = Math.max(currentSectionMaxX, roundX + MATCH_WIDTH);
        roundData[roundNum] = { yPositions: [], x: roundX, matches: matchesInThisRound };

        let yCursorForRound = roundIndex === 0 ? initialY : 0; // yCursor gets updated by feeder logic

        matchesInThisRound.forEach((match, indexInRound) => {
          let matchY: number;

          if (roundIndex === 0) { // First round of this section
            if (indexInRound === 0) {
              matchY = yCursorForRound;
            } else {
              const prevMatchId = matchesInThisRound[indexInRound - 1].id;
              matchY = newPositions[prevMatchId].y + MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE;
            }
          } else { // Subsequent rounds: position based on feeders
            const feederMatches = processedMatches.filter(
              fm => fm.next_match_id === match.id || (isLosers && fm.loser_next_match_id === match.id)
            );

            if (feederMatches.length > 0) {
              let totalFeederCenterY = 0;
              let validFeeders = 0;
              feederMatches.forEach(fm => {
                if (newPositions[fm.id]) {
                  totalFeederCenterY += (newPositions[fm.id].y + MATCH_HEIGHT / 2);
                  validFeeders++;
                }
              });
              if (validFeeders > 0) {
                matchY = (totalFeederCenterY / validFeeders) - MATCH_HEIGHT / 2;
              } else {
                // Fallback if feeders aren't positioned yet (shouldn't happen with sorted rounds)
                matchY = (roundData[rounds[roundIndex-1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
              }
            } else {
              // No feeders (e.g. bye match into R2). Position relative to others in round or previous round start.
              if (indexInRound === 0) {
                 matchY = roundData[rounds[roundIndex-1]]?.yPositions[0] || currentSectionMaxY // Align to previous round or current max Y
              } else {
                const prevMatchId = matchesInThisRound[indexInRound - 1].id;
                matchY = newPositions[prevMatchId].y + MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE;
              }
            }
          }

          // Crucial: Prevent overlap within the *same round* after calculating based on feeders
          if (indexInRound > 0) {
            const prevMatchId = matchesInThisRound[indexInRound - 1].id;
            const minRequiredY = newPositions[prevMatchId].y + MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE;
            matchY = Math.max(matchY, minRequiredY);
          }

          newPositions[match.id] = { x: roundX, y: matchY };
          roundData[roundNum].yPositions.push(matchY);
          currentSectionMaxY = Math.max(currentSectionMaxY, matchY + MATCH_HEIGHT);
        });
      });
      return { sectionMaxY: currentSectionMaxY, sectionMaxX: currentSectionMaxX };
    };

    let currentGlobalYOffset = PADDING;

    const winnersMatches = processedMatches.filter(m => m.ui_bracket_section === 'WINNERS');
    const losersMatches = processedMatches.filter(m => m.ui_bracket_section === 'LOSERS');
    const grandFinalsMatches = processedMatches.filter(m => m.ui_bracket_section === 'GRAND_FINALS')
                                .sort((a, b) => a.round - b.round || a.match_number - b.match_number);


    const { sectionMaxY: winnersEndBracketY, sectionMaxX: winnersEndBracketX } = layoutSection(
      winnersMatches,
      currentGlobalYOffset
    );
    overallMaxX = Math.max(overallMaxX, winnersEndBracketX);
    overallMaxY = Math.max(overallMaxY, winnersEndBracketY);
    currentGlobalYOffset = winnersEndBracketY + (winnersMatches.length > 0 ? SECTION_VERTICAL_GAP : 0);


    if (tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0) {
      const { sectionMaxY: losersEndBracketY, sectionMaxX: losersEndBracketX } = layoutSection(
        losersMatches,
        currentGlobalYOffset, // Start losers below winners
        true
      );
      overallMaxX = Math.max(overallMaxX, losersEndBracketX);
      overallMaxY = Math.max(overallMaxY, losersEndBracketY);
      currentGlobalYOffset = losersEndBracketY + (losersMatches.length > 0 ? SECTION_VERTICAL_GAP : 0);
    }
    
    if (grandFinalsMatches.length > 0) {
      const lastRoundOfWinners = Math.max(0, ...winnersMatches.map(m => m.round));
      // Place GF one "round" after the last winner's round, or after losers if DE
      let gfRoundX = PADDING + (lastRoundOfWinners + 1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
       if (tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0) {
           const lastRoundOfLosers = Math.max(0, ...losersMatches.map(m => m.round));
           gfRoundX = PADDING + (Math.max(lastRoundOfWinners, lastRoundOfLosers) +1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
       }

      overallMaxX = Math.max(overallMaxX, gfRoundX + MATCH_WIDTH);

      // Attempt to vertically center Grand Finals with Winners Bracket Final (if available)
      let gfStartY = PADDING;
      const wbFinal = winnersMatches.find(m => !m.next_match_id && m.round === lastRoundOfWinners);
      if (wbFinal && newPositions[wbFinal.id]) {
           const totalGfHeight = grandFinalsMatches.length * MATCH_HEIGHT + (grandFinalsMatches.length - 1) * VERTICAL_MATCH_SPACING_BASE;
           gfStartY = newPositions[wbFinal.id].y + (MATCH_HEIGHT / 2) - (totalGfHeight / 2);
           gfStartY = Math.max(PADDING, gfStartY); // Don't let it go above padding
      } else {
           // Fallback: start it after the last drawn content if WB final not found or not positioned
           gfStartY = currentGlobalYOffset;
      }


      grandFinalsMatches.forEach((gfMatch, index) => {
        const yPos = gfStartY + index * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
        newPositions[gfMatch.id] = { x: gfRoundX, y: yPos };
        overallMaxY = Math.max(overallMaxY, yPos + MATCH_HEIGHT);
      });
    }


    setMatchPositions(newPositions);
    setCanvasSize({
      width: Math.max(800, overallMaxX + PADDING), // Max of default or content
      height: Math.max(600, overallMaxY + PADDING), // Max of default or content
    });
  }, [processedMatches, tournament.format]);


  // --- Rendering Functions ---
  // renderMatchSVG - (largely keep as is, but ensure it uses UIExtendedMatch)
  const renderMatchSVG = (match: UIExtendedMatch) => {
    const pos = matchPositions[match.id];
    if (!pos) return null;

    const p1Name = match.ui_participant1_name;
    const p2Name = match.ui_participant2_name;
    const p1Seed = match.ui_participant1_seed;
    const p2Seed = match.ui_participant2_seed;
    
    const p1Score = match.score_participant1 ?? '-';
    const p2Score = match.score_participant2 ?? '-';

    // Check against null IDs for winner status
    const isP1Winner = match.winner_id === match.participant1_id && match.participant1_id !== null;
    const isP2Winner = match.winner_id === match.participant2_id && match.participant2_id !== null;

    return (
      <g
        key={match.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => onMatchClick && onMatchClick(match)}
        style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
        className="match-group hover:opacity-80 transition-opacity"
      >
        {/* Main Box */}
        <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" fill="#2d3748" stroke="#4a5567" strokeWidth="1.5"/>

        {/* Top Player Slot */}
        <rect x="0" y="0" width={MATCH_WIDTH} height={PLAYER_SLOT_HEIGHT} fill="transparent" />
        {p1Seed != null && (
          <text x="7" y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p1Seed}</text>
        )}
        <text x={p1Seed != null ? 25 : 10} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"} className="participant-name">{p1Name}</text>
        <text x={MATCH_WIDTH - 10} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"}>{p1Score}</text>

        {/* Divider */}
        <line x1="0" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" />

        {/* Bottom Player Slot */}
        <rect x="0" y={PLAYER_SLOT_HEIGHT} width={MATCH_WIDTH} height={PLAYER_SLOT_HEIGHT} fill="transparent" />
        {p2Seed != null && (
            <text x="7" y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p2Seed}</text>
        )}
        <text x={p2Seed != null ? 25 : 10} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"} className="participant-name">{p2Name}</text>
        <text x={MATCH_WIDTH - 10} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"}>{p2Score}</text>
      
         <text x={MATCH_WIDTH / 2} y={-8} textAnchor="middle" fontSize="10" fill="#718096">
            M{match.match_number} {match.ui_bracket_section !== 'WINNERS' ? `(${match.ui_bracket_section.substring(0,1)})` : ''}
         </text>
      </g>
    );
  };

  // renderConnectorLinesSVG - REVISED for clarity and better connection points
  const renderConnectorLinesSVG = () => {
    const lines: React.ReactNode[] = [];
    const H_OFFSET = HORIZONTAL_GAP_BETWEEN_ROUNDS / 2;

    processedMatches.forEach(sourceMatch => {
      const sourcePos = matchPositions[sourceMatch.id];
      if (!sourcePos) return;

      // WINNER LINES
      if (sourceMatch.next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;

        if (targetMatch && targetPos) {
          const sourceX = sourcePos.x + MATCH_WIDTH;
          // Default source Y from middle of the match box
          let sourceY = sourcePos.y + MATCH_HEIGHT / 2; 

          const targetX = targetPos.x;
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2; // Default to P1 slot of target

          // Try to determine target slot more accurately
          // 1. Using participant_prereq_match_id from target match (BEST)
          if (targetMatch.participant1_prereq_match_id === sourceMatch.id) {
            targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          } else if (targetMatch.participant2_prereq_match_id === sourceMatch.id) {
            targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          }
          // 2. Fallback: If target slot P1 is TBD, connect there. Else if P2 is TBD, connect there.
          else if (targetMatch.participant1_id === null && targetMatch.status === 'PENDING') {
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          } else if (targetMatch.participant2_id === null && targetMatch.status === 'PENDING') {
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          }
          // 3. Further Fallback: Based on whether source match winner matches an existing participant in target
          else if (sourceMatch.winner_id && targetMatch.participant1_id === sourceMatch.winner_id){
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          } else if (sourceMatch.winner_id && targetMatch.participant2_id === sourceMatch.winner_id){
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          }
           // As a last resort, if targetting P1 slot, source Y is often middle of top player slot.
           // If targetting P2 slot, source Y is middle of bottom player slot.
           // For now, keeping sourceY = sourcePos.y + MATCH_HEIGHT / 2 (middle) which is generally robust.

          lines.push(
            <path key={`w-${sourceMatch.id}`}
                  d={`M ${sourceX} ${sourceY} L ${sourceX + H_OFFSET} ${sourceY} L ${targetX - H_OFFSET} ${targetY} L ${targetX} ${targetY}`}
                  stroke="#4b5563" strokeWidth="1.5" fill="none" />
          );
        }
      }

      // LOSER LINES (for Double Elimination)
      if (tournament.format === 'DOUBLE_ELIMINATION' && sourceMatch.loser_next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.loser_next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;

        if (targetMatch && targetPos) {
          // Loser lines usually drop down from source match center bottom
          const sourceX = sourcePos.x + MATCH_WIDTH / 2;
          const sourceY = sourcePos.y + MATCH_HEIGHT;
          const targetX = targetPos.x; // Target is left edge
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2; // Default to P1 slot of target

           // Similar logic to winner lines for determining targetY
           if (targetMatch.participant1_prereq_match_id === sourceMatch.id) { // (Unlikely prereq refers to loser path, but check)
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           } else if (targetMatch.participant2_prereq_match_id === sourceMatch.id) {
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           } else if (targetMatch.participant1_id === null && targetMatch.status === 'PENDING') {
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           } else if (targetMatch.participant2_id === null && targetMatch.status === 'PENDING') {
             targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           } else if (sourceMatch.loser_id && targetMatch.participant1_id === sourceMatch.loser_id){
              targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           } else if (sourceMatch.loser_id && targetMatch.participant2_id === sourceMatch.loser_id){
              targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           }

          // Loser line path: Down, then across, then to target
          const dropY = sourceY + SECTION_VERTICAL_GAP / 3;
          lines.push(
            <path key={`l-${sourceMatch.id}`}
                  d={`M ${sourceX} ${sourceY} L ${sourceX} ${dropY} L ${targetX - H_OFFSET} ${dropY} L ${targetX - H_OFFSET} ${targetY} L ${targetX} ${targetY}`}
                  stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeDasharray="3,3" />
          );
        }
      }
    });
    return lines;
  };


  return (
    <div ref={containerRef} className="challonge-bracket-viewer bg-gray-800 text-gray-200 p-4 overflow-auto" style={{width: '100%'}}>
      <svg ref={svgRef} width={canvasSize.width} height={canvasSize.height} style={{ minWidth: '100%', display: 'block' }}>
        {renderConnectorLinesSVG()}
        {processedMatches.map(match => renderMatchSVG(match))}
      </svg>
      {/* Keep the participant-name style if you implement more robust truncation in renderMatchSVG, or remove if not needed */}
      {/* <style jsx global>{` ... `}</style> */}
    </div>
  );
};

export default DarkChallongeBracket;