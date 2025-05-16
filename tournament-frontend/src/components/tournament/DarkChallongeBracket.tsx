// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

// --- TypeScript Interfaces ---
interface Participant {
  id: string;
  participant_name: string;
  seed?: number;
  user_id?: string; 
}

type MatchStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE' | string;
type BracketType = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS' | null;

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
  status: MatchStatusType;
  bracket_type?: BracketType;
}

type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
type TournamentStatusType = 'DRAFT' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;

interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatusType; // Ensure parent passes this
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
  const HORIZONTAL_GAP_BETWEEN_ROUNDS = 70;
  const VERTICAL_MATCH_SPACING_BASE = 25;
  const SECTION_VERTICAL_GAP = 60;
  const PADDING = 40;

  const participantsMap = React.useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const getSlotDisplayName = useCallback((
    currentMatch: UIExtendedMatch,
    slotKey: 'participant1' | 'participant2',
    allProcessedMatches: UIExtendedMatch[],
  ): string => {
    const participantIdField = slotKey === 'participant1' ? 'participant1_id' : 'participant2_id';
    const prereqMatchIdField = slotKey === 'participant1' ? 'participant1_prereq_match_id' : 'participant2_prereq_match_id';
    
    const participantId = currentMatch[participantIdField];
    const prereqMatchId = currentMatch[prereqMatchIdField];

    if (participantId) {
      const participant = participantsMap.get(participantId);
      const isWinnerSlotOfBye = currentMatch.status === 'BYE' && currentMatch.winner_id === participantId;
      
      if (currentMatch.status === 'BYE') {
        return isWinnerSlotOfBye ? (participant?.participant_name || 'BYE Winner') : 'BYE';
      }
      return participant?.participant_name || 'Player ID Err';
    }

    if (prereqMatchId) {
      const prereqMatch = allProcessedMatches.find(m => m.id === prereqMatchId);
      if (prereqMatch) {
        let prefix = "W of";
        let sourceIndicator = `M${prereqMatch.match_number}`;
        if (prereqMatch.ui_bracket_section !== 'WINNERS') {
          sourceIndicator += ` (${prereqMatch.ui_bracket_section.substring(0,1)})`;
        }
        return `${prefix} ${sourceIndicator}`;
      }
      return 'Src M?';
    }
    return 'TBD';
  }, [participantsMap]);
  
  useEffect(() => {
    if (!apiMatches) { 
      setProcessedMatches([]); return;
    }
    if (apiMatches.length === 0) {
      setProcessedMatches([]); return;
    }

    const pass1Matches: UIExtendedMatch[] = apiMatches.map(m => {
      let ui_section: UIExtendedMatch['ui_bracket_section'] = 'WINNERS';
      if (tournament.format === 'DOUBLE_ELIMINATION') {
        if (m.bracket_type === 'LOSERS') ui_section = 'LOSERS';
        else if (m.bracket_type === 'GRAND_FINALS') ui_section = 'GRAND_FINALS';
      }
      return {
        ...m,
        ui_bracket_section: ui_section,
        ui_participant1_name: '', ui_participant2_name: '',
        ui_participant1_seed: m.participant1_id ? participantsMap.get(m.participant1_id)?.seed : undefined,
        ui_participant2_seed: m.participant2_id ? participantsMap.get(m.participant2_id)?.seed : undefined,
      };
    });

    const pass2Matches = pass1Matches.map(m => ({
      ...m,
      ui_participant1_name: getSlotDisplayName(m, 'participant1', pass1Matches),
      ui_participant2_name: getSlotDisplayName(m, 'participant2', pass1Matches),
    }));
    
    setProcessedMatches(pass2Matches);
  }, [apiMatches, participantsMap, tournament.format, getSlotDisplayName]);


  useEffect(() => {
    if (processedMatches.length === 0) {
      setMatchPositions({});
      setCanvasSize({ width: PADDING * 2, height: PADDING * 2 });
      return;
    }
    const newPositions: Record<string, { x: number; y: number }> = {};
    let overallMaxX = 0;
    let overallMaxY = 0;

    const layoutSection = (sectionMatches: UIExtendedMatch[], initialY: number): { sectionMaxY: number, sectionMaxX: number } => {
      if (sectionMatches.length === 0) return { sectionMaxY: initialY, sectionMaxX: PADDING };
      let currentSectionMaxY = initialY;
      let currentSectionMaxX = PADDING;
      const rounds = [...new Set(sectionMatches.map(m => m.round))].sort((a, b) => a - b);
      const roundData: Record<number, { yPositions: number[]; x: number; matchesInRound: UIExtendedMatch[] }> = {};

      rounds.forEach((roundNum, roundIndex) => {
        const matchesInThisRound = sectionMatches.filter(m => m.round === roundNum).sort((a, b) => a.match_number - b.match_number);
        const roundX = PADDING + roundIndex * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
        currentSectionMaxX = Math.max(currentSectionMaxX, roundX + MATCH_WIDTH);
        roundData[roundNum] = { yPositions: [], x: roundX, matchesInRound: matchesInThisRound };

        matchesInThisRound.forEach((match, indexInRound) => {
          let matchY: number;
          if (roundIndex === 0) {
            matchY = initialY + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
          } else {
            const feederMatchIDs = new Set<string>();
            if(match.participant1_prereq_match_id) feederMatchIDs.add(match.participant1_prereq_match_id);
            if(match.participant2_prereq_match_id) feederMatchIDs.add(match.participant2_prereq_match_id);
            
            const feederMatches = Array.from(feederMatchIDs).map(id => processedMatches.find(pm => pm.id === id)).filter(Boolean) as UIExtendedMatch[];

            if (feederMatches.length > 0) {
              let totalFeederCenterY = 0;
              let validFeeders = 0;
              feederMatches.forEach(fm => {
                if (newPositions[fm.id]) {
                  totalFeederCenterY += (newPositions[fm.id].y + MATCH_HEIGHT / 2);
                  validFeeders++;
                }
              });
              matchY = validFeeders > 0 ? (totalFeederCenterY / validFeeders) - MATCH_HEIGHT / 2 : (roundData[rounds[roundIndex - 1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
            } else {
              matchY = (roundData[rounds[roundIndex - 1]]?.yPositions[0] || initialY) + indexInRound * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE * 2);
            }
          }
          if (indexInRound > 0) {
            const prevMatchId = matchesInThisRound[indexInRound - 1].id;
            if (newPositions[prevMatchId]) {
                matchY = Math.max(matchY, newPositions[prevMatchId].y + MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
            }
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
    const losersMatches = tournament.format === 'DOUBLE_ELIMINATION' ? processedMatches.filter(m => m.ui_bracket_section === 'LOSERS') : [];
    const grandFinalsMatches = processedMatches.filter(m => m.ui_bracket_section === 'GRAND_FINALS').sort((a, b) => a.round - b.round || a.match_number - b.match_number);

    const { sectionMaxY: winnersMaxY, sectionMaxX: winnersMaxX } = layoutSection(winnersMatches, currentGlobalYOffset);
    overallMaxX = Math.max(overallMaxX, winnersMaxX);
    overallMaxY = Math.max(overallMaxY, winnersMaxY);
    currentGlobalYOffset = winnersMaxY + (winnersMatches.length > 0 && (losersMatches.length > 0 || grandFinalsMatches.length > 0) ? SECTION_VERTICAL_GAP : 0);

    if (losersMatches.length > 0) {
      const { sectionMaxY: losersMaxY, sectionMaxX: losersMaxX } = layoutSection(losersMatches, currentGlobalYOffset);
      overallMaxX = Math.max(overallMaxX, losersMaxX);
      overallMaxY = Math.max(overallMaxY, losersMaxY);
      currentGlobalYOffset = losersMaxY + (losersMatches.length > 0 && grandFinalsMatches.length > 0 ? SECTION_VERTICAL_GAP : 0);
    }

    if (grandFinalsMatches.length > 0) {
      let lastMainBracketRoundIndex = -1;
      if (winnersMatches.length > 0) lastMainBracketRoundIndex = Math.max(0, ...winnersMatches.map(m => m.round));
      if (losersMatches.length > 0) lastMainBracketRoundIndex = Math.max(lastMainBracketRoundIndex, ...losersMatches.map(m => m.round));

      let referenceYCenter = overallMaxY / 2;
      const lastWinnersRoundMatches = winnersMatches.filter(m => m.round === lastMainBracketRoundIndex && m.next_match_id === null); // True final means no next match in WB
      const lastLosersRoundMatches = losersMatches.filter(m => m.round === lastMainBracketRoundIndex && m.next_match_id === null); // True final means no next match in LB


      let anchorY: number | null = null;
      if (lastWinnersRoundMatches.length > 0 && newPositions[lastWinnersRoundMatches[0].id]) {
          anchorY = newPositions[lastWinnersRoundMatches[0].id].y + MATCH_HEIGHT / 2;
      } else if (lastLosersRoundMatches.length > 0 && newPositions[lastLosersRoundMatches[0].id]) { // Use LB final if WB final isn't definitive (e.g. small DE)
          anchorY = newPositions[lastLosersRoundMatches[0].id].y + MATCH_HEIGHT / 2;
      }
      if(anchorY !== null) referenceYCenter = anchorY;
      
      const totalGfHeight = grandFinalsMatches.length * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE) - VERTICAL_MATCH_SPACING_BASE;
      let gfStartY = referenceYCenter - totalGfHeight / 2;
      gfStartY = Math.max(PADDING, gfStartY, currentGlobalYOffset);

      grandFinalsMatches.forEach((gfMatch, index) => {
        const gfRoundX = PADDING + (lastMainBracketRoundIndex + 1 + index) * (MATCH_WIDTH + HORIZONTAL_GAP_BETWEEN_ROUNDS);
        const yPos = gfStartY + index * (MATCH_HEIGHT + VERTICAL_MATCH_SPACING_BASE);
        newPositions[gfMatch.id] = { x: gfRoundX, y: yPos };
        overallMaxX = Math.max(overallMaxX, gfRoundX + MATCH_WIDTH);
        overallMaxY = Math.max(overallMaxY, yPos + MATCH_HEIGHT);
      });
    }

    setMatchPositions(newPositions);
    setCanvasSize({
      width: Math.max(containerRef.current?.clientWidth || 800, overallMaxX + PADDING),
      height: Math.max(600, overallMaxY + PADDING),
    });
  }, [processedMatches, tournament.format]); // Simplified dependency array


  const renderMatchSVG = (match: UIExtendedMatch) => { 
    const pos = matchPositions[match.id];
    if (!pos) return null;

    const isBeingEdited = inlineEditingMatchId === match.id;
    const canEdit = match.status !== 'COMPLETED' && match.status !== 'BYE' && !!match.participant1_id && !!match.participant2_id;
    const editModeActive = isBeingEdited && inlineScores && onInlineScoreChange && onInlineScoreSubmit && onCancelInlineEdit;

    const p1Name = match.ui_participant1_name;
    const p2Name = match.ui_participant2_name;
    const p1Seed = match.ui_participant1_seed;
    const p2Seed = match.ui_participant2_seed;

    const nameFontSize = "11px";
    const nameContainerWidth = MATCH_WIDTH - 60;

    if (editModeActive) {
      return (
        <g key={`${match.id}-edit`} transform={`translate(${pos.x}, ${pos.y})`}>
            <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="4" ry="4" fill="#3b4a60" stroke="#6366f1" strokeWidth="2"/>
            <foreignObject x="5" y="2" width={nameContainerWidth} height={PLAYER_SLOT_HEIGHT - 4}>
                <div title={p1Name} className="text-slate-50 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23px] font-medium" style={{fontSize: nameFontSize}}>{p1Name}</div>
            </foreignObject>
            <foreignObject x={MATCH_WIDTH - 65} y="3" width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                <input type="number" min="0" autoFocus value={inlineScores!.p1} onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p1: e.target.value })}
                    className="w-full h-full text-center bg-slate-700 text-slate-50 border border-slate-500 rounded text-xs p-0.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </foreignObject>
            <line x1="5" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH - 5} y2={PLAYER_SLOT_HEIGHT} stroke="#4b5563" strokeWidth="0.5"/>
            <foreignObject x="5" y={PLAYER_SLOT_HEIGHT + 2} width={nameContainerWidth} height={PLAYER_SLOT_HEIGHT - 4}>
                <div title={p2Name} className="text-slate-50 text-xs whitespace-nowrap overflow-hidden text-ellipsis leading-[23px] font-medium" style={{fontSize: nameFontSize}}>{p2Name}</div>
            </foreignObject>
            <foreignObject x={MATCH_WIDTH - 65} y={PLAYER_SLOT_HEIGHT + 3} width="55" height={PLAYER_SLOT_HEIGHT - 6}>
                <input type="number" min="0" value={inlineScores!.p2} onChange={(e) => onInlineScoreChange!({ ...inlineScores!, p2: e.target.value })}
                    className="w-full h-full text-center bg-slate-700 text-slate-50 border border-slate-500 rounded text-xs p-0.5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" />
            </foreignObject>
            <foreignObject x={MATCH_WIDTH - 70} y={-18} width="65" height="16">
                <div className="flex justify-end items-center gap-1.5 h-full">
                    <button onClick={onCancelInlineEdit} title="Cancel Edit" className="p-1 bg-slate-600 hover:bg-slate-500 rounded-full border-none cursor-pointer"> <XCircleIcon className="w-3.5 h-3.5 text-slate-300 hover:text-white"/> </button>
                    <button onClick={onInlineScoreSubmit} title="Save Score" className="p-1 bg-green-600 hover:bg-green-500 rounded-full border-none cursor-pointer"> <CheckCircleIcon className="w-3.5 h-3.5 text-white"/> </button>
                </div>
            </foreignObject>
            <text x={MATCH_WIDTH / 2} y={-8} textAnchor="middle" fontSize="9.5px" fill="#a0aec0" fontWeight="500">
                M{match.match_number} {match.ui_bracket_section !== 'WINNERS' && `(${match.ui_bracket_section.charAt(0)})`}
            </text>
        </g>
      );
    }

    const p1Score = match.score_participant1 !== null ? String(match.score_participant1) : (match.status === 'BYE' && match.winner_id === match.participant1_id ? 'W' : '-');
    const p2Score = match.score_participant2 !== null ? String(match.score_participant2) : (match.status === 'BYE' && match.winner_id === match.participant2_id ? 'W' : '-');
    const isP1Winner = match.status === 'COMPLETED' && match.winner_id === match.participant1_id && !!match.participant1_id;
    const isP2Winner = match.status === 'COMPLETED' && match.winner_id === match.participant2_id && !!match.participant2_id;
    const isDraw = match.status === 'COMPLETED' && match.winner_id === null;
    
    const baseRectFill = (match.status === 'PENDING' || match.status === 'IN_PROGRESS') ? "#2d3748" : "#1f2937";
    const winnerRectFill = "#166534"; 
    const drawRectFill = "#78350f"; 

    const rectFill = isDraw ? drawRectFill : (isP1Winner || isP2Winner ? winnerRectFill : baseRectFill) ;

    const getPlayerColor = (isWinner: boolean, isParticipantPopulated: boolean, isSlotBye: boolean) => {
        if (isSlotBye) return "#a1a1aa"; 
        if (!isParticipantPopulated) return "#6b7280";
        return isWinner ? "#d1fae5" : "#cbd5e1";
    };
    const getScoreColor = (isWinner: boolean, isParticipantPopulated: boolean) => {
       if(!isParticipantPopulated) return "#6b7280";
       return isWinner ? "#f0fdf4" : "#e2e8f0";
    };

    const isP1Bye = p1Name === 'BYE';
    const isP2Bye = p2Name === 'BYE';

    return (
      <g key={match.id} transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => { if (canEdit && onMatchClick) onMatchClick(match); }}
        style={{ cursor: (canEdit && onMatchClick) ? 'pointer' : 'default' }}
        className={`match-group transition-all duration-150 ease-in-out ${canEdit && onMatchClick ? 'group hover:brightness-125' : ''}`} >
        <rect x="0" y="0" width={MATCH_WIDTH} height={MATCH_HEIGHT} rx="4" ry="4"
              fill={rectFill}
              stroke={ (isP1Winner || isP2Winner) ? "#22c55e" : (isDraw ? "#f59e0b" : "#4b5563") }
              strokeWidth="1.5"
              className="group-hover:stroke-indigo-500"/>

        {p1Seed != null && <text x="8" y={PLAYER_SLOT_HEIGHT * 0.5} dominantBaseline="middle" fontSize="9px" fill="#a1a1aa">{p1Seed}</text>}
        <text x={p1Seed != null ? 22 : 10} y={PLAYER_SLOT_HEIGHT * 0.5} dominantBaseline="middle"
              fontSize={nameFontSize} fill={getPlayerColor(isP1Winner, !!match.participant1_id, isP1Bye)} fontWeight={isP1Winner ? "600" : "500"}
              className="participant-name" textLength={nameContainerWidth - (p1Seed ? 14:2) -5} lengthAdjust="spacingAndGlyphs">
                <title>{p1Name}</title>{p1Name}
        </text>
        <text x={MATCH_WIDTH - 12} y={PLAYER_SLOT_HEIGHT * 0.5} dominantBaseline="middle" textAnchor="end" fontSize="11px"
              fill={getScoreColor(isP1Winner, !!match.participant1_id)} fontWeight={isP1Winner ? "bold" : "normal"}>{p1Score}</text>

        <line x1="0" y1={PLAYER_SLOT_HEIGHT} x2={MATCH_WIDTH} y2={PLAYER_SLOT_HEIGHT} stroke="#4b5563" strokeWidth="1"/>

        {p2Seed != null && <text x="8" y={PLAYER_SLOT_HEIGHT * 1.5} dominantBaseline="middle" fontSize="9px" fill="#a1a1aa">{p2Seed}</text>}
        <text x={p2Seed != null ? 22 : 10} y={PLAYER_SLOT_HEIGHT * 1.5} dominantBaseline="middle"
              fontSize={nameFontSize} fill={getPlayerColor(isP2Winner, !!match.participant2_id, isP2Bye)} fontWeight={isP2Winner ? "600" : "500"}
              className="participant-name" textLength={nameContainerWidth - (p2Seed ? 14:2) -5} lengthAdjust="spacingAndGlyphs">
                <title>{p2Name}</title>{p2Name}
        </text>
        <text x={MATCH_WIDTH - 12} y={PLAYER_SLOT_HEIGHT * 1.5} dominantBaseline="middle" textAnchor="end" fontSize="11px"
              fill={getScoreColor(isP2Winner, !!match.participant2_id)} fontWeight={isP2Winner ? "bold" : "normal"}>{p2Score}</text>

        <text x={MATCH_WIDTH / 2} y={-10} textAnchor="middle" fontSize="9.5px" fill="#94a3b8" fontWeight="500">
            M{match.match_number} {match.ui_bracket_section !== 'WINNERS' && `(${match.ui_bracket_section.charAt(0)})`}
        </text>

        {canEdit && onMatchClick && (
            <foreignObject x={MATCH_WIDTH - 26} y={(PLAYER_SLOT_HEIGHT - 19)/2 + 0.5} width="19" height="19">
                <PencilSquareIcon className="w-full h-full text-indigo-400 group-hover:text-indigo-300 opacity-70 group-hover:opacity-100 transition-all"/>
            </foreignObject>
        )}
        {match.status === 'COMPLETED' && !canEdit && (
            <foreignObject x={MATCH_WIDTH - 26} y={(PLAYER_SLOT_HEIGHT - 19)/2 + 0.5} width="19" height="19">
                 <CheckCircleIcon className={`w-full h-full ${isDraw ? 'text-yellow-400' : 'text-green-400'}`}/>
            </foreignObject>
        )}
      </g>
    );
  };
  
  const renderConnectorLinesSVG = () => {
    const lines: React.ReactNode[] = [];
    const H_LINE_SEGMENT = HORIZONTAL_GAP_BETWEEN_ROUNDS / 2;
    processedMatches.forEach(sourceMatch => {
      const sourcePos = matchPositions[sourceMatch.id];
      if (!sourcePos) return;
      if (sourceMatch.next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const sourceX = sourcePos.x + MATCH_WIDTH;
          const sourceY = sourcePos.y + PLAYER_SLOT_HEIGHT / 2;
          const targetX = targetPos.x;
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2; 
          if (targetMatch.participant2_prereq_match_id === sourceMatch.id ||
             (targetMatch.participant1_prereq_match_id !== sourceMatch.id && targetMatch.participant2_id === null /* Removed complex winner check as backend advances winner directly */)) {
              targetY = targetPos.y + PLAYER_SLOT_HEIGHT * 1.5;
          }
          lines.push( <path key={`w-${sourceMatch.id}`} d={`M ${sourceX} ${sourceY} H ${sourceX + H_LINE_SEGMENT} V ${targetY} H ${targetX}`} stroke="#4b5563" strokeWidth="1.5" fill="none" /> );
        }
      }
      if (tournament.format === 'DOUBLE_ELIMINATION' && sourceMatch.loser_next_match_id) {
        const targetMatch = processedMatches.find(m => m.id === sourceMatch.loser_next_match_id);
        const targetPos = targetMatch ? matchPositions[targetMatch.id] : null;
        if (targetMatch && targetPos) {
          const sourceX = sourcePos.x + MATCH_WIDTH / 2; 
          const sourceY = sourcePos.y + MATCH_HEIGHT;    
          let targetY = targetPos.y + PLAYER_SLOT_HEIGHT / 2;
           if (targetMatch.participant2_prereq_match_id === sourceMatch.id || 
             (targetMatch.participant1_prereq_match_id !== sourceMatch.id && targetMatch.participant2_id === null /* Removed complex loser check */ )) {
              targetY = targetPos.y + PLAYER_SLOT_HEIGHT * 1.5;
          }
          const controlY1 = sourceY + Math.max(15, SECTION_VERTICAL_GAP / 3.5);
          lines.push( <path key={`l-${sourceMatch.id}`} d={`M ${sourceX} ${sourceY} V ${controlY1} H ${targetPos.x - H_LINE_SEGMENT} V ${targetY} H ${targetPos.x}`} stroke="#7c3aed" strokeWidth="1.5" fill="none" strokeDasharray="3.5,3.5" /> );
        }
      }
    });
    return lines;
   };

  const showPlaceholder = 
    (!apiMatches || apiMatches.length === 0) && 
    processedMatches.length === 0;


  return (
    <div 
        ref={containerRef} 
        className="challonge-bracket-viewer dark-theme bg-slate-800/70 text-gray-200 p-2 sm:p-4 overflow-auto rounded-lg shadow-inner border border-slate-700/60" 
        style={{width: '100%', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale'}}
    >
      <svg 
        ref={svgRef} 
        width={canvasSize.width} 
        height={canvasSize.height} 
        style={{ 
            minWidth: canvasSize.width,
            display: 'block', 
            fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"' 
        }}
      >
        <style jsx global>{`
          .challonge-bracket-viewer.dark-theme .participant-name { }
          .match-group { }
        `}</style>
        {Object.keys(matchPositions).length > 0 && renderConnectorLinesSVG()}
        {processedMatches.map(match => (matchPositions[match.id] ? renderMatchSVG(match) : null))}
      </svg>
      
      {showPlaceholder && (
        <div className="flex justify-center items-center text-slate-400 italic py-10" style={{minHeight: Math.min(200, canvasSize.height - (PADDING*2)) || 150 }}>
           { (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && participants.length < 2 ? 
             "Awaiting more participants..." : 
             (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') ?
             `Tournament is ${tournament.status.toLowerCase()}.` :
             "Bracket not generated or no matches available."
           }
        </div>
      )}
    </div>
  );
};

export default DarkChallongeBracket;