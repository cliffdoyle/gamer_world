import React, { useEffect, useState, useRef } from 'react';
import { Match, Tournament, Participant, TournamentFormat } from '@/types/tournament';

type BracketType = 'WINNERS' | 'LOSERS' | null;

interface ExtendedMatch extends Match {
  isGrandFinal?: boolean;
  bracket?: BracketType;
  prerequisite_match_id_1?: string | null;
  prerequisite_match_id_2?: string | null;
}

interface ChallongeLikeBracketProps {
  tournament: Tournament;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
}

const ChallongeLikeBracket: React.FC<ChallongeLikeBracketProps> = ({ 
  tournament, 
  matches, 
  participants,
  onMatchClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Constants for layout
  const MATCH_WIDTH = 180;
  const MATCH_HEIGHT = 40;
  const HORIZONTAL_GAP = 60; 
  const VERTICAL_GAP = 20;
  
  // Challonge colors
  const CHALLONGE_ORANGE = '#f8720d';
  const CHALLONGE_BG = '#2d2d2d';
  const CHALLONGE_MATCH_BG = '#333333';
  const CHALLONGE_MATCH_BORDER = '#444444';
  const CHALLONGE_MATCH_P1_BG = '#3c3c3c';
  const CHALLONGE_MATCH_P2_BG = '#333333';
  const CHALLONGE_TEXT = '#bbbbbb';
  const CHALLONGE_WINNER_TEXT = '#ffffff';
  const CHALLONGE_SEED_BG = '#444444';
  
  // State for processed matches and their positions
  const [processedMatches, setProcessedMatches] = useState<ExtendedMatch[]>([]);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number, y: number, width: number, height: number }>>({});
  const [containerWidth, setContainerWidth] = useState<number>(1000);
  const [containerHeight, setContainerHeight] = useState<number>(600);

  useEffect(() => {
    // Process raw match data
    const processed = prepareBracketData(matches, tournament.format);
    setProcessedMatches(processed);
    
    // Calculate layout
    const positions = calculateLayout(processed);
    setMatchPositions(positions);
    
    // Determine container dimensions
    const maxX = Math.max(...Object.values(positions).map(p => p.x + p.width), 1) + 50;
    const maxY = Math.max(...Object.values(positions).map(p => p.y + p.height), 1) + 50;
    setContainerWidth(maxX);
    setContainerHeight(maxY);
  }, [matches, tournament.format]);
  
  // Calculate positions of all matches
  const calculateLayout = (processed: ExtendedMatch[]) => {
    const positions: Record<string, { x: number, y: number, width: number, height: number }> = {};
    
    // Group matches by bracket and round
    const winnerMatches = processed.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const loserMatches = processed.filter(m => m.bracket === 'LOSERS');
    const grandFinals = processed.filter(m => m.isGrandFinal);
    
    const winnerRounds = [...new Set(winnerMatches.map(m => m.round))].sort((a, b) => a - b);
    const loserRounds = [...new Set(loserMatches.map(m => m.round))].sort((a, b) => a - b);
    
    // Position winner bracket matches
    winnerRounds.forEach((round, roundIndex) => {
      const matchesInRound = winnerMatches.filter(m => m.round === round);
      
      // Calculate vertical spacing - matches get more spread out in later rounds
      const spaceFactor = Math.pow(2, roundIndex);
      const totalHeight = matchesInRound.length * MATCH_HEIGHT + (matchesInRound.length - 1) * VERTICAL_GAP * spaceFactor;
      
      matchesInRound.forEach((match, matchIndex) => {
        const x = 50 + roundIndex * (MATCH_WIDTH + HORIZONTAL_GAP);
        const y = 70 + matchIndex * (MATCH_HEIGHT + VERTICAL_GAP * spaceFactor);
        
        positions[match.id] = {
          x,
          y,
          width: MATCH_WIDTH,
          height: MATCH_HEIGHT
        };
      });
    });
    
    // Position loser bracket matches (if present)
    if (loserRounds.length > 0) {
      const loserBracketStartY = Math.max(...Object.values(positions).map(p => p.y + p.height)) + 80;
      
      loserRounds.forEach((round, roundIndex) => {
        const matchesInRound = loserMatches.filter(m => m.round === round);
        
        // Similar spacing factor for losers bracket
        const spaceFactor = Math.pow(1.5, Math.floor(roundIndex / 2));
        
        matchesInRound.forEach((match, matchIndex) => {
          // For losers bracket, align rounds with winners bracket but with an offset
          const xOffset = round % 2 === 0 ? HORIZONTAL_GAP / 2 : 0;
          const x = 50 + Math.floor((round - 1) / 2) * (MATCH_WIDTH + HORIZONTAL_GAP) + xOffset;
          const y = loserBracketStartY + matchIndex * (MATCH_HEIGHT + VERTICAL_GAP * spaceFactor);
          
          positions[match.id] = {
            x,
            y,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT
          };
        });
      });
    }
    
    // Position grand finals
    if (grandFinals.length > 0) {
      const lastWinnerRoundIndex = winnerRounds.length - 1;
      const lastWinnerRound = winnerRounds[lastWinnerRoundIndex];
      const winnerFinalsMatch = winnerMatches.find(m => m.round === lastWinnerRound);
      
      if (winnerFinalsMatch && positions[winnerFinalsMatch.id]) {
        const winnerFinalPos = positions[winnerFinalsMatch.id];
        
        // Place grand finals to the right of winner finals
        grandFinals.forEach((gf, index) => {
          positions[gf.id] = {
            x: winnerFinalPos.x + MATCH_WIDTH + HORIZONTAL_GAP,
            y: winnerFinalPos.y,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT
          };
        });
      }
    }
    
    return positions;
  };

  // Prepare bracket data by adding bracket types and other metadata
  const prepareBracketData = (
    matches: Match[], 
    tournamentFormat: TournamentFormat | undefined
  ): ExtendedMatch[] => {
    if (!tournamentFormat) return matches as ExtendedMatch[];
    
    // Calculate maximum round
    const maxRound = Math.max(...matches.map(m => m.round), 0);

    // First pass - assign brackets based on tournament format
    const withBrackets = matches.map(match => {
      if (match.bracket) return match as ExtendedMatch;

      // For single elimination, all matches are in winners bracket
      if (tournamentFormat === 'SINGLE_ELIMINATION') {
        return { ...match, bracket: 'WINNERS' as BracketType } as ExtendedMatch;
      }

      // For double elimination, determine bracket based on round and structure
      if (tournamentFormat === 'DOUBLE_ELIMINATION') {
        const winnersRounds = Math.ceil(Math.log2(participants.length || 2));
        const isLosers = match.round > winnersRounds;
        
        return {
          ...match,
          bracket: isLosers ? 'LOSERS' : 'WINNERS' as BracketType
        } as ExtendedMatch;
      }

      // Default
      return { ...match, bracket: null } as ExtendedMatch;
    });

    // Second pass - identify grand finals for double elimination
    return withBrackets.map(match => {
      if (tournamentFormat !== 'DOUBLE_ELIMINATION') return match;
      
      // Grand finals is typically the last match in winners bracket with no next match
      const isLastRound = match.round === maxRound;
      const hasNoNextMatch = !matches.some(m => m.next_match_id === match.id);
      
      if (match.bracket === 'WINNERS' && isLastRound && hasNoNextMatch) {
        return { ...match, isGrandFinal: true };
      }
      
      return match;
    });
  };

  // Find match by ID
  const findMatch = (id: string | null): ExtendedMatch | undefined => {
    if (!id) return undefined;
    return processedMatches.find(m => m.id === id);
  };

  // Get participant name by ID
  const getParticipantNameById = (id: string | null) => {
    if (!id) return 'TBD';
    const participant = participants.find(p => p.id === id);
    return participant?.participant_name || 'Unknown';
  };

  // Get participant seed by ID
  const getParticipantSeed = (id: string | null) => {
    if (!id) return null;
    const participant = participants.find(p => p.id === id);
    return participant?.seed;
  };

  // Render connection lines between matches
  const renderConnectionLines = () => {
    return processedMatches.map(match => {
      if (!match.prerequisite_match_id_1 && !match.prerequisite_match_id_2) return null;
      
      const currentPos = matchPositions[match.id];
      if (!currentPos) return null;
      
      return (
        <g key={`conn-${match.id}`}>
          {/* First prerequisite connection */}
          {match.prerequisite_match_id_1 && (
            <ConnectionLine 
              match={match} 
              prereqId={match.prerequisite_match_id_1} 
              positions={matchPositions}
              isSecondPrereq={false}
            />
          )}
          
          {/* Second prerequisite connection */}
          {match.prerequisite_match_id_2 && (
            <ConnectionLine 
              match={match} 
              prereqId={match.prerequisite_match_id_2} 
              positions={matchPositions}
              isSecondPrereq={true}
            />
          )}
        </g>
      );
    });
  };
  
  // Helper component for connection lines
  const ConnectionLine = ({ 
    match, 
    prereqId, 
    positions, 
    isSecondPrereq 
  }: { 
    match: ExtendedMatch; 
    prereqId: string | null; 
    positions: Record<string, { x: number, y: number, width: number, height: number }>;
    isSecondPrereq: boolean;
  }) => {
    const currentPos = positions[match.id];
    if (!prereqId || !currentPos || !positions[prereqId]) return null;
    
    const prereqPos = positions[prereqId];
    
    // Calculate connection points
    const startX = prereqPos.x + prereqPos.width;
    const startY = prereqPos.y + prereqPos.height / 2;
    
    const endX = currentPos.x;
    const endY = isSecondPrereq 
      ? currentPos.y + currentPos.height * 3/4 
      : currentPos.y + currentPos.height / 4;
    
    const midX = startX + (endX - startX) / 2;
    
    return (
      <g>
        <path 
          d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
          stroke="#555555"
          strokeWidth="1"
          fill="none"
        />
      </g>
    );
  };
  
  // Render special connections for grand finals
  const renderGrandFinalsConnections = () => {
    const grandFinals = processedMatches.filter(m => m.isGrandFinal);
    if (grandFinals.length === 0) return null;
    
    const winnerFinals = processedMatches.find(m => 
      (m.bracket === 'WINNERS' || !m.bracket) && 
      m.next_match_id && 
      grandFinals.some(gf => gf.id === m.next_match_id)
    );
    
    const loserFinals = processedMatches.find(m => 
      m.bracket === 'LOSERS' && 
      m.next_match_id && 
      grandFinals.some(gf => gf.id === m.next_match_id)
    );
    
    if (!winnerFinals || !loserFinals) return null;
    
    const winnerFinalsPos = matchPositions[winnerFinals.id];
    const loserFinalsPos = matchPositions[loserFinals.id];
    const grandFinalsPos = matchPositions[grandFinals[0].id];
    
    if (!winnerFinalsPos || !loserFinalsPos || !grandFinalsPos) return null;
    
    return (
      <g>
        {/* Connection from winner finals to grand finals */}
        <path 
          d={`M ${winnerFinalsPos.x + winnerFinalsPos.width} ${winnerFinalsPos.y + winnerFinalsPos.height / 4} 
              L ${grandFinalsPos.x} ${grandFinalsPos.y + grandFinalsPos.height / 4}`}
          stroke="#555555"
          strokeWidth="1"
          fill="none"
        />
        
        {/* Connection from loser finals to grand finals */}
        <path 
          d={`M ${loserFinalsPos.x + loserFinalsPos.width} ${loserFinalsPos.y + loserFinalsPos.height / 2} 
              L ${(loserFinalsPos.x + loserFinalsPos.width + grandFinalsPos.x) / 2} ${loserFinalsPos.y + loserFinalsPos.height / 2}
              L ${(loserFinalsPos.x + loserFinalsPos.width + grandFinalsPos.x) / 2} ${grandFinalsPos.y + grandFinalsPos.height * 3/4}
              L ${grandFinalsPos.x} ${grandFinalsPos.y + grandFinalsPos.height * 3/4}`}
          stroke="#555555"
          strokeWidth="1"
          fill="none"
        />
      </g>
    );
  };

  // Render match boxes
  const renderMatch = (match: ExtendedMatch) => {
    const position = matchPositions[match.id];
    if (!position) return null;
    
    const isComplete = !!match.winner_id;
    const matchNumber = match.match_number || '';
    
    return (
      <g 
        key={`match-${match.id}`}
        transform={`translate(${position.x}, ${position.y})`}
        onClick={() => onMatchClick && onMatchClick(match)}
        style={{ cursor: onMatchClick ? 'pointer' : 'default' }}
      >
        {/* Match rectangle */}
        <rect 
          width={position.width} 
          height={position.height} 
          rx="2" 
          ry="2" 
          fill={CHALLONGE_MATCH_BG}
          stroke={CHALLONGE_MATCH_BORDER}
          strokeWidth="1"
        />
        
        {/* Match number */}
        <text
          x="5"
          y={position.height / 2}
          fontSize="10"
          fill="#777777"
          dominantBaseline="middle"
        >
          {matchNumber}
        </text>
        
        {/* Match participants */}
        <g>
          {/* Participant 1 area */}
          <rect
            x="18"
            width={position.width - 18}
            height={position.height / 2}
            fill={CHALLONGE_MATCH_P1_BG}
            strokeWidth="0"
          />
          
          {/* Seed box */}
          <rect
            x="18"
            width="18"
            height={position.height / 2}
            fill={CHALLONGE_SEED_BG}
          />
          
          {/* Seed number */}
          <text
            x="27"
            y={position.height / 4}
            fontSize="10"
            fill={CHALLONGE_TEXT}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {getParticipantSeed(match.participant1_id)}
          </text>
          
          {/* Participant name */}
          <text
            x="40"
            y={position.height / 4}
            fontSize="11"
            fontWeight={match.winner_id === match.participant1_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant1_id ? CHALLONGE_WINNER_TEXT : CHALLONGE_TEXT}
            textAnchor="start"
            dominantBaseline="middle"
            className="participant-name"
          >
            {getParticipantNameById(match.participant1_id)}
          </text>
          
          {/* Score box */}
          <rect
            x={position.width - 25}
            y="0"
            width="25"
            height={position.height / 2}
            fill={CHALLONGE_SEED_BG}
          />
          
          {/* Score */}
          <text
            x={position.width - 12.5}
            y={position.height / 4}
            fontSize="11"
            fontWeight={match.winner_id === match.participant1_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant1_id ? CHALLONGE_WINNER_TEXT : CHALLONGE_TEXT}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {match.score_participant1 ?? '-'}
          </text>
          
          {/* Participant 2 area */}
          <rect
            x="18"
            y={position.height / 2}
            width={position.width - 18}
            height={position.height / 2}
            fill={CHALLONGE_MATCH_P2_BG}
            strokeWidth="0"
          />
          
          {/* Seed box */}
          <rect
            x="18"
            y={position.height / 2}
            width="18"
            height={position.height / 2}
            fill={CHALLONGE_SEED_BG}
          />
          
          {/* Seed number */}
          <text
            x="27"
            y={position.height * 3/4}
            fontSize="10"
            fill={CHALLONGE_TEXT}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {getParticipantSeed(match.participant2_id)}
          </text>
          
          {/* Participant name */}
          <text
            x="40"
            y={position.height * 3/4}
            fontSize="11"
            fontWeight={match.winner_id === match.participant2_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant2_id ? CHALLONGE_WINNER_TEXT : CHALLONGE_TEXT}
            textAnchor="start"
            dominantBaseline="middle"
            className="participant-name"
          >
            {getParticipantNameById(match.participant2_id)}
          </text>
          
          {/* Score box */}
          <rect
            x={position.width - 25}
            y={position.height / 2}
            width="25"
            height={position.height / 2}
            fill={CHALLONGE_SEED_BG}
          />
          
          {/* Score */}
          <text
            x={position.width - 12.5}
            y={position.height * 3/4}
            fontSize="11"
            fontWeight={match.winner_id === match.participant2_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant2_id ? CHALLONGE_WINNER_TEXT : CHALLONGE_TEXT}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {match.score_participant2 ?? '-'}
          </text>
        </g>
      </g>
    );
  };

  // Render round headers
  const renderRoundLabels = () => {
    const winners = processedMatches.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const losers = processedMatches.filter(m => m.bracket === 'LOSERS');
    
    // Get unique rounds
    const winnerRounds = [...new Set(winners.map(m => m.round))].sort((a, b) => a - b);
    const loserRounds = [...new Set(losers.map(m => m.round))].sort((a, b) => a - b);
    
    return (
      <>
        {/* Winner round headers */}
        {winnerRounds.map(round => {
          const matchesInRound = winners.filter(m => m.round === round);
          if (matchesInRound.length === 0) return null;
          
          const firstMatch = matchPositions[matchesInRound[0].id];
          if (!firstMatch) return null;
          
          return (
            <text
              key={`winner-round-${round}`}
              x={firstMatch.x + (firstMatch.width / 2)}
              y="40"
              fontSize="12"
              textAnchor="middle"
              fill="#bbbbbb"
            >
              {tournament.format === 'DOUBLE_ELIMINATION' ? 
                `Round ${round}` : 
                round === winnerRounds.length ? 'Finals' : 
                round === winnerRounds.length - 1 ? 'Semifinals' : 
                `Round ${round}`}
            </text>
          );
        })}
        
        {/* Loser round headers */}
        {loserRounds.map(round => {
          const matchesInRound = losers.filter(m => m.round === round);
          if (matchesInRound.length === 0) return null;
          
          const firstMatch = matchPositions[matchesInRound[0].id];
          if (!firstMatch) return null;
          
          return (
            <text
              key={`loser-round-${round}`}
              x={firstMatch.x + (firstMatch.width / 2)}
              y={firstMatch.y - 15}
              fontSize="12"
              textAnchor="middle"
              fill="#bbbbbb"
            >
              {`Losers Round ${round}`}
            </text>
          );
        })}
        
        {/* Grand finals header */}
        {processedMatches.filter(m => m.isGrandFinal).length > 0 && (
          <text
            x={matchPositions[processedMatches.filter(m => m.isGrandFinal)[0].id]?.x + MATCH_WIDTH/2}
            y="40"
            fontSize="12"
            textAnchor="middle"
            fill="#bbbbbb"
          >
            Grand Finals
          </text>
        )}
      </>
    );
  };

  // Render bracket section headers (Winners/Losers)
  const renderBracketHeaders = () => {
    const winners = processedMatches.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const losers = processedMatches.filter(m => m.bracket === 'LOSERS');
    
    return (
      <>
        {tournament.format === 'DOUBLE_ELIMINATION' && (
          <>
            {winners.length > 0 && (
              <text 
                className="bracket-header"
                x="20" 
                y="18" 
                fontSize="14" 
                fontWeight="bold" 
                fill={CHALLONGE_ORANGE} 
              >
                Bracket
              </text>
            )}
            
            {losers.length > 0 && (
              <text 
                className="losers-header"
                x="20" 
                y={matchPositions[losers[0]?.id]?.y - 25 || 250}
                fontSize="14" 
                fontWeight="bold" 
                fill={CHALLONGE_ORANGE}
              >
                Losers Bracket
              </text>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <div className="challonge-bracket-container" style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <div className="bracket-controls bg-gray-800 p-3 rounded-lg flex justify-between items-center mb-3">
        <div className="bracket-title text-orange-500 font-bold">Bracket</div>
        <div className="bracket-actions flex gap-2">
          <button className="px-3 py-1 rounded-sm bg-gray-700 text-gray-300 text-sm hover:bg-gray-600">
            Full Bracket
          </button>
        </div>
      </div>
      
      <svg 
        ref={svgRef}
        width={containerWidth} 
        height={containerHeight}
        style={{ 
          backgroundColor: CHALLONGE_BG,
          borderRadius: '4px'
        }}
      >
        {/* Round headers */}
        {renderRoundLabels()}
        
        {/* Bracket section headers */}
        {renderBracketHeaders()}
        
        {/* Connection lines */}
        {renderConnectionLines()}
        
        {/* Grand finals connections */}
        {renderGrandFinalsConnections()}
        
        {/* Match boxes */}
        {processedMatches.map(match => renderMatch(match))}
      </svg>

      <style jsx>{`
        .challonge-bracket-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        /* Add styles for participant names to truncate with ellipsis */
        :global(.participant-name) {
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 100px;
        }
      `}</style>
    </div>
  );
};

export default ChallongeLikeBracket; 