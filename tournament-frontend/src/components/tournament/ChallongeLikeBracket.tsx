import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import MatchComponent from './Match'; // Your MatchComponent
import { Tournament, Match as MatchFromAPI, Participant, BracketType as APIMatchBracketType, TournamentFormat } from '@/types/tournament'; // Using your defined types

interface ExtendedMatch extends MatchFromAPI {
  sourceMatchForP1?: string;
  sourceMatchForP2?: string;
  participant1Name?: string;
  participant2Name?: string;
  participant1Seed?: number | null;
  participant2Seed?: number | null;
}

// This should match what MatchComponent expects for its `match` prop
interface ProcessedMatchForDisplay extends MatchFromAPI {
    participant1Name?: string;
    participant2Name?: string;
    participant1Seed?: number | null;
    participant2Seed?: number | null;
    sourceMatchForP1?: string;
    sourceMatchForP2?: string;
}

interface ChallongeLikeBracketProps {
  tournament: Tournament;
  matches: MatchFromAPI[];
  participants: Participant[];
  onMatchClick?: (match: MatchFromAPI) => void;
}

const MATCH_WIDTH = 220;
const MATCH_HEIGHT = 70;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 40;

const ChallongeLikeBracket: React.FC<ChallongeLikeBracketProps> = ({
  tournament,
  matches: initialMatches,
  participants,
  onMatchClick,
}) => {
  console.log("ChallongeLikeBracket PROPS tournament:", tournament);
  console.log("ChallongeLikeBracket PROPS initialMatches:", initialMatches);
  console.log("ChallongeLikeBracket PROPS participants:", participants);

  if (!tournament || !initialMatches || !participants) {
    console.error("ChallongeLikeBracket: Missing critical props!");
    return <div>Error: Missing tournament data to render bracket.</div>;
  }

  const bracketContainerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const participantsById = useMemo(() =>
    participants.reduce((acc, p) => {
      if (p && p.id) acc[p.id] = p;
      return acc;
    }, {} as Record<string, Participant>),
    [participants]
  );

  const getParticipantDisplayInfo = useCallback((participantId: string | null | undefined) => {
    if (!participantId) return { name: 'TBD', seed: null };
    const participant = participantsById[participantId];
    return {
        name: participant ? (participant.participant_name || `P:${participantId.substring(0,4)}`) : 'TBD',
        seed: participant ? (participant.seed ?? null) : null
    };
  }, [participantsById]);

  const findOriginalMatchById = useCallback((id: string | null | undefined): MatchFromAPI | undefined => {
    if (!id) return undefined;
    return initialMatches.find(m => m && m.id === id);
  }, [initialMatches]);

  const processedMatches = useMemo((): ExtendedMatch[] => {
    if (!initialMatches || initialMatches.length === 0) {
        console.warn("processedMatches: initialMatches is null, undefined, or empty.");
        return [];
    }
    const matchesWithUIData = initialMatches.map((match, index) => {
      if (!match || !match.id) {
        console.warn(`processedMatches: Skipping invalid match data at index ${index}:`, match);
        return null;
      }

      let sourceMatchForP1: string | undefined = undefined;
      let sourceMatchForP2: string | undefined = undefined;

      if (!match.participant1_id) {
        const feeder = initialMatches.find(m => m && m.id !== match.id && (m.next_match_id === match.id || m.loser_next_match_id === match.id));
        if (feeder) {
            const prefix = feeder.next_match_id === match.id ? "W" : (feeder.loser_next_match_id === match.id ? "L" : "Src");
            sourceMatchForP1 = `${prefix} of M${feeder.match_number}`;
        }
      }
      if (!match.participant2_id) {
        const potentialFeeders = initialMatches.filter(m => m && m.id !== match.id && (m.next_match_id === match.id || m.loser_next_match_id === match.id));
        const feederForP2 = potentialFeeders.find(f => {
            if (!f) return false;
            const fSourceText = `${f.next_match_id === match.id ? "W" : (f.loser_next_match_id === match.id ? "L" : "Src")} of M${f.match_number}`;
            // Ensure this feeder is different from the one identified for P1's source
            const p1FeederText = sourceMatchForP1; // Use the already determined sourceMatchForP1
            return fSourceText !== p1FeederText;
        });
        if (feederForP2) {
            const prefix = feederForP2.next_match_id === match.id ? "W" : (feederForP2.loser_next_match_id === match.id ? "L" : "Src");
            sourceMatchForP2 = `${prefix} of M${feederForP2.match_number}`;
        } else if (potentialFeeders.length === 1 && (!sourceMatchForP1 || (sourceMatchForP1 && match.participant1_id))) {
             // If P1 is filled by a direct participant (not from a feeder match slot that sourceMatchForP1 would represent)
             // AND there's only one feeder match for this current match, it's for P2.
             const feeder = potentialFeeders[0];
             if (feeder) {
                const prefix = feeder.next_match_id === match.id ? "W" : (feeder.loser_next_match_id === match.id ? "L" : "Src");
                sourceMatchForP2 = `${prefix} of M${feeder.match_number}`;
             }
        }
      }

      const p1Info = getParticipantDisplayInfo(match.participant1_id);
      const p2Info = getParticipantDisplayInfo(match.participant2_id);

      // --- Ensured bracket_type handling ---
      let determinedBracketType: APIMatchBracketType = match.bracket_type ?? null;

      if (typeof determinedBracketType !== 'string' ||
         (determinedBracketType !== 'WINNERS' && determinedBracketType !== 'LOSERS' && determinedBracketType !== 'GRAND_FINALS')) {
        console.warn(`Match ID ${match.id} (Number: ${match.match_number}, Round: ${match.round}) has invalid or missing bracket_type: '${match.bracket_type}'. Tournament Format: ${tournament.format}`);
        if (tournament.format === 'SINGLE_ELIMINATION') {
          determinedBracketType = 'WINNERS';
          console.log(`   -> Defaulting to 'WINNERS' for Single Elim.`);
        } else if (tournament.format === 'DOUBLE_ELIMINATION') {
          if (match.round >= 999) {
            determinedBracketType = 'GRAND_FINALS';
            console.log(`   -> Heuristic: Round >= 999, defaulting to 'GRAND_FINALS'.`);
          } else {
            // THIS IS THE CRITICAL PART FOR YOUR LOGS:
            // Your backend FOR DOUBLE ELIMINATION *should* be providing 'WINNERS' or 'LOSERS'.
            // If it's not, this default is a fallback to make *something* render but it will be WRONG for Losers.
            console.error(`   -> CRITICAL: Missing or invalid bracket_type for DE match ${match.id}. Backend should provide 'WINNERS' or 'LOSERS'. Defaulting to 'WINNERS' to show something.`);
            determinedBracketType = 'WINNERS'; // Fallback for DE if not GF
          }
        } else {
            determinedBracketType = null;
        }
      }
      // --- End bracket_type handling ---

      const extendedMatchData: ExtendedMatch = {
            ...match,
            bracket_type: determinedBracketType,
            participant1Name: p1Info.name,
            participant2Name: p2Info.name,
            participant1Seed: p1Info.seed,
            participant2Seed: p2Info.seed,
            sourceMatchForP1: match.participant1_id ? undefined : sourceMatchForP1,
            sourceMatchForP2: match.participant2_id ? undefined : sourceMatchForP2,
        };
        return extendedMatchData;
    }).filter(Boolean) as ExtendedMatch[];
    return matchesWithUIData.sort((a, b) => a.match_number - b.match_number);
  }, [initialMatches, tournament.format, getParticipantDisplayInfo]);

  console.log("ChallongeLikeBracket processedMatches:", processedMatches);
  if (processedMatches.length > 0) {
    console.log("First processed match sample:", processedMatches[0]);
  }

  const winnersBracketMatches = useMemo(() =>
    processedMatches.filter(m => m.bracket_type === 'WINNERS'),
    [processedMatches]
  );
  const losersBracketMatches = useMemo(() =>
    processedMatches.filter(m => m.bracket_type === 'LOSERS'),
    [processedMatches]
  );
  const grandFinalsMatches = useMemo(() =>
    processedMatches.filter(m => m.bracket_type === 'GRAND_FINALS'),
    [processedMatches]
  );

  console.log("ChallongeLikeBracket winnersBracketMatches:", winnersBracketMatches);
  console.log("ChallongeLikeBracket losersBracketMatches:", losersBracketMatches);
  console.log("ChallongeLikeBracket grandFinalsMatches:", grandFinalsMatches);


  const groupMatchesByRound = (matchesToGroup: ExtendedMatch[]): Record<number, ExtendedMatch[]> => {
    return matchesToGroup.reduce((acc, match) => {
      const round = match.round;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      acc[round].sort((a, b) => a.match_number - b.match_number);
      return acc;
    }, {} as Record<number, ExtendedMatch[]>);
  };

  const winnerMatchesByRound = useMemo(() => groupMatchesByRound(winnersBracketMatches), [winnersBracketMatches]);
  const loserMatchesByRound = useMemo(() => groupMatchesByRound(losersBracketMatches), [losersBracketMatches]);

  const maxWinnerRound = useMemo(() => Math.max(0, ...Object.keys(winnerMatchesByRound).map(Number).filter(isFinite)), [winnerMatchesByRound]);
  const maxLoserRound = useMemo(() => Math.max(0, ...Object.keys(loserMatchesByRound).map(Number).filter(isFinite)), [loserMatchesByRound]);

 useEffect(() => {
    const timerId = setTimeout(() => {
        if (!bracketContainerRef.current || !svgRef.current) {
            console.warn("SVG draw: Refs not available yet.");
            return;
        }
        const svg = svgRef.current;
        const bracketContainer = bracketContainerRef.current;
        svg.innerHTML = '';

        const drawLine = (
          sourceMatchDiv: HTMLElement | null,
          targetMatchDiv: HTMLElement | null,
          lineColor: string,
          isLoserDrop: boolean = false
        ) => {
          if (!sourceMatchDiv || !targetMatchDiv || !bracketContainer) {
            return;
          }
          const containerRect = bracketContainer.getBoundingClientRect();
          const sourceRect = sourceMatchDiv.getBoundingClientRect();
          const targetRect = targetMatchDiv.getBoundingClientRect();
          if (sourceRect.width === 0 || targetRect.width === 0) {
            return;
          }
          const scrollLeft = bracketContainer.scrollLeft;
          const scrollTop = bracketContainer.scrollTop;
          let startX = (sourceRect.right - containerRect.left) + scrollLeft;
          let startY = (sourceRect.top + sourceRect.height / 2 - containerRect.top) + scrollTop;
          let endX = (targetRect.left - containerRect.left) + scrollLeft;
          let endY = (targetRect.top + targetRect.height / 2 - containerRect.top) + scrollTop;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          let d: string;
          if (isLoserDrop) {
            startX = (sourceRect.left + sourceRect.width / 2 - containerRect.left) + scrollLeft;
            startY = (sourceRect.bottom - containerRect.top) + scrollTop;
            endX = (targetRect.left + targetRect.width / 2 - containerRect.left) + scrollLeft;
            endY = (targetRect.top - containerRect.top) + scrollTop;
            const intermediateY = startY + (endY - startY) / 2;
            d = `M ${startX} ${startY} V ${intermediateY} H ${endX} V ${endY}`;
          } else {
            const midX = startX + (endX - startX) / 2;
            d = `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`;
          }
          path.setAttribute('d', d);
          path.setAttribute('stroke', lineColor);
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          svg.appendChild(path);
        };

        processedMatches.forEach(match => {
          if (!match || !match.id) return;
          const currentEl = bracketContainer.querySelector(`[data-match-id="${match.id}"]`) as HTMLElement;
          if (match.next_match_id) {
            const nextWinnerEl = bracketContainer.querySelector(`[data-match-id="${match.next_match_id}"]`) as HTMLElement;
            drawLine(currentEl, nextWinnerEl, '#60a5fa');
          }
          if (match.bracket_type === 'WINNERS' && match.loser_next_match_id) {
            const nextLoserEl = bracketContainer.querySelector(`[data-match-id="${match.loser_next_match_id}"]`) as HTMLElement;
            drawLine(currentEl, nextLoserEl, '#f87171', true);
          }
        });
        svg.style.width = `${bracketContainer.scrollWidth}px`;
        svg.style.height = `${bracketContainer.scrollHeight}px`;
    }, 100);
    return () => clearTimeout(timerId);
  }, [processedMatches]);


  const renderRoundColumn = (
    roundNum: number,
    matchesInRound: ExtendedMatch[] | undefined,
    bracketKey: 'winners' | 'losers'
  ) => {
    if (!matchesInRound || matchesInRound.length === 0) {
        return null;
    }
    let title = "";
    if (bracketKey === 'winners') {
      title = roundNum === maxWinnerRound ? "Winners Final" :
              (maxWinnerRound > 1 && roundNum === maxWinnerRound - 1) ? "Winners Semifinals" :
              `Round ${roundNum}`;
    } else {
      title = roundNum === maxLoserRound ? "Losers Final" :
              (maxLoserRound > 1 && roundNum === maxLoserRound - 1 && winnersBracketMatches.length > 0) ? "Losers Semifinals" :
              `Losers Round ${roundNum}`;
    }
    if (!title.toLowerCase().includes('winners') && !title.toLowerCase().includes('losers') && !title.toLowerCase().includes('final') && !title.toLowerCase().includes('semifinals')) {
        if (bracketKey === 'winners' && tournament.format === 'DOUBLE_ELIMINATION') title = `WB ${title}`;
        else if (bracketKey === 'losers') title = `LB ${title}`;
    }

    return (
      <div key={`${bracketKey}-round-${roundNum}`} className="round-column">
        <h3 className="round-title">{title}</h3>
        <div className="matches-in-column">
          {matchesInRound.map(match => {
             if (!match || !match.id) return null;
             return (
                <div className="match-wrapper" key={match.id} data-match-id={match.id}>
                <MatchComponent
                    match={match}
                    onClick={onMatchClick ? () => {
                        const original = findOriginalMatchById(match.id);
                        if (original) onMatchClick(original);
                    } : undefined}
                />
                </div>
          )})}
        </div>
      </div>
    );
  };

  const wbRoundKeys = Object.keys(winnerMatchesByRound).map(Number).filter(isFinite);

  console.log("Render: WB? Length:", winnersBracketMatches.length, "wbRoundKeys:", wbRoundKeys);
  console.log("Render: LB? Format:", tournament.format, "Length:", losersBracketMatches.length, "loserMatchesByRound keys:", Object.keys(loserMatchesByRound));
  console.log("Render: GF? Length:", grandFinalsMatches.length);


  return (
    <div className="challonge-like-bracket-container" ref={bracketContainerRef}>
      <style jsx>{`
        /* CSS styles from previous message */
        .challonge-like-bracket-container { position: relative; display: flex; flex-direction: column; gap: 48px; padding: 20px; background: #2d2d2d; color: #e5e7eb; overflow: auto; font-family: 'Roboto', 'Arial', sans-serif; }
        .main-brackets-wrapper { display: flex; flex-direction: row; gap: 16px; align-items: flex-start; }
        .bracket-layout { display: flex; flex-direction: column; gap: 48px; }
        .bracket-section { display: flex; flex-direction: column; }
        .bracket-section-title { font-size: 1rem; font-weight: 500; color: #f8720d; margin-bottom: 12px; text-transform: uppercase; padding-left: 8px; }
        .rounds-container { display: flex; flex-direction: row; gap: ${HORIZONTAL_SPACING}px; align-items: flex-start; padding-top: 20px; padding-bottom: 20px; }
        .round-column { display: flex; flex-direction: column; gap: ${VERTICAL_SPACING}px; min-width: ${MATCH_WIDTH}px; align-items: center; }
        .round-title { text-align: center; font-size: 0.75rem; font-weight: 400; color: #aaa; margin-bottom: 12px; background-color: #333333; padding: 2px 6px; border-radius: 3px; width: fit-content; min-width: 100px; }
        .matches-in-column { display: flex; flex-direction: column; gap: ${VERTICAL_SPACING}px; width: 100%; }
        .match-wrapper { width: ${MATCH_WIDTH}px; height: ${MATCH_HEIGHT}px; display: flex; justify-content: center; align-items: center; }
        .grand-finals-column { display: flex; flex-direction: column; gap: ${VERTICAL_SPACING}px; min-width: ${MATCH_WIDTH}px; align-items: center; margin-left: ${HORIZONTAL_SPACING}px; }
        :global(.match-component-container) { background-color: #3c3c3c; border: 1px solid #444444; border-radius: 3px; padding: 0px; width: ${MATCH_WIDTH}px; height: ${MATCH_HEIGHT}px; display: flex; flex-direction: column; justify-content: flex-start; font-size: 13px; color: #bbbbbb; box-shadow: 0 1px 2px rgba(0,0,0,0.2); position: relative; }
        :global(.match-component-header) { position: absolute; top: 2px; left: 6px; font-size: 10px; color: #777777; line-height: 1; z-index: 1; }
        :global(.match-component-participant) { display: flex; align-items: center; height: calc(50% - 1px); padding: 0 6px; box-sizing: border-box; }
        :global(.match-component-participant.top-player) { padding-top: 12px; }
        :global(.match-component-participant.bottom-player) { border-top: 1px solid #4f4f4f; }
        :global(.match-component-participant.winner .match-component-name) { font-weight: bold; color: #ffffff; }
        :global(.match-component-participant.winner .match-component-score) { font-weight: bold; color: #ffffff; }
        :global(.match-component-seed) { font-size: 10px; color: #888888; background-color: #333333; min-width: 18px; max-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; margin-right: 6px; border-radius: 2px; text-align: center; line-height: 18px; flex-shrink: 0; }
        :global(.match-component-name) { flex-grow: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; max-width: calc(100% - 24px - 20px - 12px); }
        :global(.match-component-score) { font-weight: bold; color: #ededed; min-width: 20px; text-align: right; padding-left: 5px; font-size: 13px; flex-shrink: 0; }
        :global(.match-component-container:hover) { border-color: #f8720d; }
      `}</style>

      <svg
        ref={svgRef}
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
      />

    <div className="main-brackets-wrapper">
        <div className="bracket-layout">
            {winnersBracketMatches.length > 0 && (
                <div className="bracket-section winners-bracket">
                <h2 className="bracket-section-title">Bracket</h2>
                <div className="rounds-container">
                    {wbRoundKeys.sort((a,b) => a-b).map(roundNum =>
                        renderRoundColumn(roundNum, winnerMatchesByRound[roundNum], "winners")
                    )}
                </div>
                </div>
            )}

            {tournament.format === 'DOUBLE_ELIMINATION' && losersBracketMatches.length > 0 && (
                <div className="bracket-section losers-bracket">
                <h2 className="bracket-section-title">Losers Bracket</h2>
                <div className="rounds-container">
                    {Object.keys(loserMatchesByRound).map(Number).filter(isFinite).sort((a,b) => a-b).map(roundNum =>
                        renderRoundColumn(roundNum, loserMatchesByRound[roundNum], "losers")
                    )}
                </div>
                </div>
            )}
        </div>

       {grandFinalsMatches.length > 0 && (
            <div className="bracket-section grand-finals-section">
            <h2 className="bracket-section-title">Finals</h2>
            <div className="grand-finals-column">
                <div className="matches-in-column">
                {grandFinalsMatches
                    .sort((a, b) => a.match_number - b.match_number)
                    .map((baseGfMatch: MatchFromAPI) => { // Iterate over original type for safety from map
                        // Find the fully processed match to get all extended properties
                        const gfMatch = processedMatches.find(pm => pm.id === baseGfMatch.id);
                        if (!gfMatch) { // Should not happen if grandFinalsMatches is derived from processedMatches
                             console.error("Consistency error: GF Match not found in processedMatches", baseGfMatch.id);
                             return null;
                        }

                        const propsForGFMatchComponent: ProcessedMatchForDisplay = {
                            ...gfMatch, // Start with all fields from the (ExtendedMatch) gfMatch
                            // Explicitly set names for GF TBD slots
                            participant1Name: gfMatch.participant1_id ? gfMatch.participant1Name : 'Winner of WB',
                            participant2Name: gfMatch.participant2_id ? gfMatch.participant2Name : 'Winner of LB',
                            // Seeds for TBD slots in GF are null
                            participant1Seed: gfMatch.participant1_id ? gfMatch.participant1Seed : null,
                            participant2Seed: gfMatch.participant2_id ? gfMatch.participant2Seed : null,
                            // Clear out generic sourceMatch if we're using specific GF TBDs
                            sourceMatchForP1: gfMatch.participant1_id ? gfMatch.sourceMatchForP1 : undefined,
                            sourceMatchForP2: gfMatch.participant2_id ? gfMatch.sourceMatchForP2 : undefined,
                        };

                        return (
                            <div className="match-wrapper" key={gfMatch.id} data-match-id={gfMatch.id}>
                                <MatchComponent
                                    match={propsForGFMatchComponent}
                                    onClick={onMatchClick ? () => {
                                        // Find original match from initialMatches to pass to onMatchClick
                                        const originalOnClickMatch = initialMatches.find(m => m.id === gfMatch.id);
                                        if (originalOnClickMatch) onMatchClick(originalOnClickMatch);
                                    } : undefined}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
            </div>
        )}
    </div>
    </div>
  );
};

export default ChallongeLikeBracket;