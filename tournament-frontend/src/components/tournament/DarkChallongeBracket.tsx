// src/components/tournament/DarkChallongeBracket.tsx
'use client';

import React, { useEffect, useState, useRef, ReactNode, useCallback } from 'react';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// --- TypeScript Interfaces (Keep as is) ---
interface Participant {
  id: string;
  participant_name: string;
  seed?: number;
  user_id?: string;
}
type MatchStatusType = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BYE' | string;
type BracketTypeFromAPI = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS' | null;
interface MatchFromAPI {
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
  bracket_type?: BracketTypeFromAPI;
}
type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'ROUND_ROBIN' | 'SWISS';
type TournamentStatusType = 'DRAFT' | 'REGISTRATION' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatusType;
}
interface UIExtendedMatch extends MatchFromAPI {
  ui_round_display_number: number;
  ui_match_order_in_round: number;
  ui_bracket_section_code: 'W' | 'L' | 'GF';
  ui_participant1_name: string;
  ui_participant2_name: string;
  ui_participant1_seed?: number; // Keep seeds if you want to display them
  ui_participant2_seed?: number;
  ui_participant1_is_prereq: boolean;
  ui_participant2_is_prereq: boolean;
}
interface DarkChallongeBracketProps {
  tournament: Tournament;
  matches: MatchFromAPI[];
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
  const [hoverMatchId, setHoverMatchId] = useState<string | null>(null);
  const [roundCoordinates, setRoundCoordinates] = useState<Array<{round: number, x:number, y:number, title:string}>>([]);

  // --- Layout Constants ---
  const MATCH_BOX_WIDTH = 150; // Slightly reduced
  const MATCH_BOX_HEIGHT = 48; // Slightly reduced
  const SCORE_BOX_WIDTH = 28;
  const MATCH_TOTAL_WIDTH = MATCH_BOX_WIDTH + SCORE_BOX_WIDTH;
  const ROUND_GAP = 50; // Reduced gap
  const VERTICAL_MATCH_GAP = 12; // Reduced gap
  const PADDING = 25;
  const ROUND_TITLE_HEIGHT = 25;

  // --- Text Styling Constants ---
  const NAME_FONT_SIZE = "10px"; // Reduced font size
  const SCORE_FONT_SIZE = "9.5px"; // Reduced font size
  const SEED_FONT_SIZE = "8px";
  const ROUND_TITLE_FONT_SIZE = "11.5px";
  const PREREQ_FONT_SIZE = "9px"; // Reduced

  // Max width for participant names before attempting to fit with textLength
  // The effectiveness of textLength varies; true truncation might need foreignObject or JS.
  const PARTICIPANT_NAME_SVG_MAX_WIDTH = MATCH_BOX_WIDTH - 10; // Space for padding
  const PREREQ_NAME_SVG_MAX_WIDTH = MATCH_BOX_WIDTH - 8;


  const participantsMap = React.useMemo(() => new Map(participants.map(p => [p.id, p])), [participants]);

  const getSlotDisplayNameAndPrereq = useCallback((
    currentMatch: MatchFromAPI,
    slotKey: 'participant1' | 'participant2',
    allApiMatchesPassed: MatchFromAPI[],
  ): { name: string; isPrereq: boolean; seed?: number, id?: string | null } => { // Added seed and id
    const participantIdField = slotKey === 'participant1' ? 'participant1_id' : 'participant2_id';
    const prereqMatchIdField = slotKey === 'participant1' ? 'participant1_prereq_match_id' : 'participant2_prereq_match_id';

    const participantId = currentMatch[participantIdField];
    const prereqMatchId = currentMatch[prereqMatchIdField];

    if (participantId) {
      const participant = participantsMap.get(participantId);
      const details = {
          name: participant?.participant_name || 'Unknown',
          isPrereq: false,
          seed: participant?.seed,
          id: participantId
      };
      if (currentMatch.status === 'BYE') {
         details.name = participant?.participant_name || 'BYE'; // Winner of BYE shows name
      }
      return details;
    }

    if (prereqMatchId) {
      const prereqMatch = allApiMatchesPassed.find(m => m.id === prereqMatchId);
      if (prereqMatch) {
        let prefix = "W";
        if (currentMatch.bracket_type === 'LOSERS' && prereqMatch.bracket_type === 'WINNERS') {
          prefix = "L";
        }
        return { name: `${prefix} of M${prereqMatch.match_number}`, isPrereq: true, id: null };
      }
      return { name: 'Src ?', isPrereq: true, id: null };
    }
    return { name: 'TBD', isPrereq: false, id: null };
  }, [participantsMap]);


  useEffect(() => {
    // Process matches: unchanged from previous
    if (!apiMatches || apiMatches.length === 0) {
      setProcessedMatches([]); return;
    }
    const matchOrderInRoundCounter: Record<number, number> = {};
    const extendedMatches: UIExtendedMatch[] = apiMatches
        .slice().sort((a,b) => a.round - b.round || a.match_number - b.match_number)
        .map((m_api): UIExtendedMatch => {
            let ui_bracket_section_code: UIExtendedMatch['ui_bracket_section_code'] = 'W';
            if (tournament.format === 'DOUBLE_ELIMINATION') {
                if (m_api.bracket_type === 'LOSERS') ui_bracket_section_code = 'L';
                else if (m_api.bracket_type === 'GRAND_FINALS') ui_bracket_section_code = 'GF';
            } else if (m_api.bracket_type === 'GRAND_FINALS') { ui_bracket_section_code = 'GF'; }

            const p1Details = getSlotDisplayNameAndPrereq(m_api, 'participant1', apiMatches);
            const p2Details = getSlotDisplayNameAndPrereq(m_api, 'participant2', apiMatches);
            const displayRound = m_api.round;
            matchOrderInRoundCounter[displayRound] = (matchOrderInRoundCounter[displayRound] || 0) + 1;

            return {
                ...m_api,
                ui_round_display_number: displayRound,
                ui_match_order_in_round: matchOrderInRoundCounter[displayRound],
                ui_bracket_section_code,
                ui_participant1_name: p1Details.name,
                ui_participant2_name: p2Details.name,
                ui_participant1_seed: p1Details.seed,
                ui_participant2_seed: p2Details.seed,
                ui_participant1_is_prereq: p1Details.isPrereq,
                ui_participant2_is_prereq: p2Details.isPrereq,
            };
    });
    setProcessedMatches(extendedMatches);
  }, [apiMatches, participantsMap, tournament.format, getSlotDisplayNameAndPrereq]);

