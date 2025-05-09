import React, { useEffect, useRef, useMemo } from 'react';
import MatchComponent from './Match'; // Assuming your Match component is named MatchComponent
import { Match as MatchType, Participant, Tournament, TournamentFormat } from '@/types/tournament'; // Ensure MatchType has bracket_type

// Define UI-specific bracket types
type UIMatchBracketType = 'WINNERS' | 'LOSERS' | 'GRAND_FINALS_WRAPPER';

interface ExtendedMatch extends MatchType {
  // Fields from MatchType: id, round, match_number, participant1_id, participant2_id,
  // winner_id, loser_id, score_participant1, score_participant2, status,
  // next_match_id, loser_next_match_id, created_at, updated_at,
  // bracket_type (WINNERS, LOSERS, GRAND_FINALS - from backend)
  // match_notes (optional)
  
  // UI specific properties
  uiBracket?: UIMatchBracketType; // For grouping in the UI
  isGrandFinalMatch?: boolean;    // True if it's one of the actual GF matches
  sourceMatchForP1?: string;    // e.g., "W: M1" or "L: M3"
  sourceMatchForP2?: string;
  participant1Name?: string;
  participant2Name?: string;
}

interface ChallongeLikeBracketProps {
  tournament: Tournament;
  matches: MatchType[];
  participants: Participant[];
  onMatchClick?: (match: MatchType) => void;
}

