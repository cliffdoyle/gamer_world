// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

// Keep existing interface definitions: Participant, Match, TournamentFormat, Tournament
interface Participant {
  id: string;
  participant_name: string;
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
  participant1_prereq_match_id?: string | null;
  participant2_prereq_match_id?: string | null;
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
  onMatchClick?: (match: UIExtendedMatch) => void; // Click on match to initiate edit
  inlineEditingMatchId?: string | null;
  inlineScores?: { p1: string; p2: string };
  onInlineScoreChange?: (scores: { p1: string; p2: string }) => void;
  onInlineScoreSubmit?: () => void;
  onCancelInlineEdit?: () => void;
}

const DarkChallongeBracket = ({
  tournament,
  matches: apiMatches,
  participants,
  onMatchClick,
  inlineEditingMatchId,
  inlineScores,
  onInlineScoreChange,
  onInlineScoreSubmit,
  onCancelInlineEdit,
}: DarkChallongeBracketProps): ReactNode => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [processedMatches, setProcessedMatches] = useState<UIExtendedMatch[]>([]);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const MATCH_WIDTH = 190; // Slightly wider to accommodate inputs/icons
  const MATCH_HEIGHT = 60; // Slightly taller for better spacing with inputs
  const PLAYER_SLOT_HEIGHT = MATCH_HEIGHT / 2;
  const HORIZONTAL_GAP_BETWEEN_ROUNDS = 80;
  const VERTICAL_MATCH_SPACING_BASE = 20; // Increased base spacing
  const SECTION_VERTICAL_GAP = 50;
  const PADDING = 30;

  const participantsMap = React.useMemo(() => {
    return new Map(participants.map(p => [p.id, p]));
  }, [participants]);

  const getParticipantName = (id: string | null) => { if (!id) return 'TBD'; return participantsMap.get(id)?.participant_name || 'Unknown Player'; };
  const getParticipantSeed = (id: string | null) => { return participantsMap.get(id)?.seed; };

  useEffect(() => {
    if (!apiMatches || apiMatches.length === 0) {
      setProcessedMatches([]);
      return;
    }
    const extended: UIExtendedMatch[] = apiMatches.map(m => {
        let ui_section: UIExtendedMatch['ui_bracket_section'] = 'WINNERS';
        if (tournament.format === 'DOUBLE_ELIMINATION') {
            if (m.bracket_type === 'LOSERS') ui_section = 'LOSERS';
            else if (m.bracket_type === 'GRAND_FINALS') ui_section = 'GRAND_FINALS';
            else ui_section = 'WINNERS';
        }
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
  }, [apiMatches, participantsMap, tournament.format, getParticipantName, getParticipantSeed]); // Added dependencies


  useEffect(() => {
    if (processedMatches.length === 0) {
      setMatchPositions({});
      setCanvasSize({ width: PADDING * 2, height: PADDING * 2 });
      return;
    }

    const newPositions: Record<string, { x: number; y: number }> = {};
    let overallMaxX = 0;
    let overallMaxY = 0;

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

        matchesInThisRound.forEach((match, indexInRound) => {
          let matchY: number;

          if (roundIndex === 0) {
            matchY = initialY + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
          } else {
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
              matchY = validFeeders > 0 ? (totalFeederCenterY / validFeeders) - MATCH_HEIGHT / 2 : 
                       (roundData[rounds[roundIndex-1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
            } else {
               matchY = (roundData[rounds[roundIndex-1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
            }
          }
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

    const { sectionMaxY: winnersEndBracketY, sectionMaxX: winnersEndBracketX } = layoutSection(winnersMatches, currentGlobalYOffset);
    overallMaxX = Math.max(overallMaxX, winnersEndBracketX);
    overallMaxY = Math.max(overallMaxY, winnersEndBracketY);
    currentGlobalYOffset = winnersEndBracketY + (winnersMatches.length > 0 ? SECTION_VERTICAL_GAP : 0);

    if (tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0) {
      const { sectionMaxY: losersEndBracketY, sectionMaxX: losersEndBracketX } = layoutSection(losersMatches, currentGlobalYOffset, true);
      overallMaxX = Math.max(overallMaxX, losersEndBracketX);
      overallMaxY = Math.max(overallMaxY, losersEndBracketY);
      currentGlobalYOffset = losersEndBracketY + (losersMatches.length > 0 ? SECTION_VERTICAL_GAP : 0);
    }
    
    if (grandFinalsMatches.length > 0) {
      const lastRoundOfWinners = Math.max(0, ...winnersMatches.map(m => m.round));
      let gfRoundX = PADDING + (lastRoundOfWinners + 1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
       if (tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0) {
           const lastRoundOfLosers = Math.max(0, ...losersMatches.map(m => m.round));
           gfRoundX = PADDING + (Math.max(lastRoundOfWinners, lastRoundOfLosers) +1) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
       }
      overallMaxX = Math.max(overallMaxX, gfRoundX + MATCH_WIDTH);
      let gfStartY = PADDING;
      const wbFinal = winnersMatches.find(m => !m.next_match_id && m.round === lastRoundOfWinners);
      if (wbFinal && newPositions[wbFinal.id]) {
           const totalGfHeight = grandFinalsMatches.length * MATCH_HEIGHT + (grandFinalsMatches.length - 1) * VERTICAL_MATCH_SPACING_BASE;
           gfStartY = newPositions[wbFinal.id].y + (MATCH_HEIGHT / 2) - (totalGfHeight / 2);
           gfStartY = Math.max(PADDING, gfStartY);
      } else {
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
      width: Math.max(800, overallMaxX + PADDING),
      height: Math.max(600, overallMaxY + PADDING),
    });
  }, [processedMatches, tournament.format, PADDING, HORIZONTAL_GAP_BETWEEN_ROUNDS, MATCH_HEIGHT, MATCH_WIDTH, SECTION_VERTICAL_GAP, VERTICAL_MATCH_SPACING_BASE]); // Added dependencies

  const renderMatchSVG = (match: UIExtendedMatch) => {
    const pos = matchPositions[match.id];
    if (!pos) return null;

    const isBeingEdited = inlineEditingMatchId === match.id;
    const canEditMatch = match.participant1_id && match.participant2_id && match.status !== 'COMPLETED';
    // Ensure all handlers and inlineScores are present for editing UI
    const editModeFullyEnabled = isBeingEdited && inlineScores && onInlineScoreChange && onInlineScoreSubmit && onCancelInlineEdit;

    const p1Name = match.ui_participant1_name;
    const p2Name = match.ui_participant2_name;
    
    if (editModeFullyEnabled) {
        // INLINE EDITING UI
        return (
            <g key={`${match.id}-edit`} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" fill="#374151" stroke="#4f46e5" strokeWidth="2"/>
                
                {/* Player 1 Row */}
                <foreignObject x="5" y="2" width={MATCH_WIDTH - 75} height={PLAYER_SLOT_HEIGHT - 4}>
                    <div title={p1Name} className="text-slate-100 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23.5px] font-medium">{p1Name}</div>
                </foreignObject>
                <foreignObject x={MATCH_WIDTH - 65} y="3" width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                    <input
                        type="number" min="0" autoFocus
                        value={inlineScores!.p1}
                        onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p1: e.target.value })}
                        className="w-full h-full text-center bg-slate-800 text-slate-50 border border-slate-600 rounded text-xs p-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                </foreignObject>

                <line x1="5" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH - 5} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" strokeWidth="0.5"/>

                {/* Player 2 Row */}
                <foreignObject x="5" y={PLAYER_SLOT_HEIGHT + 2} width={MATCH_WIDTH - 75} height={PLAYER_SLOT_HEIGHT - 4}>
                    <div title={p2Name} className="text-slate-100 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23.5px] font-medium">{p2Name}</div>
                </foreignObject>
                <foreignObject x={MATCH_WIDTH - 65} y={PLAYER_SLOT_HEIGHT + 3} width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                    <input
                        type="number" min="0"
                        value={inlineScores!.p2}
                        onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p2: e.target.value })}
                        className="w-full h-full text-center bg-slate-800 text-slate-50 border border-slate-600 rounded text-xs p-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                </foreignObject>
                
                {/* Action Buttons (Save/Cancel) in top right of match box */}
                 <foreignObject x={MATCH_WIDTH - 70} y={-15} width="60" height="16">
                    <div className="flex justify-end items-center gap-1.5 h-full">
                        <button onClick={onCancelInlineEdit} title="Cancel" className="p-0 bg-transparent border-none cursor-pointer">
                            <XCircleIcon className="w-4 h-4 text-slate-400 hover:text-slate-200"/>
                        </button>
                        <button onClick={onInlineScoreSubmit} title="Save" className="p-0 bg-transparent border-none cursor-pointer">
                            <CheckCircleIcon className="w-4 h-4 text-green-400 hover:text-green-300"/>
                        </button>
                    </div>
                </foreignObject>
                 <text x={MATCH_WIDTH / 2 - 25} y={-8} textAnchor="middle" fontSize="9" fill="#718096">
                    M{match.match_number} {match.ui_bracket_section !== 'WINNERS' ? `(${match.ui_bracket_section.substring(0,1)})` : ''}
                 </text>
            </g>
        );
    }

    // DISPLAY UI
    const p1Seed = match.ui_participant1_seed;
    const p2Seed = match.ui_participant2_seed;
    const p1Score = match.score_participant1 ?? '-';
    const p2Score = match.score_participant2 ?? '-';
    const isP1Winner = match.winner_id === match.participant1_id && match.participant1_id !== null;
    const isP2Winner = match.winner_id === match.participant2_id && match.participant2_id !== null;

    return (
      <g
        key={match.id}
        transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => canEditMatch && onMatchClick && onMatchClick(match)}
        style={{ cursor: (canEditMatch && onMatchClick) ? 'pointer' : 'default' }}
        className={`match-group transition-opacity ${ (canEditMatch && onMatchClick) ? 'hover:opacity-70 hover:stroke-blue-400' : ''}`}
      >
        <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" 
              fill={match.status === 'COMPLETED' ? "#1f2937" : "#2d3748" } /* Darker if completed */
              stroke={match.status === 'COMPLETED' ? (isP1Winner || isP2Winner ? "#166534" : "#4a5567") : "#4a5567"} /* Green border if winner, else default */
              strokeWidth="1.5"/>

        {/* Top Player Slot */}
        {p1Seed != null && (<text x="7" y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p1Seed}</text>)}
        <text x={p1Seed != null ? 22 : 10} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"} className="participant-name" title={p1Name}>{p1Name}</text>
        <text x={MATCH_WIDTH - ( (canEditMatch && match.status !== 'COMPLETED') || match.status === 'COMPLETED' ? 30 : 10)} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"}>{p1Score}</text>

        <line x1="0" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" />

        {/* Bottom Player Slot */}
        {p2Seed != null && (<text x="7" y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="10" fill="#9ca3af">{p2Seed}</text>)}
        <text x={p2Seed != null ? 22 : 10} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"} className="participant-name" title={p2Name}>{p2Name}</text>
        <text x={MATCH_WIDTH - ( (canEditMatch && match.status !== 'COMPLETED') || match.status === 'COMPLETED' ? 30 : 10)} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"}>{p2Score}</text>
      
        <text x={MATCH_WIDTH / 2} y={-8} textAnchor="middle" fontSize="10" fill="#718096">
            M{match.match_number} {match.ui_bracket_section !== 'WINNERS' ? `(${match.ui_bracket_section.substring(0,1)})` : ''}
        </text>

        {/* Edit/Status Icon - placed in P1 score area, far right */}
        {match.status !== 'COMPLETED' && canEditMatch && onMatchClick && (
            <foreignObject x={MATCH_WIDTH - 24} y={(PLAYER_SLOT_HEIGHT - 18)/2 + 1} width="18" height="18">
                <PencilSquareIcon className="w-full h-full text-blue-400 hover:text-blue-300"/>
            </foreignObject>
        )}
        {match.status === 'COMPLETED' && (
            <foreignObject x={MATCH_WIDTH - 24} y={(PLAYER_SLOT_HEIGHT - 18)/2 + 1} width="18" height="18">
                <CheckCircleIcon className="w-full h-full text-green-500"/>
            </foreignObject>
        )}
      </g>
    );
  };

  const renderConnectorLinesSVG = () => {
    const lines: React.ReactNode[] = [];
    const H_OFFSET = HORIZONTAL_GAP_BETWEEN_ROUNDS / 2;

    processedMatches.forEach(sourceMatch => {
      const sourcePos = matchPositions[sourceMatch.id];
      if (!sourcePos) return;

      if (sourceMatch.next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const sourceX = sourcePos.x + MATCH_WIDTH;
          let sourceY = sourcePos.y + MATCH_HEIGHT / 2; 
          const targetX = targetPos.x;
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;

          if (targetMatch.participant1_prereq_match_id === sourceMatch.id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          else if (targetMatch.participant2_prereq_match_id === sourceMatch.id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          else if (targetMatch.participant1_id === null && targetMatch.status === 'PENDING') targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          else if (targetMatch.participant2_id === null && targetMatch.status === 'PENDING') targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          else if (sourceMatch.winner_id && targetMatch.participant1_id === sourceMatch.winner_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
          else if (sourceMatch.winner_id && targetMatch.participant2_id === sourceMatch.winner_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
          
          lines.push( <path key={`w-${sourceMatch.id}`} d={`M ${sourceX} ${sourceY} L ${sourceX + H_OFFSET} ${sourceY} L ${targetX - H_OFFSET} ${targetY} L ${targetX} ${targetY}`} stroke="#4b5563" strokeWidth="1.5" fill="none" /> );
        }
      }
      if (tournament.format === 'DOUBLE_ELIMINATION' && sourceMatch.loser_next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.loser_next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const sourceX = sourcePos.x + MATCH_WIDTH / 2;
          const sourceY = sourcePos.y + MATCH_HEIGHT;
          const targetX = targetPos.x;
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;

           if (targetMatch.participant1_prereq_match_id === sourceMatch.id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           else if (targetMatch.participant2_prereq_match_id === sourceMatch.id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           else if (targetMatch.participant1_id === null && targetMatch.status === 'PENDING') targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           else if (targetMatch.participant2_id === null && targetMatch.status === 'PENDING') targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;
           else if (sourceMatch.loser_id && targetMatch.participant1_id === sourceMatch.loser_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           else if (sourceMatch.loser_id && targetMatch.participant2_id === sourceMatch.loser_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;

          const dropY = sourceY + Math.max(20, SECTION_VERTICAL_GAP / 3); // Ensure minimum drop
          const midX = targetX - H_OFFSET; // Horizontal position for the vertical segment
          lines.push( <path key={`l-${sourceMatch.id}`} d={`M ${sourceX} ${sourceY} L ${sourceX} ${dropY} L ${midX} ${dropY} L ${midX} ${targetY} L ${targetX} ${targetY}`} stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeDasharray="3,3" /> );
        }
      }
    });
    return lines;
  };


  return (
    <div ref={containerRef} className="challonge-bracket-viewer bg-slate-800/50 text-gray-200 p-2 sm:p-4 overflow-auto rounded-md" style={{width: '100%'}}>
      <svg ref={svgRef} width={canvasSize.width} height={canvasSize.height} style={{ minWidth: '100%', display: 'block', fontFamily: 'sans-serif' }}>
        {/* CSS for participant names within SVG text elements if needed for truncation */}
        <style jsx global>{`
          .participant-name {
            max-width: ${MATCH_WIDTH - 60}px; /* Adjust as needed */
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        `}</style>
        {renderConnectorLinesSVG()}
        {processedMatches.map(match => renderMatchSVG(match))}
      </svg>
    </div>
  );
};

export default DarkChallongeBracket;