 useEffect(() => {
    // Layouting: unchanged from previous
     if (processedMatches.length === 0) {
      setMatchPositions({}); setRoundCoordinates([]);
      setCanvasSize({ width: PADDING * 2 + MATCH_TOTAL_WIDTH, height: PADDING * 2 + ROUND_TITLE_HEIGHT + MATCH_BOX_HEIGHT });
      return;
    }
    const newPositions: Record<string, { x: number; y: number }> = {};
    const newRoundCoordinates: Array<{round: number, x:number, y:number, title:string}> = [];
    let overallMaxX = 0; let overallMaxY = ROUND_TITLE_HEIGHT + PADDING;
    const matchesByDisplayRound: Record<number, UIExtendedMatch[]> = {};
    processedMatches.forEach(match => {
      if (!matchesByDisplayRound[match.ui_round_display_number]) matchesByDisplayRound[match.ui_round_display_number] = [];
      matchesByDisplayRound[match.ui_round_display_number].push(match);
    });
    const sortedDisplayRounds = Object.keys(matchesByDisplayRound).map(Number).sort((a, b) => a - b);
    sortedDisplayRounds.forEach((roundNum, roundIndex) => {
      const matchesInThisRound = matchesByDisplayRound[roundNum].sort((a,b) => a.ui_match_order_in_round - b.ui_match_order_in_round);
      const roundX = PADDING + roundIndex * (MATCH_TOTAL_WIDTH + ROUND_GAP);
      let roundTitle = `Round ${roundNum}`;
      const isFinalVisual = roundIndex === sortedDisplayRounds.length - 1;
      const isSemiFinalVisual = roundIndex === sortedDisplayRounds.length - 2;
      if (matchesInThisRound.every(m => m.ui_bracket_section_code === 'GF')) { roundTitle = "Grand Final";
        if (matchesInThisRound.length > 1 && roundIndex > 0 ) {
          const prevRoundNum = sortedDisplayRounds[roundIndex-1];
          if (prevRoundNum !== undefined && matchesByDisplayRound[prevRoundNum]?.[0]?.ui_bracket_section_code === 'GF') roundTitle = "GF Reset";
        }
      } else if (isFinalVisual && matchesInThisRound.length === 1 && tournament.format !== 'DOUBLE_ELIMINATION') roundTitle = "Final";
      else if (isSemiFinalVisual && matchesInThisRound.length <=2 && tournament.format !== 'DOUBLE_ELIMINATION' && !matchesInThisRound.some(m=>m.ui_bracket_section_code === 'L')) roundTitle = "Semifinals";
      newRoundCoordinates.push({ round: roundNum, x: roundX + MATCH_TOTAL_WIDTH / 2, y: PADDING + ROUND_TITLE_HEIGHT / 2 - 5, title: roundTitle });
      matchesInThisRound.forEach((match, matchIndexInRound) => {
        let matchY; const yBase = PADDING + ROUND_TITLE_HEIGHT;
        if (roundIndex === 0) matchY = yBase + matchIndexInRound * (MATCH_BOX_HEIGHT + VERTICAL_MATCH_GAP);
        else {
          let feederYSum = 0; let feederCount = 0;
          const addFeederY = (prereqId: string | null | undefined) => {
            if (prereqId) { const feeder = processedMatches.find(m=>m.id===prereqId);
              if (feeder && newPositions[feeder.id]) {
                let yOffset = MATCH_BOX_HEIGHT * 0.25;
                if (feeder.winner_id === feeder.participant2_id) yOffset = MATCH_BOX_HEIGHT * 0.75;
                else if (feeder.status!=='COMPLETED'&&feeder.status!=='BYE') yOffset = MATCH_BOX_HEIGHT*0.5;
                feederYSum += newPositions[feeder.id].y + yOffset; feederCount++;
              } } };
          addFeederY(match.participant1_prereq_match_id); addFeederY(match.participant2_prereq_match_id);
          matchY = feederCount>0 ? (feederYSum/feederCount)-(MATCH_BOX_HEIGHT/2) : yBase+matchIndexInRound*(MATCH_BOX_HEIGHT+VERTICAL_MATCH_GAP);
        }
        if (matchIndexInRound > 0) { const prevId = matchesInThisRound[matchIndexInRound-1].id;
          if (newPositions[prevId]) matchY = Math.max(matchY, newPositions[prevId].y+MATCH_BOX_HEIGHT+VERTICAL_MATCH_GAP); }
        newPositions[match.id]={x:roundX,y:matchY}; overallMaxY=Math.max(overallMaxY, matchY+MATCH_BOX_HEIGHT);
      });
      overallMaxX = Math.max(overallMaxX, roundX + MATCH_TOTAL_WIDTH);
    });
    setMatchPositions(newPositions); setRoundCoordinates(newRoundCoordinates);
    const calculatedHeight = overallMaxY + PADDING; const calculatedWidth = overallMaxX + PADDING;
    setCanvasSize({ width: Math.max(containerRef.current?.clientWidth||800, calculatedWidth), height: Math.max(containerRef.current?.clientHeight||600, calculatedHeight) });
  }, [processedMatches, tournament.format, PADDING, ROUND_TITLE_HEIGHT, MATCH_TOTAL_WIDTH, ROUND_GAP, MATCH_BOX_HEIGHT, VERTICAL_MATCH_GAP]);


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


    const p1ScoreText = match.score_participant1 !== null ? String(match.score_participant1) : '';
    const p2ScoreText = match.score_participant2 !== null ? String(match.score_participant2) : '';

    const isP1Winner = match.status === 'COMPLETED' && match.winner_id === match.participant1_id && !!match.participant1_id;
    const isP2Winner = match.status === 'COMPLETED' && match.winner_id === match.participant2_id && !!match.participant2_id;
    const isBye = match.status === 'BYE';

    // Aesthetic Colors for Participants (Default before win/loss)
    let p1DefaultColor = "fill-sky-200";   // Example: A light blue
    let p2DefaultColor = "fill-teal-200";  // Example: A light teal

    let p1NameColor = match.ui_participant1_is_prereq ? "fill-slate-400" : p1DefaultColor;
    let p2NameColor = match.ui_participant2_is_prereq ? "fill-slate-400" : p2DefaultColor;
    let p1ScoreColor = "fill-slate-300";
    let p2ScoreColor = "fill-slate-300";
    let p1NameWeight = "normal";
    let p2NameWeight = "normal";
    let boxFillClass = "fill-slate-700";

    if (match.status === 'COMPLETED') {
        boxFillClass = "fill-slate-750";
        if (isP1Winner) {
            p1NameColor = "fill-green-400"; p1NameWeight = "bold";
            p1ScoreColor = "fill-green-400";
            p2NameColor = "fill-slate-500";
        } else if (isP2Winner) {
            p2NameColor = "fill-green-400"; p2NameWeight = "bold";
            p2ScoreColor = "fill-green-400";
            p1NameColor = "fill-slate-500";
        }
    } else if (isBye) {
        boxFillClass = "fill-slate-700 opacity-80";
        if(match.winner_id === match.participant1_id && match.participant1_id) {
            p1NameColor = "fill-slate-300"; p1NameWeight="normal";
            p2NameColor = "fill-slate-600 opacity-60";
        }
        if(match.winner_id === match.participant2_id && match.participant2_id) {
            p2NameColor = "fill-slate-300"; p2NameWeight="normal";
            p1NameColor = "fill-slate-600 opacity-60";
        }
    }

    // For textYOffset, using the constant player slot height (MATCH_BOX_HEIGHT/2)
    // Then place text slightly above/below that center line of the slot
    const slotCenterY1 = MATCH_BOX_HEIGHT * 0.25;
    const slotCenterY2 = MATCH_BOX_HEIGHT * 0.75;

    // Helper to render participant slot
    const renderParticipantSlot = (
        yPos: number,
        name: string,
        seed: number | undefined,
        scoreText: string,
        isPrereq: boolean,
        nameColor: string,
        scoreColor: string,
        nameWeight: string,
        isWinnerSlot: boolean
    ) => (
        <>
            {seed !== undefined && !isPrereq && (
                 <text x={3} y={yPos} dominantBaseline="middle" fontSize={SEED_FONT_SIZE} className="fill-slate-500 select-none">
                    {seed}
                </text>
            )}
            <text
                x={seed !== undefined && !isPrereq ? 12 : 5} // Adjust X based on seed presence
                y={yPos}
                dominantBaseline="middle"
                fontSize={isPrereq ? PREREQ_FONT_SIZE : NAME_FONT_SIZE}
                className={nameColor}
                fontWeight={nameWeight}
                // Using textLength and lengthAdjust might be too aggressive for very short boxes.
                // Alternative: CSS ellipsis via foreignObject, or manual truncation.
                // For now, direct rendering. You might need to add tooltips.
            >
                <title>{name}</title>
                {name}
            </text>
            {!isPrereq && ( // Scores only for actual participants
                <text x={MATCH_BOX_WIDTH -3 } y={yPos} textAnchor="end" dominantBaseline="middle" fontSize={SCORE_FONT_SIZE} className={scoreColor} fontWeight={isWinnerSlot ? "bold" : "normal"}>
                    {scoreText}
                </text>
            )}
        </>
    );


