import React, { useEffect, useState, useRef, ReactNode } from 'react';

// Defined tournament types (similar to what would be in @/types/tournament)
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
  next_match_id: string | null;
  loser_next_match_id: string | null;
  participant1_prereq_match_id: string | null;
  participant2_prereq_match_id: string | null;
  score_participant1: string | null;
  score_participant2: string | null;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  bracket_type?: string;
}

type TournamentFormat = 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION';

interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
}

type BracketType = 'WINNERS' | 'LOSERS' | null;

interface ExtendedMatch extends Match {
  isGrandFinal?: boolean;
  bracket?: BracketType;
  winner_source_match_id?: string | null;
  loser_source_match_id?: string | null;
}

interface DarkChallongeBracketProps {
  tournament: Tournament;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
}

const DarkChallongeBracket = ({ 
  tournament, 
  matches, 
  participants,
  onMatchClick
}: DarkChallongeBracketProps): ReactNode => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [processedMatches, setProcessedMatches] = useState<ExtendedMatch[]>([]);
  const [containerWidth, setContainerWidth] = useState(900);
  const [containerHeight, setContainerHeight] = useState(600);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number, y: number, width: number, height: number }>>({});
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Constants for layout - Challonge dimensions
  const MATCH_WIDTH = 160;
  const MATCH_HEIGHT = 40;
  const COLUMN_GAP = 80;
  const MATCH_SPACING = 20; // Vertical gap between matches in the same round
  
  useEffect(() => {
    // Process matches to add bracket types and other metadata
    const processed = prepareBracketData(matches, tournament.format, participants.length);
    setProcessedMatches(processed);
    
    // Calculate layout dimensions
    calculateLayout(processed);
    
    // Handle window resize
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [matches, tournament, participants]);

  const calculateLayout = (processed: ExtendedMatch[]) => {
    // Get winners and losers brackets
    const winners = processed.filter(m => m.bracket === 'WINNERS' || !m.bracket);
    const losers = processed.filter(m => m.bracket === 'LOSERS');
    const grandFinals = processed.filter(m => m.isGrandFinal);
    
    // Find max rounds
    const winnersMaxRound = Math.max(0, ...winners.map(m => m.round));
    const losersMaxRound = losers.length > 0 ? Math.max(0, ...losers.map(m => m.round)) : 0;
    
    // Calculate required width
    const totalRounds = Math.max(winnersMaxRound, losersMaxRound) + (grandFinals.length > 0 ? 1 : 0);
    const width = totalRounds * (MATCH_WIDTH + COLUMN_GAP) + 60; // Added padding
    
    // Calculate match positions
    const positions: Record<string, { x: number, y: number, width: number, height: number }> = {};
    
    // Position winners bracket
    let maxWinnersY = 0;
    winners.forEach(match => {
      if (match.isGrandFinal) return; // Skip grand finals for now
      
      const matchesInRound = winners.filter(m => m.round === match.round && !m.isGrandFinal);
      const matchIndex = matchesInRound.findIndex(m => m.id === match.id);
      
      // Calculate spacing between matches in this round
      const totalMatches = Math.pow(2, winnersMaxRound - match.round + 1) / 2;
      const roundSpacing = totalMatches <= 1 ? MATCH_SPACING : MATCH_SPACING * Math.pow(2, match.round - 1);
      
      // Calculate vertical spread based on round number
      const yMultiplier = Math.pow(2, winnersMaxRound - match.round);
      
      // Calculate y position with Challonge-style spacing
      const yPosition = 60 + matchIndex * (MATCH_HEIGHT + roundSpacing) * yMultiplier;
      
      positions[match.id] = {
        x: (match.round - 1) * (MATCH_WIDTH + COLUMN_GAP) + 30,
        y: yPosition,
        width: MATCH_WIDTH,
        height: MATCH_HEIGHT
      };
      
      maxWinnersY = Math.max(maxWinnersY, yPosition + MATCH_HEIGHT);
    });
    
    // Position losers bracket
    if (losers.length > 0) {
      const losersYStart = maxWinnersY + 80; // Gap between winners and losers bracket
      
      // Group losers matches by round
      const loserRounds = [...new Set(losers.map(m => m.round))].sort((a, b) => a - b);
      
      loserRounds.forEach((round, roundIndex) => {
        const matchesInRound = losers.filter(m => m.round === round);
        
        matchesInRound.forEach((match, matchIndex) => {
          // For each losers round, calculate an appropriate vertical spread
          // In Challonge, losers rounds are more compact than winners bracket
          const yPosition = losersYStart + matchIndex * (MATCH_HEIGHT + MATCH_SPACING);
          
          positions[match.id] = {
            x: (round - 1) * (MATCH_WIDTH + COLUMN_GAP) + 30,
            y: yPosition,
            width: MATCH_WIDTH,
            height: MATCH_HEIGHT
          };
        });
      });
    }
    
    // Position grand finals
    if (grandFinals.length > 0) {
      const finalRound = Math.max(winnersMaxRound, losersMaxRound) + 1;
      const finalXPosition = (finalRound - 1) * (MATCH_WIDTH + COLUMN_GAP) + 30;
      const finalYPosition = 60 + Math.pow(2, winnersMaxRound - 1) * (MATCH_HEIGHT + MATCH_SPACING) * 0.5 - MATCH_HEIGHT / 2;
      
      grandFinals.forEach((match, idx) => {
        positions[match.id] = {
          x: finalXPosition,
          y: finalYPosition + idx * (MATCH_HEIGHT + MATCH_SPACING),
          width: MATCH_WIDTH,
          height: MATCH_HEIGHT
        };
      });
    }
    
    // Calculate container dimensions
    const maxY = Math.max(0, ...Object.values(positions).map(p => p.y + p.height));
    setContainerWidth(width);
    setContainerHeight(maxY + 60);
    setMatchPositions(positions);
  };

  // Prepare bracket data by adding bracket types and other metadata
  const prepareBracketData = (
    initialMatches: Match[], 
    tournamentFormat: TournamentFormat | undefined,
    numParticipants: number
  ): ExtendedMatch[] => {
    if (!tournamentFormat) return initialMatches as ExtendedMatch[];
    
    // First pass - identify bracket types
    const withBrackets = initialMatches.map(match => {
      const extended: ExtendedMatch = { ...match };
      
      // Set default properties
      extended.bracket = null;
      extended.isGrandFinal = false;
      extended.winner_source_match_id = null;
      extended.loser_source_match_id = null;
      
      // Assign bracket types based on tournament format
      if (tournamentFormat === 'SINGLE_ELIMINATION') {
        extended.bracket = 'WINNERS';
      } else if (tournamentFormat === 'DOUBLE_ELIMINATION') {
        if (match.round >= 999) {
          extended.isGrandFinal = true;
          extended.bracket = 'WINNERS';
        } else if (match.bracket_type) {
          extended.bracket = match.bracket_type as BracketType;
        } else {
          // In DOUBLE_ELIMINATION, try to infer bracket type
          // This is a simplified heuristic - real tournaments might need more complex logic
          const maxWinnersRound = Math.ceil(Math.log2(numParticipants));
          
          if (match.round <= maxWinnersRound) {
            extended.bracket = 'WINNERS';
          } else {
            extended.bracket = 'LOSERS';
          }
        }
      }
      
      return extended;
    });
    
    // Second pass - establish connections between matches
    const withConnections = withBrackets.map(match => {
      const result = { ...match };
      
      // Find matches that feed into this one
      initialMatches.forEach(potentialSource => {
        // Winner feeds into this match
        if (potentialSource.next_match_id === match.id) {
          result.winner_source_match_id = potentialSource.id;
        }
        
        // Loser feeds into this match (for losers bracket)
        if (potentialSource.loser_next_match_id === match.id) {
          result.loser_source_match_id = potentialSource.id;
        }
      });
      
      return result;
    });
    
    // Third pass - grand finals detection
    if (tournamentFormat === 'DOUBLE_ELIMINATION') {
      // Find winners and losers finals
      const winnersFinal = withConnections.find(m => 
        m.bracket === 'WINNERS' && 
        !m.next_match_id && 
        !m.isGrandFinal &&
        withConnections.every(other => 
          other.bracket === 'WINNERS' && 
          other.id !== m.id ? 
          other.round <= m.round : true
        )
      );
      
      const losersFinal = withConnections.find(m => 
        m.bracket === 'LOSERS' && 
        !m.next_match_id &&
        withConnections.every(other => 
          other.bracket === 'LOSERS' && 
          other.id !== m.id ? 
          other.round <= m.round : true
        )
      );
      
      // Find or create grand finals
      let grandFinal = withConnections.find(m => m.isGrandFinal);
      
      if (!grandFinal && winnersFinal && losersFinal) {
        // If we don't have an explicit grand final but have winners and losers finals,
        // we can create a virtual grand final for visualization purposes
        const virtualGrandFinal: ExtendedMatch = {
          ...winnersFinal,
          id: 'virtual-grand-final',
          match_number: 9999,
          round: Math.max(winnersFinal.round, losersFinal.round) + 1,
          isGrandFinal: true,
          participant1_id: winnersFinal.winner_id,
          participant2_id: losersFinal.winner_id,
          winner_id: null,
          next_match_id: null,
          loser_next_match_id: null,
          status: 'PENDING',
          score_participant1: null,
          score_participant2: null
        };
        
        withConnections.push(virtualGrandFinal);
      }
    }
    
    return withConnections;
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

  // Draw connection lines between matches
  const renderConnectionLines = () => {
    const lines: React.ReactElement[] = [];
    
    processedMatches.forEach(match => {
      // Only render connections if both source and target positions are known
      if (match.id in matchPositions) {
        // Winner connections (next_match_id)
        if (match.next_match_id && matchPositions[match.next_match_id]) {
          const source = matchPositions[match.id];
          const target = matchPositions[match.next_match_id];
          
          // Draw path from source to target
          const sourceX = source.x + source.width;
          const sourceY = source.y + source.height / 2;
          const targetX = target.x;
          const targetY = target.y + target.height / 2;
          const midX = sourceX + (targetX - sourceX) / 2;
          
          lines.push(
            <path
              key={`winner-${match.id}-${match.next_match_id}`}
              d={`M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`}
              stroke="#4d4d4d"
              strokeWidth="1.5"
              fill="none"
            />
          );
        }
        
        // Loser connections (loser_next_match_id)
        if (match.loser_next_match_id && matchPositions[match.loser_next_match_id]) {
          const source = matchPositions[match.id];
          const target = matchPositions[match.loser_next_match_id];
          
          // Draw path from source to target
          const sourceX = source.x + source.width / 2;
          const sourceY = source.y + source.height;
          const targetX = target.x + target.width / 2;
          const targetY = target.y;
          
          lines.push(
            <path
              key={`loser-${match.id}-${match.loser_next_match_id}`}
              d={`M ${sourceX} ${sourceY} V ${(sourceY + targetY) / 2} H ${targetX} V ${targetY}`}
              stroke="#ff4444"
              strokeWidth="1.5"
              fill="none"
              strokeDasharray="4,2"
            />
          );
        }
      }
    });
    
    return lines;
  };

  // Render a single match
  const renderMatch = (match: ExtendedMatch) => {
    if (!(match.id in matchPositions)) return null;
    
    const position = matchPositions[match.id];
    const isCompleted = match.status === 'COMPLETED';
    const isPending = match.status === 'PENDING';
    const isInProgress = match.status === 'IN_PROGRESS';
    
    const participant1Seed = getParticipantSeed(match.participant1_id);
    const participant2Seed = getParticipantSeed(match.participant2_id);
    
    return (
      <g
        key={match.id}
        transform={`translate(${position.x}, ${position.y})`}
        onClick={() => onMatchClick && onMatchClick(match)}
        style={{ cursor: 'pointer' }}
      >
        {/* Match box */}
        <rect
          x="0"
          y="0"
          width={position.width}
          height={position.height}
          fill="#333333"
          stroke="#444444"
          strokeWidth="1"
          rx="2"
          ry="2"
        />
        
        {/* Match number */}
        <text 
          x="5" 
          y={position.height / 2} 
          fontSize="10" 
          fill="#888888" 
          dominantBaseline="middle"
        >
          {match.match_number}
        </text>
        
        {/* Divider line */}
        <line
          x1="0"
          y1={position.height / 2}
          x2={position.width}
          y2={position.height / 2}
          stroke="#444444"
          strokeWidth="1"
        />
        
        {/* Participant 1 */}
        <g>
          {/* Seed box */}
          <rect
            x="20"
            y="0"
            width="16"
            height={position.height / 2}
            fill="#444444"
          />
          
          {/* Seed number */}
          {participant1Seed && (
            <text
              x="28"
              y={position.height / 4}
              fontSize="10"
              fill="#bbbbbb"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {participant1Seed}
            </text>
          )}
          
          {/* Participant name */}
          <text
            x="40"
            y={position.height / 4}
            fontSize="11"
            fill={match.winner_id === match.participant1_id ? "#ffffff" : "#bbbbbb"}
            dominantBaseline="middle"
            fontWeight={match.winner_id === match.participant1_id ? "bold" : "normal"}
          >
            {getParticipantNameById(match.participant1_id)}
          </text>
          
          {/* Score box */}
          <rect
            x={position.width - 30}
            y="0"
            width="30"
            height={position.height / 2}
            fill="#444444"
          />
          
          {/* Score */}
          <text
            x={position.width - 15}
            y={position.height / 4}
            fontSize="11"
            fill={match.winner_id === match.participant1_id ? "#ffffff" : "#bbbbbb"}
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight={match.winner_id === match.participant1_id ? "bold" : "normal"}
          >
            {match.score_participant1 || '-'}
          </text>
        </g>
        
        {/* Participant 2 */}
        <g>
          {/* Seed box */}
          <rect
            x="20"
            y={position.height / 2}
            width="16"
            height={position.height / 2}
            fill="#444444"
          />
          
          {/* Seed number */}
          {participant2Seed && (
            <text
              x="28"
              y={position.height * 3/4}
              fontSize="10"
              fill="#bbbbbb"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {participant2Seed}
            </text>
          )}
          
          {/* Participant name */}
          <text
            x="40"
            y={position.height * 3/4}
            fontSize="11"
            fill={match.winner_id === match.participant2_id ? "#ffffff" : "#bbbbbb"}
            dominantBaseline="middle"
            fontWeight={match.winner_id === match.participant2_id ? "bold" : "normal"}
          >
            {getParticipantNameById(match.participant2_id)}
          </text>
          
          {/* Score box */}
          <rect
            x={position.width - 30}
            y={position.height / 2}
            width="30"
            height={position.height / 2}
            fill="#444444"
          />
          
          {/* Score */}
          <text
            x={position.width - 15}
            y={position.height * 3/4}
            fontSize="11"
            fill={match.winner_id === match.participant2_id ? "#ffffff" : "#bbbbbb"}
            textAnchor="middle"
            dominantBaseline="middle"
            fontWeight={match.winner_id === match.participant2_id ? "bold" : "normal"}
          >
            {match.score_participant2 || '-'}
          </text>
        </g>
      </g>
    );
  };

  // Render round headers
  const renderRoundHeaders = () => {
    // Get unique rounds for winners and losers brackets
    const winnersMatches = processedMatches.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const losersMatches = processedMatches.filter(m => m.bracket === 'LOSERS');
    const grandFinals = processedMatches.filter(m => m.isGrandFinal);
    
    const winnerRounds = [...new Set(winnersMatches.map(m => m.round))].sort((a, b) => a - b);
    const loserRounds = [...new Set(losersMatches.map(m => m.round))].sort((a, b) => a - b);
    
    const headers: React.ReactElement[] = [];
    
    // Render winners bracket headers
    winnerRounds.forEach(round => {
      const matchesInRound = winnersMatches.filter(m => m.round === round);
      if (matchesInRound.length === 0 || !(matchesInRound[0].id in matchPositions)) return;
      
      const x = matchPositions[matchesInRound[0].id].x + MATCH_WIDTH / 2;
      
      let roundName: string;
      if (tournament.format === 'DOUBLE_ELIMINATION') {
        roundName = `Round ${round}`;
      } else {
        // For single elimination, use more descriptive names for final rounds
        if (round === winnerRounds.length) {
          roundName = 'Finals';
        } else if (round === winnerRounds.length - 1) {
          roundName = 'Semifinals';
        } else if (round === winnerRounds.length - 2) {
          roundName = 'Quarterfinals';
        } else {
          roundName = `Round ${round}`;
        }
      }
      
      headers.push(
        <text
          key={`header-winners-${round}`}
          x={x}
          y="30"
          fontSize="12"
          fill="#bbbbbb"
          textAnchor="middle"
        >
          {roundName}
        </text>
      );
    });
    
    // Render losers bracket headers
    loserRounds.forEach(round => {
      const matchesInRound = losersMatches.filter(m => m.round === round);
      if (matchesInRound.length === 0 || !(matchesInRound[0].id in matchPositions)) return;
      
      const position = matchPositions[matchesInRound[0].id];
      const x = position.x + MATCH_WIDTH / 2;
      const y = position.y - 15;
      
      headers.push(
        <text
          key={`header-losers-${round}`}
          x={x}
          y={y}
          fontSize="12"
          fill="#bbbbbb"
          textAnchor="middle"
        >
          {`Losers Round ${round}`}
        </text>
      );
    });
    
    // Render grand finals header
    if (grandFinals.length > 0 && grandFinals[0].id in matchPositions) {
      const position = matchPositions[grandFinals[0].id];
      const x = position.x + MATCH_WIDTH / 2;
      
      headers.push(
        <text
          key="header-grand-finals"
          x={x}
          y="30"
          fontSize="12"
          fill="#bbbbbb"
          textAnchor="middle"
        >
          Finals
        </text>
      );
    }
    
    return headers;
  };

  // Render bracket sections (Winners/Losers)
  const renderBracketSections = () => {
    const sections: React.ReactElement[] = [];
    
    // Only add explicit section headers for double elimination
    if (tournament.format === 'DOUBLE_ELIMINATION') {
      // Winners bracket header
      sections.push(
        <text
          key="section-winners"
          x="10"
          y="30"
          fontSize="14"
          fill="#f89406"
          fontWeight="bold"
        >
          Bracket
        </text>
      );
      
      // Losers bracket header
      const losersMatches = processedMatches.filter(m => m.bracket === 'LOSERS');
      if (losersMatches.length > 0 && losersMatches[0].id in matchPositions) {
        const firstLosersMatch = matchPositions[losersMatches[0].id];
        
        sections.push(
          <text
            key="section-losers"
            x="10"
            y={firstLosersMatch.y - 15}
            fontSize="14"
            fill="#f89406"
            fontWeight="bold"
          >
            Losers Round 1
          </text>
        );
      }
    }
    
    return sections;
  };

  // Handle zoom interactions
  const handleZoom = (factor: number) => {
    setScale(prevScale => Math.min(Math.max(0.5, prevScale * factor), 2));
  };

  // Handle pan interactions
  const handlePan = (dx: number, dy: number) => {
    setPan(prevPan => ({ x: prevPan.x + dx, y: prevPan.y + dy }));
  };

  // Reset zoom and pan
  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
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
          backgroundColor: '#2d2d2d',
          borderRadius: '4px'
        }}
      >
        {renderRoundHeaders()}
        {renderConnectionLines()}
        {processedMatches.map(match => renderMatch(match))}
      </svg>

      <style jsx>{`
        .challonge-bracket-container {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        }
        
        :global(.participant-name) {
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
          max-width: 90px;
        }
      `}</style>
    </div>
  );
};

export default DarkChallongeBracket;