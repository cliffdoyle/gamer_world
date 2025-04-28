import React, { useEffect, useState, useRef } from 'react';
import { Match, Tournament, Participant, TournamentFormat } from '@/types/tournament';

type BracketType = 'WINNERS' | 'LOSERS' | null;

interface ExtendedMatch extends Match {
  isGrandFinal?: boolean;
  bracket?: BracketType;
}

interface DarkChallongeBracketProps {
  tournament: Tournament;
  matches: Match[];
  participants: Participant[];
  onMatchClick?: (match: Match) => void;
}

const DarkChallongeBracket: React.FC<DarkChallongeBracketProps> = ({ 
  tournament, 
  matches, 
  participants,
  onMatchClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [processedMatches, setProcessedMatches] = useState<ExtendedMatch[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [matchPositions, setMatchPositions] = useState<Record<string, { x: number, y: number, width: number, height: number }>>({});

  // Constants for layout - Challonge dimensions
  const MATCH_WIDTH = 160;
  const MATCH_HEIGHT = 40;
  const COLUMN_GAP = 40;
  const MATCH_SPACING = 15; // Vertical gap between matches
  
  useEffect(() => {
    // Process matches to add bracket types and other metadata
    const processed = prepareBracketData(matches, tournament.format);
    setProcessedMatches(processed);
    
    // Calculate layout dimensions
    calculateLayout(processed);
  }, [matches, tournament, participants]);

  const calculateLayout = (processed: ExtendedMatch[]) => {
    // Get winners and losers brackets
    const winners = processed.filter(m => m.bracket === 'WINNERS' || !m.bracket);
    const losers = processed.filter(m => m.bracket === 'LOSERS');
    const grandFinals = processed.filter(m => m.isGrandFinal);
    
    // Find max rounds
    const winnersMaxRound = Math.max(...winners.map(m => m.round), 0);
    const losersMaxRound = Math.max(...losers.map(m => m.round), 0);
    
    // Calculate required width
    const width = Math.max(
      winners.length > 0 ? (winnersMaxRound * (MATCH_WIDTH + COLUMN_GAP)) : 0,
      losers.length > 0 ? (losersMaxRound * (MATCH_WIDTH + COLUMN_GAP)) : 0
    ) + (grandFinals.length > 0 ? MATCH_WIDTH + COLUMN_GAP : 0);
    
    // Calculate match positions
    const positions: Record<string, { x: number, y: number, width: number, height: number }> = {};
    
    // Position winners bracket
    winners.forEach(match => {
      const matchesInRound = winners.filter(m => m.round === match.round);
      const matchIndex = matchesInRound.findIndex(m => m.id === match.id);
      
      // Calculate spacing between matches in this round
      const spacing = MATCH_SPACING * Math.pow(2, winnersMaxRound - match.round);
      
      // Calculate y position with Challonge-style spacing
      const yPosition = 40 + matchIndex * (MATCH_HEIGHT + spacing);
      
      positions[match.id] = {
        x: (match.round - 1) * (MATCH_WIDTH + COLUMN_GAP) + 20,
        y: yPosition,
        width: MATCH_WIDTH,
        height: MATCH_HEIGHT
      };
    });
    
    // Position losers bracket
    const winnersBracketHeight = winners.length > 0 
      ? Math.max(...winners.map(m => positions[m.id]?.y + positions[m.id]?.height || 0))
      : 0;
    
    const losersYStart = winnersBracketHeight + 50;
    
    losers.forEach(match => {
      const matchesInRound = losers.filter(m => m.round === match.round);
      const matchIndex = matchesInRound.findIndex(m => m.id === match.id);
      
      // Calculate spacing between matches in this round
      const spacing = MATCH_SPACING * Math.pow(1.5, losersMaxRound - match.round);
      
      // Calculate y position with proper spacing
      const yPosition = losersYStart + matchIndex * (MATCH_HEIGHT + spacing);
      
      positions[match.id] = {
        x: (match.round - 1) * (MATCH_WIDTH + COLUMN_GAP) + 20,
        y: yPosition,
        width: MATCH_WIDTH,
        height: MATCH_HEIGHT
      };
    });
    
    // Position grand finals
    if (grandFinals.length > 0) {
      const gfXPosition = width - MATCH_WIDTH - 20;
      const midPoint = (winnersBracketHeight / 2) - (MATCH_HEIGHT / 2);
      
      grandFinals.forEach((match, idx) => {
        positions[match.id] = {
          x: gfXPosition,
          y: midPoint + (idx * (MATCH_HEIGHT + 20)),
          width: MATCH_WIDTH,
          height: MATCH_HEIGHT
        };
      });
    }
    
    // Calculate container dimensions
    const maxY = Object.values(positions).reduce((max, pos) => Math.max(max, pos.y + pos.height), 0);
    setContainerWidth(width + 40);
    setContainerHeight(maxY + 40);
    setMatchPositions(positions);
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

  // Draw connection lines between matches
  const renderConnectionLines = () => {
    return processedMatches.filter(match => match.next_match_id).map(match => {
      const nextMatch = findMatch(match.next_match_id);
      if (!nextMatch || !matchPositions[match.id] || !matchPositions[nextMatch.id]) return null;
      
      const source = matchPositions[match.id];
      const target = matchPositions[nextMatch.id];
      
      // Calculate connection points
      const sourceX = source.x + source.width;
      const sourceY = source.y + (source.height / 2);
      const targetX = target.x;
      const targetY = target.y + (target.height / 2);
      
      // Create Challonge-style horizontal and vertical lines
      const midX = sourceX + (targetX - sourceX) / 2;
      
      return (
        <path
          key={`connection-${match.id}-${nextMatch.id}`}
          d={`M ${sourceX} ${sourceY} H ${midX} V ${targetY} H ${targetX}`}
          stroke="#4d4d4d"
          strokeWidth="1"
          fill="none"
        />
      );
    });
  };

  // Draw grand finals connections
  const renderGrandFinalsConnections = () => {
    const grandFinals = processedMatches.filter(m => m.isGrandFinal);
    if (grandFinals.length === 0) return null;
    
    const winnersBracket = processedMatches.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const losersBracket = processedMatches.filter(m => m.bracket === 'LOSERS');
    
    if (winnersBracket.length === 0 || losersBracket.length === 0) return null;
    
    const winnersFinalsMatch = winnersBracket.reduce((latest, match) => 
      (!latest || match.round > latest.round) ? match : latest, winnersBracket[0]);
      
    const losersFinalsMatch = losersBracket.reduce((latest, match) => 
      (!latest || match.round > latest.round) ? match : latest, losersBracket[0]);
    
    const grandFinalMatch = grandFinals[0];
    
    if (!matchPositions[winnersFinalsMatch.id] || !matchPositions[losersFinalsMatch.id] || !matchPositions[grandFinalMatch.id]) {
      return null;
    }
    
    const winnersSource = matchPositions[winnersFinalsMatch.id];
    const losersSource = matchPositions[losersFinalsMatch.id];
    const target = matchPositions[grandFinalMatch.id];
    
    return (
      <>
        {/* Winners finals to grand finals */}
        <path
          d={`M ${winnersSource.x + winnersSource.width} ${winnersSource.y + (winnersSource.height / 2)} 
              H ${target.x - 10} V ${target.y + (target.height / 3)} H ${target.x}`}
          stroke="#4d4d4d"
          strokeWidth="1"
          fill="none"
        />
        
        {/* Losers finals to grand finals */}
        <path
          d={`M ${losersSource.x + losersSource.width} ${losersSource.y + (losersSource.height / 2)} 
              H ${target.x - 10} V ${target.y + (2 * target.height / 3)} H ${target.x}`}
          stroke="#4d4d4d"
          strokeWidth="1"
          fill="none"
        />
      </>
    );
  };

  // Render a single match in the exact Challonge dark theme style
  const renderMatch = (match: ExtendedMatch) => {
    const position = matchPositions[match.id];
    if (!position) return null;
    
    const isCompleted = match.status === 'COMPLETED';
    const matchNumber = match.match_number;
    const participant1Seed = getParticipantSeed(match.participant1_id);
    const participant2Seed = getParticipantSeed(match.participant2_id);
    
    return (
      <g
        key={match.id}
        transform={`translate(${position.x}, ${position.y})`}
        onClick={() => onMatchClick && onMatchClick(match)}
        style={{ cursor: 'pointer' }}
      >
        {/* Background */}
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
          textAnchor="start"
          dominantBaseline="middle"
        >
          {matchNumber}
        </text>
        
        {/* Divider between participants */}
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
            textAnchor="start"
            dominantBaseline="middle"
            className="participant-name"
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
            fontWeight={match.winner_id === match.participant1_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant1_id ? "#ffffff" : "#bbbbbb"}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {match.score_participant1 ?? '-'}
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
            textAnchor="start"
            dominantBaseline="middle"
            className="participant-name"
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
            fontWeight={match.winner_id === match.participant2_id ? "bold" : "normal"}
            fill={match.winner_id === match.participant2_id ? "#ffffff" : "#bbbbbb"}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {match.score_participant2 ?? '-'}
          </text>
        </g>
      </g>
    );
  };

  // Render section headers (Main bracket, Losers bracket, etc.)
  const renderSectionHeaders = () => {
    const winners = processedMatches.filter(m => (m.bracket === 'WINNERS' || !m.bracket) && !m.isGrandFinal);
    const losers = processedMatches.filter(m => m.bracket === 'LOSERS');
    
    // Get unique rounds
    const winnerRounds = [...new Set(winners.map(m => m.round))].sort((a, b) => a - b);
    const loserRounds = [...new Set(losers.map(m => m.round))].sort((a, b) => a - b);
    
    return (
      <>
        {/* Main bracket header */}
        {tournament.format === 'DOUBLE_ELIMINATION' ? (
          <text x="10" y="24" fontSize="13" fontWeight="bold" fill="#f89406">Bracket</text>
        ) : null}
        
        {/* Round headers for winners bracket */}
        {winnerRounds.map(round => {
          const matchesInRound = winners.filter(m => m.round === round);
          if (matchesInRound.length === 0 || !matchPositions[matchesInRound[0].id]) return null;
          
          return (
            <text
              key={`round-header-${round}`}
              x={matchPositions[matchesInRound[0].id].x + MATCH_WIDTH/2}
              y="24"
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
        
        {/* Losers bracket header */}
        {loserRounds.length > 0 && losers.length > 0 && matchPositions[losers[0].id] ? (
          <>
            <text 
              x="10" 
              y={matchPositions[losers[0].id].y - 15} 
              fontSize="13" 
              fontWeight="bold" 
              fill="#f89406"
            >
              Losers Round 1
            </text>
            
            {/* Losers round headers */}
            {loserRounds.map(round => {
              const matchesInRound = losers.filter(m => m.round === round);
              if (matchesInRound.length === 0 || !matchPositions[matchesInRound[0].id]) return null;
              
              return (
                <text
                  key={`losers-round-header-${round}`}
                  x={matchPositions[matchesInRound[0].id].x + MATCH_WIDTH/2}
                  y={matchPositions[matchesInRound[0].id].y - 15}
                  fontSize="12"
                  textAnchor="middle"
                  fill="#bbbbbb"
                >
                  Losers Round {round}
                </text>
              );
            })}
          </>
        ) : null}
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
          backgroundColor: '#2d2d2d',
          borderRadius: '4px'
        }}
      >
        {/* Section headers */}
        {renderSectionHeaders()}
        
        {/* Connection lines */}
        {renderConnectionLines()}
        
        {/* Grand finals connections */}
        {renderGrandFinalsConnections()}
        
        {/* Matches */}
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