    if (editModeActive && inlineScores && onInlineScoreChange && onCancelInlineEdit && onInlineScoreSubmit) {
       return (
        <g key={`${match.id}-edit`} transform={`translate(${pos.x}, ${pos.y})`}>
            {/* Box for names */}
            <rect x="0" y="0" width={MATCH_BOX_WIDTH} height={MATCH_BOX_HEIGHT} rx="2" ry="2" className="fill-slate-600 stroke-indigo-400" strokeWidth="1.5" />
            <line x1="0" y1={MATCH_BOX_HEIGHT / 2} x2={MATCH_BOX_WIDTH} y2={MATCH_BOX_HEIGHT / 2} className="stroke-slate-500" strokeWidth="0.5" />
            {/* P1 Name (non-editable) */}
             <text x="5" y={slotCenterY1} dominantBaseline="middle" fontSize={NAME_FONT_SIZE} className="fill-slate-100" fontWeight={p1NameWeight}>
                <title>{p1Name}</title>{p1Name}
            </text>
            {/* P2 Name (non-editable) */}
            <text x="5" y={slotCenterY2} dominantBaseline="middle" fontSize={NAME_FONT_SIZE} className="fill-slate-100" fontWeight={p2NameWeight}>
                <title>{p2Name}</title>{p2Name}
            </text>

            {/* Box for score inputs */}
            <rect x={MATCH_BOX_WIDTH} y="0" width={SCORE_BOX_WIDTH} height={MATCH_BOX_HEIGHT} rx="2" ry="2" className="fill-slate-700 stroke-indigo-400" strokeWidth="1.5" />
             <foreignObject x={MATCH_BOX_WIDTH + 2} y="2" width={SCORE_BOX_WIDTH - 4} height={MATCH_BOX_HEIGHT/2 - 4}>
                <input type="number" min="0" autoFocus value={inlineScores.p1} onChange={(e) => onInlineScoreChange({...inlineScores, p1: e.target.value})}
                       className="w-full h-full text-center bg-slate-800 text-slate-50 border-slate-600 rounded text-xs p-0 focus:border-indigo-300"/>
            </foreignObject>
            <foreignObject x={MATCH_BOX_WIDTH + 2} y={MATCH_BOX_HEIGHT/2 + 2} width={SCORE_BOX_WIDTH - 4} height={MATCH_BOX_HEIGHT/2 - 4}>
                <input type="number" min="0" value={inlineScores.p2} onChange={(e) => onInlineScoreChange({...inlineScores, p2: e.target.value})}
                       className="w-full h-full text-center bg-slate-800 text-slate-50 border-slate-600 rounded text-xs p-0 focus:border-indigo-300"/>
            </foreignObject>

            {/* SAVE/CANCEL ICONS */}
            <g transform={`translate(${MATCH_TOTAL_WIDTH + 5}, ${(MATCH_BOX_HEIGHT - 38)/2})`}>
                <foreignObject x="0" y="0" width="18" height="18" >
                    <button onClick={onCancelInlineEdit} title="Cancel" className="w-full h-full p-0.5 bg-slate-500 hover:bg-slate-400 rounded-sm text-white flex items-center justify-center">
                        <XCircleIcon className="w-4 h-4"/>
                    </button>
                </foreignObject>
                <foreignObject x="0" y="20" width="18" height="18" >
                    <button onClick={onInlineScoreSubmit} title="Save Score" className="w-full h-full p-0.5 bg-green-600 hover:bg-green-500 rounded-sm text-white flex items-center justify-center">
                        <CheckCircleIcon className="w-4 h-4"/>
                    </button>
                </foreignObject>
            </g>
        </g>
       );
    }