const ChallongeLikeBracket: React.FC<ChallongeLikeBracketProps> = ({
  tournament,
  matches: initialMatches, // Renamed to avoid confusion
  participants,
  onMatchClick,
}) => {
  const bracketRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const participantsById = useMemo(() => 
    participants.reduce((acc, p) => {
      acc[p.id] = p;
      return acc;
    }, {} as Record<string, Participant>),
    [participants]
  );

  const getParticipantName = (id: string | null | undefined): string => {
    if (!id) return 'TBD';
    const participant = participantsById[id];
    return participant ? (participant.participant_name || `P:${id.substring(0,4)}`) : 'TBD';
  };
  
  const processedMatches = useMemo((): ExtendedMatch[] => {
    return initialMatches.map(match => {
      let uiBracket: UIMatchBracketType | undefined = undefined;
      let isGrandFinalMatch = false;
      let sourceMatchForP1: string | undefined = undefined;
      let sourceMatchForP2: string | undefined = undefined;

      // Determine UI Bracket Type based on backend's bracket_type
      switch (match.bracket_type) {
        case 'WINNERS':
          uiBracket = 'WINNERS';
          break;
        case 'LOSERS':
          uiBracket = 'LOSERS';
          break;
        case 'GRAND_FINALS':
          uiBracket = 'GRAND_FINALS_WRAPPER'; // Special UI grouping for GF
          isGrandFinalMatch = true;
          break;
        default:
          // Fallback for single elimination or if bracket_type is missing
          if (tournament.format === 'SINGLE_ELIMINATION') {
            uiBracket = 'WINNERS';
          }
          break;
      }

      // Attempt to determine source for TBD slots
      // This is a simplified version; true source requires deeper graph traversal
      // or more explicit data from backend (e.g., which previous match feeds P1 vs P2)
      if (!match.participant1_id) {
        const p1Feeder = initialMatches.find(m => m.next_match_id === match.id || m.loser_next_match_id === match.id); // Needs refinement to know if it's P1
        if (p1Feeder) {
            sourceMatchForP1 = `${p1Feeder.next_match_id === match.id ? 'W' : 'L'}: M${p1Feeder.match_number}`;
        }
      }
      if (!match.participant2_id) {
        // This is complex as multiple matches could feed into one if byes are involved.
        // True "feeder for P2" needs backend to provide this linkage more clearly.
        // For now, we'll rely on participant IDs being filled eventually.
      }


      return {
        ...match,
        uiBracket,
        isGrandFinalMatch,
        participant1Name: getParticipantName(match.participant1_id),
        participant2Name: getParticipantName(match.participant2_id),
        sourceMatchForP1: match.participant1_id ? undefined : sourceMatchForP1,
        sourceMatchForP2: match.participant2_id ? undefined : sourceMatchForP2, // Placeholder
      };
    }).sort((a,b) => a.match_number - b.match_number); // Sort all matches by number initially
  }, [initialMatches, participantsById, tournament.format]);


  const winnersBracketMatches = useMemo(() => 
    processedMatches.filter(m => m.uiBracket === 'WINNERS'), 
    [processedMatches]
  );
  const losersBracketMatches = useMemo(() => 
    processedMatches.filter(m => m.uiBracket === 'LOSERS'), 
    [processedMatches]
  );
  const grandFinalsMatches = useMemo(() => 
    processedMatches.filter(m => m.uiBracket === 'GRAND_FINALS_WRAPPER'), 
    [processedMatches]
  );

  const groupMatchesByRound = (matchesToGroup: ExtendedMatch[]): Record<number, ExtendedMatch[]> => {
    return matchesToGroup.reduce((acc, match) => {
      const round = match.round; // Use the match's own round
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      // Ensure matches within a round are sorted by match_number
      acc[round].sort((a,b) => a.match_number - b.match_number);
      return acc;
    }, {} as Record<number, ExtendedMatch[]>);
  };

  const winnerMatchesByRound = useMemo(() => groupMatchesByRound(winnersBracketMatches), [winnersBracketMatches]);
  const loserMatchesByRound = useMemo(() => groupMatchesByRound(losersBracketMatches), [losersBracketMatches]);

  const maxWinnerRound = useMemo(() => Math.max(0, ...Object.keys(winnerMatchesByRound).map(Number)), [winnerMatchesByRound]);
  const maxLoserRound = useMemo(() => Math.max(0, ...Object.keys(loserMatchesByRound).map(Number)), [loserMatchesByRound]);
  
  useEffect(() => {
    if (!bracketRef.current || !svgRef.current) return;
    const svg = svgRef.current;
    svg.innerHTML = ''; // Clear previous lines

    const drawLine = (
        sourceMatch: ExtendedMatch,
        targetMatchId: string | null | undefined,
        isLoserLine: boolean
      ) => {
        if (!targetMatchId) return;

        const currentEl = document.querySelector(`[data-match-id="${sourceMatch.id}"]`);
        const nextEl = document.querySelector(`[data-match-id="${targetMatchId}"]`);

        if (currentEl && nextEl && bracketRef.current) {
          const currentRect = currentEl.getBoundingClientRect();
          const nextRect = nextEl.getBoundingClientRect();
          const bracketContainerRect = bracketRef.current.getBoundingClientRect();

          // Coordinates relative to the bracket container
          const startX = currentRect.right - bracketContainerRect.left;
          const startY = currentRect.top + currentRect.height / 2 - bracketContainerRect.top;
          const endX = nextRect.left - bracketContainerRect.left;
          const endY = nextRect.top + nextRect.height / 2 - bracketContainerRect.top;
          
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          
          // Simple elbow connector: M startX startY H midX V endY H endX
          const midX = startX + (endX - startX) / 2;
          path.setAttribute('d', `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`);
          path.setAttribute('stroke', isLoserLine ? '#EF4444' : '#4B5563'); // Red for loser, gray for winner
          path.setAttribute('stroke-width', '2');
          path.setAttribute('fill', 'none');
          svg.appendChild(path);
        }
    };
    
    processedMatches.forEach(match => {
      drawLine(match, match.next_match_id, false); // Winner line
      if (match.bracket_type === 'WINNERS') { // Only WB matches have a loser_next_match_id that drops down
          drawLine(match, match.loser_next_match_id, true); // Loser line
      }
    });

  }, [processedMatches, maxWinnerRound, maxLoserRound]); // Rerun when matches or layout might change

  const renderRound = (
    roundNum: number,
    matchesInRound: ExtendedMatch[] | undefined,
    bracketTitle: string
  ) => {
    if (!matchesInRound || matchesInRound.length === 0) return null;
    
    let title = `${bracketTitle} Round ${roundNum}`;
    if (bracketTitle === "Winners" && roundNum === maxWinnerRound) title = "Winners Finals";
    if (bracketTitle === "Winners" && roundNum === maxWinnerRound -1 && maxWinnerRound > 1) title = "Winners Semifinals";
    if (bracketTitle === "Losers" && roundNum === maxLoserRound) title = "Losers Finals";


    return (
      <div key={`${bracketTitle}-${roundNum}`} className="round">
        <h3 className="round-title">{title}</h3>
        <div className="matches">
          {matchesInRound.map(match => (
            <div className="match-wrapper" key={match.id} data-match-id={match.id}>
              <MatchComponent // Use your actual Match component here
                match={{
                    ...match,
                    // Pass TBD names if actual participants are not yet set
                    participant1: match.participant1_id ? participantsById[match.participant1_id] : { id: 'tbd1', participant_name: match.sourceMatchForP1 || 'TBD' },
                    participant2: match.participant2_id ? participantsById[match.participant2_id] : { id: 'tbd2', participant_name: match.sourceMatchForP2 || 'TBD' },
                }}
                onClick={onMatchClick}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="challonge-like-bracket-container" ref={bracketRef}>
      <style jsx>{`
        .challonge-like-bracket-container {
          position: relative; /* For SVG positioning */
          display: flex;
          flex-direction: column;
          gap: 32px; /* 2rem */
          padding: 32px;
          background: #1a1a1a; /* Dark background */
          color: #e5e7eb; /* Light text */
          overflow-x: auto; /* Allow horizontal scrolling for large brackets */
        }
        .bracket-section {
          /* border: 1px solid #374151; Optional: border around sections */
        }
        .bracket-section-title {
          font-size: 1.5rem; /* 24px */
          font-weight: 600;
          color: #f3f4f6; /* Lighter title text */
          margin-bottom: 1rem; /* 16px */
          padding-bottom: 0.5rem; /* 8px */
          border-bottom: 2px solid #4b5563; /* Gray border */
        }
        .rounds-container {
          display: flex;
          flex-direction: row;
          gap: 32px; /* 2rem, spacing between round columns */
          align-items: flex-start; /* Align rounds to the top */
        }
        .round {
          display: flex;
          flex-direction: column;
          gap: 24px; /* 1.5rem, Spacing between matches in a round */
          min-width: 250px; /* Width of a round column */
        }
        .round-title {
          text-align: center;
          font-size: 0.875rem; /* 14px */
          font-weight: 500;
          color: #9ca3af; /* Medium gray text */
          margin-bottom: 0.75rem; /* 12px */
          background-color: #374151; /* Darker gray for round title bg */
          padding: 4px 8px;
          border-radius: 4px;
        }
        .matches { /* Container for matches within a round */
            display: flex;
            flex-direction: column;
            gap: 40px; /* Increased gap to account for connector lines */
        }
        .match-wrapper {
           /* Styles for individual match component wrapper if needed */
           /* The data-match-id attribute is used by the SVG connector logic */
        }
        
        /* Styling for your actual Match.tsx component via :global if needed */
        /* These are just examples, adjust to your Match.tsx structure */
        :global(.match-component-container) { /* Assuming Match.tsx has a root div with this class */
            background-color: #2d3748; /* Darker match background */
            border: 1px solid #4a5567;
            border-radius: 6px;
            padding: 8px 12px;
            min-height: 70px; /* Ensure matches have some height */
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        :global(.match-component-header) {
            display: flex;
            justify-content: space-between;
            font-size: 0.75rem;
            color: #9ca3af;
            margin-bottom: 4px;
        }
        :global(.match-component-participant) {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            font-size: 0.875rem;
        }
         :global(.match-component-participant.winner) {
            font-weight: bold;
            color: #68d391; /* Green for winner */
        }
        :global(.match-component-name) {
            flex-grow: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px; /* Adjust as needed */
        }
        :global(.match-component-score) {
            font-weight: bold;
            min-width: 20px;
            text-align: right;
        }
      `}</style>
      
      <svg 
        ref={svgRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          pointerEvents: 'none',
          zIndex: 0, // Behind matches
        }}
      />

      {winnersBracketMatches.length > 0 && (
        <div className="bracket-section winners-bracket">
          <h2 className="bracket-section-title">Winners Bracket</h2>
          <div className="rounds-container">
            {Object.keys(winnerMatchesByRound).map(roundNumStr => 
              renderRound(Number(roundNumStr), winnerMatchesByRound[Number(roundNumStr)], "Winners")
            )}
          </div>
        </div>
      )}

      {tournament.format === 'DOUBLE_ELIMINATION' && losersBracketMatches.length > 0 && (
        <div className="bracket-section losers-bracket">
          <h2 className="bracket-section-title">Losers Bracket</h2>
          <div className="rounds-container">
            {Object.keys(loserMatchesByRound).map(roundNumStr => 
              renderRound(Number(roundNumStr), loserMatchesByRound[Number(roundNumStr)], "Losers")
            )}
          </div>
        </div>
      )}

      {tournament.format === 'DOUBLE_ELIMINATION' && grandFinalsMatches.length > 0 && (
        <div className="bracket-section grand-finals-wrapper">
          <h2 className="bracket-section-title">Grand Finals</h2>
          <div className="rounds-container"> {/* GF matches are typically in a single column */}
            <div className="round"> {/* Mock round for GF layout */}
                 {/* No round title needed for GF typically, or a generic one */}
                <div className="matches">
                    {grandFinalsMatches
                        .sort((a,b) => a.match_number - b.match_number) // Sort by match_number if there are multiple (e.g. reset)
                        .map(match => (
                            <div className="match-wrapper" key={match.id} data-match-id={match.id}>
                                <MatchComponent // Use your actual Match component here
                                    match={{
                                        ...match,
                                        participant1: match.participant1_id ? participantsById[match.participant1_id] : { id: 'tbdGF1', participant_name: 'Winner WB' },
                                        participant2: match.participant2_id ? participantsById[match.participant2_id] : { id: 'tbdGF2', participant_name: 'Winner LB' },
                                    }}
                                    onClick={onMatchClick}
                                />
                            </div>
                    ))}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChallongeLikeBracket;