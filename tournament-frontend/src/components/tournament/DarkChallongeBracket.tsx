// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

// --- Interfaces (Participant, Match, Tournament, UIExtendedMatch) ---
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
  matches: Match[]; // Raw matches from API, expected to include prereq_match_ids
  participants: Participant[];
  onMatchClick?: (match: UIExtendedMatch) => void;
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

  const MATCH_WIDTH = 190;
  const MATCH_HEIGHT = 60;
  const PLAYER_SLOT_HEIGHT = MATCH_HEIGHT / 2;
  const HORIZONTAL_GAP_BETWEEN_ROUNDS = 80;
  const VERTICAL_MATCH_SPACING_BASE = 20;
  const SECTION_VERTICAL_GAP = 50;
  const PADDING = 30;

  const participantsMap = React.useMemo(() => {
    return new Map(participants.map(p => [p.id, p]));
  }, [participants]);

  const getSlotDisplayName = (
    currentMatch: Match, // The match whose slot name is being determined
    slotKey: 'participant1' | 'participant2', // Which slot: 'participant1' or 'participant2'
    allMatches: Match[], 
  ): string => {
    const participantId = currentMatch[slotKey === 'participant1' ? 'participant1_id' : 'participant2_id'];
    const prereqMatchId = currentMatch[slotKey === 'participant1' ? 'participant1_prereq_match_id' : 'participant2_prereq_match_id'];

    if (participantId) {
      return participantsMap.get(participantId)?.participant_name || 'Unknown Player';
    }

    if (prereqMatchId) {
      const prereqMatch = allMatches.find(m => m.id === prereqMatchId);
      if (prereqMatch) {
        let prefix = "W of"; // Default to winner
        let bracketIndicator = "";

        if (prereqMatch.bracket_type && prereqMatch.bracket_type !== 'WINNERS') {
            bracketIndicator = ` ${prereqMatch.bracket_type.substring(0,1)}B`; // e.g., LB for Losers Bracket
        }

        // Heuristic for Double Elimination:
        // If current match is in Losers Bracket AND the prereq match is from Winners Bracket,
        // then it's the Loser from that Winners Bracket match.
        if (currentMatch.bracket_type === 'LOSERS' && prereqMatch.bracket_type === 'WINNERS') {
            // This specific slot in the LB match is fed by the loser of the WB match
            // This logic needs to be precise based on how prereq_match_ids are set by backend for P1 vs P2 slots in LB.
            // Example: WB1 losers feed LB1. One slot of LB1 gets loser of WB M1, other slot of LB1 gets loser of WB M2.
             prefix = "L of";
             bracketIndicator = ` ${prereqMatch.bracket_type.substring(0,1)}B`; // Indicate WB explicitly
        }
        // If current match is Losers and prereq is Losers, then it's Winner of that Losers match.
        // (already handled by default prefix "W of")

        return `${prefix} M${prereqMatch.match_number}${bracketIndicator}`;
      }
      return 'Src Unk'; // Source Unknown
    }
    return 'TBD';
  };


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
            ui_participant1_name: getSlotDisplayName(m, 'participant1', apiMatches),
            ui_participant2_name: getSlotDisplayName(m, 'participant2', apiMatches),
            ui_participant1_seed: m.participant1_id ? participantsMap.get(m.participant1_id)?.seed : undefined,
            ui_participant2_seed: m.participant2_id ? participantsMap.get(m.participant2_id)?.seed : undefined,
        };
    });
    setProcessedMatches(extended);
  }, [apiMatches, participantsMap, tournament.format]);


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
      isLosersBracketLayout: boolean = false // More descriptive name
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

          if (roundIndex === 0) { // First round of this specific section
            matchY = initialY + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
          } else {
            const feederMatches = processedMatches.filter(
              fm => fm.next_match_id === match.id || (isLosersBracketLayout && fm.loser_next_match_id === match.id)
            );
            if (feederMatches.length > 0) {
              let totalFeederCenterY = 0;
              let validFeeders = 0;
              feederMatches.forEach(fm => {
                if (newPositions[fm.id]) { // Check if feeder is already positioned
                  totalFeederCenterY += (newPositions[fm.id].y + MATCH_HEIGHT / 2);
                  validFeeders++;
                }
              });
              if (validFeeders > 0) {
                 matchY = (totalFeederCenterY / validFeeders) - MATCH_HEIGHT / 2;
              } else {
                // Fallback if feeders not positioned (less likely with sorted round processing within section)
                matchY = (roundData[rounds[roundIndex-1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
              }
            } else { // No direct feeders for this match (e.g., byes advancing, or first match in a later round of losers)
               matchY = (roundData[rounds[roundIndex-1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
            }
          }
          // Prevent overlap within the same round after initial calculation
          if (indexInRound > 0) {
            const prevMatchInThisRoundId = matchesInThisRound[indexInRound - 1].id;
            const minRequiredY = newPositions[prevMatchInThisRoundId].y + MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE;
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
        const lastWinnerRoundMatch = winnersMatches
            .filter(m => m.round === Math.max(0, ...winnersMatches.map(wm => wm.round)))
            .sort((a,b) => a.match_number - b.match_number)
            .pop();

        let gfRoundXBase = PADDING;
        if(lastWinnerRoundMatch && newPositions[lastWinnerRoundMatch.id]){
            gfRoundXBase = newPositions[lastWinnerRoundMatch.id].x;
        } else if (losersMatches.length > 0 && tournament.format === 'DOUBLE_ELIMINATION') { // Check DE for Losers final position
            const lastLoserRoundMatch = losersMatches
                .filter(m => m.round === Math.max(0, ...losersMatches.map(lm => lm.round)))
                .sort((a,b) => a.match_number - b.match_number)
                .pop();
            if(lastLoserRoundMatch && newPositions[lastLoserRoundMatch.id]) {
                gfRoundXBase = newPositions[lastLoserRoundMatch.id].x;
            }
        }
        // If neither winner nor loser final round has a match, place GF further right than the largest existing X
        else if (overallMaxX > PADDING) {
             gfRoundXBase = overallMaxX - PADDING - MATCH_WIDTH - HORIZONTAL_GAP_BETWEEN_ROUNDS; // back off a bit
        }


        let gfRoundX = gfRoundXBase + MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS;
        if (grandFinalsMatches.length === 1 && winnersMatches.length === 0 && losersMatches.length === 0) { // e.g. 2 participants only for DE
            gfRoundX = PADDING + (0) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS); // Treat as first round
        }


      overallMaxX = Math.max(overallMaxX, gfRoundX + MATCH_WIDTH);
      let gfStartY = PADDING;
      // Vertically center GF relative to winner's final, if possible
      if (lastWinnerRoundMatch && newPositions[lastWinnerRoundMatch.id]) {
           const totalGfHeight = grandFinalsMatches.length * MATCH_HEIGHT + (grandFinalsMatches.length - 1) * VERTICAL_MATCH_SPACING_BASE;
           gfStartY = newPositions[lastWinnerRoundMatch.id].y + (MATCH_HEIGHT / 2) - (totalGfHeight / 2);
           gfStartY = Math.max(PADDING, gfStartY); // Ensure it doesn't go above canvas
      } else { // Fallback: place after other content
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
  }, [processedMatches, tournament.format]);


  const renderMatchSVG = (match: UIExtendedMatch) => {
    const pos = matchPositions[match.id];
    if (!pos) return null;

    const isBeingEdited = inlineEditingMatchId === match.id;
    const canEditMatch = match.participant1_id && match.participant2_id && match.status !== 'COMPLETED';
    const editModeFullyEnabled = isBeingEdited && inlineScores && onInlineScoreChange && onInlineScoreSubmit && onCancelInlineEdit;

    const p1Name = match.ui_participant1_name; 
    const p2Name = match.ui_participant2_name;
    
    if (editModeFullyEnabled) {
        return (
            <g key={`${match.id}-edit`} transform={`translate(${pos.x}, ${pos.y})`}>
                <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" fill="#374151" stroke="#4f46e5" strokeWidth="2"/>
                <foreignObject x="5" y="2" width={MATCH_WIDTH - 75} height={PLAYER_SLOT_HEIGHT - 4}>
                    <div title={p1Name} className="text-slate-100 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23.5px] font-medium">{p1Name}</div>
                </foreignObject>
                <foreignObject x={MATCH_WIDTH - 65} y="3" width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                    <input type="number" min="0" autoFocus value={inlineScores!.p1} onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p1: e.target.value })}
                        className="w-full h-full text-center bg-slate-800 text-slate-50 border border-slate-600 rounded text-xs p-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                </foreignObject>
                <line x1="5" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH - 5} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" strokeWidth="0.5"/>
                <foreignObject x="5" y={PLAYER_SLOT_HEIGHT + 2} width={MATCH_WIDTH - 75} height={PLAYER_SLOT_HEIGHT - 4}>
                    <div title={p2Name} className="text-slate-100 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23.5px] font-medium">{p2Name}</div>
                </foreignObject>
                <foreignObject x={MATCH_WIDTH - 65} y={PLAYER_SLOT_HEIGHT + 3} width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                    <input type="number" min="0" value={inlineScores!.p2} onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p2: e.target.value })}
                        className="w-full h-full text-center bg-slate-800 text-slate-50 border border-slate-600 rounded text-xs p-0.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-400" />
                </foreignObject>
                 <foreignObject x={MATCH_WIDTH - 70} y={-15} width="60" height="16">
                    <div className="flex justify-end items-center gap-1.5 h-full">
                        <button onClick={onCancelInlineEdit} title="Cancel" className="p-0 bg-transparent border-none cursor-pointer"> <XCircleIcon className="w-4 h-4 text-slate-400 hover:text-slate-200"/> </button>
                        <button onClick={onInlineScoreSubmit} title="Save" className="p-0 bg-transparent border-none cursor-pointer"> <CheckCircleIcon className="w-4 h-4 text-green-400 hover:text-green-300"/> </button>
                    </div>
                </foreignObject>
                 <text x={MATCH_WIDTH / 2 - 25} y={-8} textAnchor="middle" fontSize="9" fill="#718096">
                    M{match.match_number} {match.ui_bracket_section !== 'WINNERS' ? `(${match.ui_bracket_section.substring(0,1)})` : ''}
                 </text>
            </g>
        );
    }

    const p1Seed = match.ui_participant1_seed;
    const p2Seed = match.ui_participant2_seed;
    const p1Score = match.score_participant1 ?? '-';
    const p2Score = match.score_participant2 ?? '-';
    const isP1Winner = match.winner_id === match.participant1_id && match.participant1_id !== null;
    const isP2Winner = match.winner_id === match.participant2_id && match.participant2_id !== null;
    const nameFontSize = (p1Name.includes(" of M") || p1Name === "TBD" || p2Name.includes(" of M") || p2Name === "TBD") ? "10px" : "12px";


    return (
      <g key={match.id} transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => {if (canEditMatch && onMatchClick) onMatchClick(match)}}
        style={{ cursor: (canEditMatch && onMatchClick) ? 'pointer' : 'default' }}
        className={`match-group transition-opacity ${ (canEditMatch && onMatchClick && !isBeingEdited) ? 'hover:opacity-80 hover:stroke-blue-400' : ''}`} >
        <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="3" ry="3" 
              fill={match.status === 'COMPLETED' ? "#1f2937" : "#2d3748" }
              stroke={isBeingEdited ? "#4f46e5" : (match.status === 'COMPLETED' ? (isP1Winner || isP2Winner ? "#16a34a" : "#4a5567") : "#4a5567")} // Brighter green
              strokeWidth={isBeingEdited? "2" : "1.5"}/>

        {p1Seed != null && (<text x="7" y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="9" fill="#9ca3af">{p1Seed}</text>)}
        <text x={p1Seed != null ? 20 : 8} y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" 
              fontSize={nameFontSize} fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"} 
              className="participant-name" title={p1Name}>{p1Name}</text>
        <text x={MATCH_WIDTH - ( (canEditMatch && match.status !== 'COMPLETED') || match.status === 'COMPLETED' ? 30 : 10)} 
              y={PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" 
              fill={isP1Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP1Winner ? "bold" : "normal"}>{p1Score}</text>

        <line x1="0" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH} y2={PLAYER_SLOT_HEIGHT} stroke="#4a5567" strokeWidth="1"/>

        {p2Seed != null && (<text x="7" y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" fontSize="9" fill="#9ca3af">{p2Seed}</text>)}
        <text x={p2Seed != null ? 20 : 8} y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" 
              fontSize={nameFontSize} fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"} 
              className="participant-name" title={p2Name}>{p2Name}</text>
        <text x={MATCH_WIDTH - ( (canEditMatch && match.status !== 'COMPLETED') || match.status === 'COMPLETED' ? 30 : 10)} 
              y={PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2} dominantBaseline="middle" textAnchor="end" fontSize="12" 
              fill={isP2Winner ? "#68d391" : "#e5e7eb"} fontWeight={isP2Winner ? "bold" : "normal"}>{p2Score}</text>
      
        <text x={MATCH_WIDTH / 2} y={-8} textAnchor="middle" fontSize="9.5" fill="#828f9f"> {/* Slightly larger match number text */}
            M{match.match_number} {match.ui_bracket_section !== 'WINNERS' ? `(${match.ui_bracket_section.substring(0,1)})` : ''}
        </text>

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
           else if (targetMatch.participant2_id === null && targetMatch.status === 'PENDING') targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2; // Fixed target_pos to targetPos
           else if (sourceMatch.loser_id && targetMatch.participant1_id === sourceMatch.loser_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           else if (sourceMatch.loser_id && targetMatch.participant2_id === sourceMatch.loser_id) targetY = targetPos.y + PLAYER_SLOT_HEIGHT + PLAYER_SLOT_HEIGHT / 2;

          const dropY = sourceY + Math.max(20, SECTION_VERTICAL_GAP / 3);
          const midX = targetX - H_OFFSET; 
          lines.push( <path key={`l-${sourceMatch.id}`} d={`M ${sourceX} ${sourceY} L ${sourceX} ${dropY} L ${midX} ${dropY} L ${midX} ${targetY} L ${targetX} ${targetY}`} stroke="#a78bfa" strokeWidth="1.5" fill="none" strokeDasharray="3,3" /> );
        }
      }
    });
    return lines;
  };

  return (
    <div ref={containerRef} className="challonge-bracket-viewer bg-slate-800/50 text-gray-200 p-2 sm:p-4 overflow-auto rounded-md" style={{width: '100%'}}>
      <svg ref={svgRef} width={canvasSize.width} height={canvasSize.height} style={{ minWidth: '100%', display: 'block', fontFamily: 'Inter, sans-serif' }}> {/* Added Inter font */}
        <style jsx global>{`
          .participant-name {
            // Styling for participant name if needed
          }
          .match-group:hover > rect:not(g[key*='-edit'] > rect) { /* Apply hover only if not in edit mode */
             /* fill: #334155; Example darker fill on hover */
          }

        `}</style>
        {renderConnectorLinesSVG()}
        {processedMatches.map(match => renderMatchSVG(match))}
      </svg>
    </div>
  );
};

export default DarkChallongeBracket;