    return (
      <g key={match.id} transform={`translate(${pos.x}, ${pos.y})`}
        onClick={() => { if (canEdit && onMatchClick) onMatchClick(match); }}
        onMouseEnter={() => setHoverMatchId(match.id)}
        onMouseLeave={() => setHoverMatchId(null)}
        style={{ cursor: (canEdit && onMatchClick) ? 'pointer' : 'default' }}
        className={`match-node-challonge group transition-opacity duration-150 ${canEdit && hoverMatchId === match.id ? 'opacity-100 brightness-110' : 'opacity-95'}`}
      >
        <rect x="0" y="0" width={MATCH_BOX_WIDTH} height={MATCH_BOX_HEIGHT} rx="2" ry="2" className={`${boxFillClass} stroke-slate-600 group-hover:stroke-indigo-400`} strokeWidth="0.5" /> {/* Thinner box stroke */}
        <line x1="0" y1={MATCH_BOX_HEIGHT / 2} x2={MATCH_BOX_WIDTH} y2={MATCH_BOX_HEIGHT / 2} className="stroke-slate-600" strokeWidth="0.5" />

        {/* Participant 1 Slot */}
        {renderParticipantSlot(slotCenterY1, p1Name, p1Seed, p1ScoreText, match.ui_participant1_is_prereq, p1NameColor, p1ScoreColor, p1NameWeight, isP1Winner)}
        {/* Participant 2 Slot */}
        {renderParticipantSlot(slotCenterY2, p2Name, p2Seed, p2ScoreText, match.ui_participant2_is_prereq, p2NameColor, p2ScoreColor, p2NameWeight, isP2Winner)}


        {/* Score Box Separator if scores are shown */}
        {!(match.ui_participant1_is_prereq && match.ui_participant2_is_prereq) && (!isBye) &&
             <rect x={MATCH_BOX_WIDTH} y="0" width={SCORE_BOX_WIDTH} height={MATCH_BOX_HEIGHT} rx="2" ry="2" className="fill-slate-800 stroke-slate-600 group-hover:stroke-indigo-400" strokeWidth="0.5" />
        }
        {canEdit && onMatchClick && (
             <foreignObject x={MATCH_TOTAL_WIDTH + 4} y={(MATCH_BOX_HEIGHT - 14)/2} width="14" height="14" className="opacity-50 group-hover:opacity-100">
                <PencilSquareIcon className="text-indigo-300 hover:text-indigo-200 w-full h-full"/>
             </foreignObject>
        )}
      </g>
    );
  };

 const renderConnectorLinesSVG = () => {
    // Unchanged from previous, as the static connection points were established
    const lines: React.ReactNode[] = [];
    processedMatches.forEach(sourceMatch => {
        const sourcePos = matchPositions[sourceMatch.id];
        if (!sourcePos) return;
        if (sourceMatch.next_match_id) {
            const targetMatch = processedMatches.find(m => m.id === sourceMatch.next_match_id);
            if (targetMatch && matchPositions[targetMatch.id]) {
                const targetPos = matchPositions[targetMatch.id];
                let sourceY = sourcePos.y + MATCH_BOX_HEIGHT / 2;
                if (sourceMatch.status === 'COMPLETED' || sourceMatch.status === 'BYE') {
                    if (sourceMatch.winner_id === sourceMatch.participant1_id) sourceY = sourcePos.y + MATCH_BOX_HEIGHT * 0.25;
                    else if (sourceMatch.winner_id === sourceMatch.participant2_id) sourceY = sourcePos.y + MATCH_BOX_HEIGHT * 0.75;
                }
                const sourceX = sourcePos.x + MATCH_TOTAL_WIDTH;
                const targetIsP1Slot = targetMatch.participant1_prereq_match_id === sourceMatch.id;
                const targetY = targetPos.y + (targetIsP1Slot ? MATCH_BOX_HEIGHT * 0.25 : MATCH_BOX_HEIGHT * 0.75);
                const targetX = targetPos.x;
                const midX = sourceX + ROUND_GAP / 2;
                const isActiveLine = hoverMatchId === sourceMatch.id || hoverMatchId === targetMatch.id;
                const strokeColor = isActiveLine ? "#6366F1" : "#424B5A"; // Slightly darker default: slate-600/700
                lines.push(
                    <path key={`conn-w-${sourceMatch.id}`}
                          d={`M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`}
                          stroke={strokeColor} strokeWidth="1" fill="none" className="transition-stroke duration-150"/>
                );
            }
        }
        if (tournament.format === 'DOUBLE_ELIMINATION' && sourceMatch.loser_next_match_id) {
            const loserTargetMatch = processedMatches.find(m => m.id === sourceMatch.loser_next_match_id);
            if (loserTargetMatch && matchPositions[loserTargetMatch.id]) {
                const loserTargetPos = matchPositions[loserTargetMatch.id];
                let loserSourceY = sourcePos.y + MATCH_BOX_HEIGHT / 2;
                if (sourceMatch.status === 'COMPLETED' && sourceMatch.loser_id) {
                    if (sourceMatch.loser_id === sourceMatch.participant1_id) loserSourceY = sourcePos.y + MATCH_BOX_HEIGHT * 0.25;
                    else if (sourceMatch.loser_id === sourceMatch.participant2_id) loserSourceY = sourcePos.y + MATCH_BOX_HEIGHT * 0.75;
                }
                const loserSourceX = sourcePos.x + MATCH_TOTAL_WIDTH;
                const loserTargetIsP1Slot = loserTargetMatch.participant1_prereq_match_id === sourceMatch.id;
                const loserTargetY = loserTargetPos.y + (loserTargetIsP1Slot ? MATCH_BOX_HEIGHT * 0.25 : MATCH_BOX_HEIGHT * 0.75);
                const loserTargetX = loserTargetPos.x;
                const loserMidX = loserSourceX + ROUND_GAP / 2;
                const isActiveLine = hoverMatchId === sourceMatch.id || hoverMatchId === loserTargetMatch.id;
                const strokeColor = isActiveLine ? "#A855F7" : "#7C3AED";
                lines.push(
                    <path key={`conn-l-${sourceMatch.id}`}
                          d={`M ${loserSourceX} ${loserSourceY} H ${loserMidX} V ${loserTargetY} H ${loserTargetX}`}
                          stroke={strokeColor} strokeWidth="1" fill="none" strokeDasharray="3,2" className="transition-stroke duration-150"/>
                );
            }
        }
    });
    return lines;
  };

  const showPlaceholder = (!apiMatches || apiMatches.length === 0) && processedMatches.length === 0;

  return (
     <div ref={containerRef} className="challonge-style-bracket dark-theme bg-slate-900 text-slate-300 p-4 overflow-auto rounded-lg relative"
         style={{ minHeight: '500px' }}>
      <svg ref={svgRef} width={canvasSize.width} height={canvasSize.height}
           style={{ display: 'block', fontFamily: 'Inter, system-ui, sans-serif' }}>
        {roundCoordinates.map(rc => (
            <text key={`round-title-${rc.round}`} x={rc.x} y={rc.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={ROUND_TITLE_FONT_SIZE} className="fill-slate-400 font-semibold select-none">
                {rc.title}
            </text>
        ))}
        {Object.keys(matchPositions).length > 0 && renderConnectorLinesSVG()}
        {processedMatches.map(match => (matchPositions[match.id] ? renderMatchSVG(match) : null))}
      </svg>
      {showPlaceholder && (
        <div className="absolute inset-0 flex justify-center items-center text-slate-500 italic">
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