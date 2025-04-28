import React from 'react';
import { Match, Tournament, Participant, TournamentFormat } from '@/types/tournament';

type BracketType = 'WINNERS' | 'LOSERS' | null;

interface ExtendedMatch extends Match {
  isGrandFinal?: boolean;
  bracket?: BracketType;
}

interface BracketViewerProps {
  tournament: Tournament;
  matches: Match[];
  participants: Participant[];
}

const BracketViewer: React.FC<BracketViewerProps> = ({ tournament, matches, participants }) => {
  // State for bracket visualization data
  const [processedMatches, setProcessedMatches] = React.useState<ExtendedMatch[]>([]);
  const [regularWinnersMatches, setRegularWinnersMatches] = React.useState<ExtendedMatch[]>([]);
  const [losersMatches, setLosersMatches] = React.useState<ExtendedMatch[]>([]);
  const [grandFinalMatches, setGrandFinalMatches] = React.useState<ExtendedMatch[]>([]);
  const [maxRound, setMaxRound] = React.useState(0);

  React.useEffect(() => {
    // Process bracket data when matches are updated
    const processed = prepareBracketData(matches, tournament.format);
    setProcessedMatches(processed);
    
    // Separate matches by bracket type
    const winners = processed.filter(m => m.bracket === 'WINNERS' || !m.bracket);
    const losers = processed.filter(m => m.bracket === 'LOSERS');
    const finals = processed.filter(m => m.isGrandFinal === true);
    const regularWinners = winners.filter(m => m.isGrandFinal !== true);
    
    setRegularWinnersMatches(regularWinners);
    setLosersMatches(losers);
    setGrandFinalMatches(finals);
    
    // Calculate max round for spacing
    const winnersMaxRound = Math.max(...regularWinners.map(m => m.round), 0);
    const losersMaxRound = Math.max(...losers.map(m => m.round), 0);
    setMaxRound(Math.max(winnersMaxRound, losersMaxRound) + (finals.length > 0 ? 1 : 0));
  }, [matches, tournament.format]);

  // Function to get participant name by ID
  const getParticipantNameById = (id: string | null) => {
    if (!id) return 'TBD';
    const participant = participants.find(p => p.id === id);
    return participant ? (participant.participant_name || 'Unnamed') : 'TBD';
  };

  // Find match that this match flows into
  const findNextMatch = (matchId: string | null): ExtendedMatch | undefined => {
    if (!matchId) return undefined;
    return processedMatches.find(m => m.id === matchId);
  };

  // Calculate positioning info for connections between matches
  const getConnectionPositions = (match: ExtendedMatch, round: number): { index: number; spacing: number } => {
    const matchesInRound = processedMatches.filter(m => m.round === round && m.bracket === match.bracket);
    const index = matchesInRound.findIndex(m => m.id === match.id);
    const spacing = Math.pow(2, maxRound - round) * 20;
    return { index, spacing };
  };

  // Prepare bracket data by ensuring proper bracket assignments
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

  // Function to create connection lines to the grand final
  const renderGrandFinalConnections = () => {
    if (grandFinalMatches.length === 0) return null;
    
    // Calculate connection points
    const grandFinal = grandFinalMatches[0];
    const winnersFinalMatch = regularWinnersMatches.find(m => 
      m.round === Math.max(...regularWinnersMatches.map(m => m.round)) && 
      m.winner_id === grandFinal.participant1_id
    );
    
    const losersFinalMatch = losersMatches.find(m => 
      m.round === Math.max(...losersMatches.map(m => m.round)) && 
      m.winner_id === grandFinal.participant2_id
    );
    
    const winnersMaxRound = Math.max(...regularWinnersMatches.map(m => m.round), 0);
    const losersMaxRound = Math.max(...losersMatches.map(m => m.round), 0);
    
    const rightEdge = maxRound * 220;
    const grandFinalLeft = rightEdge - 220;
    
    return (
      <>
        {/* Winner's bracket connection */}
        {winnersFinalMatch && (
          <svg className="absolute" style={{ 
            zIndex: 1, 
            pointerEvents: 'none',
            top: '80px',
            left: 0,
            width: '100%',
            height: '100%'
          }}>
            <path 
              d={`M ${winnersMaxRound * 220 - 20} 100 
                  H ${grandFinalLeft - 50} 
                  V 180 
                  H ${grandFinalLeft - 10}`}
              stroke="#94a3b8"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        )}
        
        {/* Loser's bracket connection */}
        {losersFinalMatch && (
          <svg className="absolute" style={{ 
            zIndex: 1, 
            pointerEvents: 'none',
            top: '80px',
            left: 0,
            width: '100%',
            height: '100%'
          }}>
            <path 
              d={`M ${losersMaxRound * 220 - 20} 320 
                  H ${grandFinalLeft - 50} 
                  V 220 
                  H ${grandFinalLeft - 10}`}
              stroke="#94a3b8"
              strokeWidth="2"
              fill="none"
            />
          </svg>
        )}
      </>
    );
  };

  // Render grand finals at the far right
  const renderGrandFinalsSection = () => {
    if (grandFinalMatches.length === 0) return null;
    
    return (
      <div className="absolute" style={{ 
        right: '20px', 
        top: '120px', 
        width: '200px',
        zIndex: 10
      }}>
        {grandFinalMatches.map(match => (
          <div key={match.id} className="border-2 border-yellow-300 rounded-lg bg-white p-3 shadow-lg">
            <div className="flex justify-between items-center border-b pb-2 mb-2">
              <span className="text-sm font-medium text-yellow-700">
                Grand Finals
              </span>
              <span className={`text-xs px-2 py-1 rounded ${
                match.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-600'
              }`}>
                {match.status || 'PENDING'}
              </span>
            </div>
            
            <div className="flex flex-col justify-between">
              <div className={`flex justify-between items-center py-2 ${
                match.winner_id === match.participant1_id ? 'font-bold bg-green-50 rounded px-2' : ''
              }`}>
                <span className="text-sm" title={getParticipantNameById(match.participant1_id)}>
                  {getParticipantNameById(match.participant1_id)}
                </span>
                <span className="bg-gray-50 px-2 py-1 rounded">
                  {match.score_participant1 ?? '-'}
                </span>
              </div>
              
              <div className="border-t border-gray-200 my-2"></div>
              
              <div className={`flex justify-between items-center py-2 ${
                match.winner_id === match.participant2_id ? 'font-bold bg-green-50 rounded px-2' : ''
              }`}>
                <span className="text-sm" title={getParticipantNameById(match.participant2_id)}>
                  {getParticipantNameById(match.participant2_id)}
                </span>
                <span className="bg-gray-50 px-2 py-1 rounded">
                  {match.score_participant2 ?? '-'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render a section of the bracket (winners or losers)
  const renderBracketSection = (bracketMatches: ExtendedMatch[], title: string, isLosers: boolean = false) => {
    if (bracketMatches.length === 0) return null;
    
    const bracketMaxRound = Math.max(...bracketMatches.map(m => m.round));
    
    return (
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-gray-100 rounded-md shadow-sm">
          {title}
        </h3>
        
        <div className="overflow-auto">
          <div className="flex" style={{ minWidth: `${bracketMaxRound * 220}px`, position: 'relative' }}>
            {/* Draw connection lines between matches */}
            <svg 
              className="absolute top-0 left-0 w-full h-full" 
              style={{ zIndex: 1, pointerEvents: 'none' }}
            >
              {bracketMatches.filter(match => match.next_match_id).map(match => {
                const nextMatch = findNextMatch(match.next_match_id);
                if (!nextMatch) return null;
                
                const sourceRound = match.round;
                const targetRound = nextMatch.round;
                
                const sourcePosData = getConnectionPositions(match, sourceRound);
                const targetPosData = getConnectionPositions(nextMatch, targetRound);
                
                // Calculate vertical positions
                const sourceMatchHeight = 80; // Reduced height
                
                const sourceY = (sourcePosData.index * (sourceMatchHeight + sourcePosData.spacing)) + (sourceMatchHeight / 2) + 50;
                const targetY = (targetPosData.index * (sourceMatchHeight + targetPosData.spacing)) + (sourceMatchHeight / 2) + 50;
                
                // Calculate horizontal positions
                const columnWidth = 220;
                const sourceX = sourceRound * columnWidth - 20;
                const targetX = targetRound * columnWidth - columnWidth + 10;
                
                return (
                  <path 
                    key={`${match.id}-${nextMatch.id}`}
                    d={`M ${sourceX} ${sourceY} H ${sourceX + 20} V ${targetY} H ${targetX}`}
                    stroke="#94a3b8"
                    strokeWidth="2"
                    fill="none"
                  />
                );
              })}
            </svg>
            
            {Array.from({ length: bracketMaxRound }, (_, i) => i + 1).map(round => (
              <div key={round} className="w-52 px-2" style={{ minWidth: '200px' }}>
                <h4 className="text-center font-medium mb-3 text-sm bg-gray-50 py-1 rounded">
                  {isLosers ? `Losers Round ${round}` : `Round ${round}`}
                </h4>
                <div className="flex flex-col relative">
                  {bracketMatches
                    .filter(match => match.round === round)
                    .sort((a, b) => a.match_number - b.match_number)
                    .map((match, index) => {
                      // Calculate spacing between matches based on the round
                      const spacing = Math.pow(2, bracketMaxRound - round) * 20;
                      
                      // Find source matches - these are matches that feed into this one
                      const sourceMatches = matches.filter(m => m.next_match_id === match.id);
                      const participant1SourceMatch = sourceMatches.find(m => m.match_number % 2 !== 0);
                      const participant2SourceMatch = sourceMatches.find(m => m.match_number % 2 === 0);
                      
                      // Get appropriate participant descriptions
                      const participant1Name = match.participant1_id 
                        ? getParticipantNameById(match.participant1_id)
                        : participant1SourceMatch 
                          ? (participant1SourceMatch.bracket === 'LOSERS' 
                            ? `L: Match ${participant1SourceMatch.match_number}` 
                            : `W: Match ${participant1SourceMatch.match_number}`)
                          : 'TBD';
                          
                      const participant2Name = match.participant2_id 
                        ? getParticipantNameById(match.participant2_id)
                        : participant2SourceMatch 
                          ? (participant2SourceMatch.bracket === 'LOSERS' 
                            ? `L: Match ${participant2SourceMatch.match_number}` 
                            : `W: Match ${participant2SourceMatch.match_number}`)
                          : 'TBD';
                      
                      // Special highlight for matches that feed into grand finals
                      const feedsIntoGrandFinal = grandFinalMatches.some(gf => 
                        gf.participant1_id === match.winner_id || gf.participant2_id === match.winner_id
                      );
                      
                      return (
                        <div 
                          key={match.id} 
                          className="mb-3 relative" 
                          style={{ 
                            marginBottom: `${spacing}px`,
                            zIndex: 10
                          }}
                        >
                          <div className={`border rounded-lg bg-white p-2 shadow w-full 
                            ${match.status === 'COMPLETED' ? 'border-green-200' : ''}
                            ${feedsIntoGrandFinal ? 'border-yellow-300 border-2' : ''}
                          `} style={{ height: '80px' }}>
                            <div className="flex justify-between items-center border-b pb-1 mb-1">
                              <span className="text-xs font-medium text-gray-600">
                                Match {match.match_number}
                              </span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                match.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-600'
                              }`}>
                                {match.status || 'PENDING'}
                              </span>
                            </div>
                            
                            <div className="flex flex-col justify-between h-[50px]">
                              <div className={`flex justify-between items-center text-xs ${
                                match.winner_id === match.participant1_id ? 'font-bold text-green-600' : ''
                              }`}>
                                <span className="truncate max-w-[120px]" title={participant1Name}>
                                  {participant1Name}
                                </span>
                                <span className="bg-gray-50 px-1.5 rounded min-w-[24px] text-center">
                                  {match.score_participant1 ?? '-'}
                                </span>
                              </div>
                              
                              <div className="border-t border-gray-100 my-1"></div>
                              
                              <div className={`flex justify-between items-center text-xs ${
                                match.winner_id === match.participant2_id ? 'font-bold text-green-600' : ''
                              }`}>
                                <span className="truncate max-w-[120px]" title={participant2Name}>
                                  {participant2Name}
                                </span>
                                <span className="bg-gray-50 px-1.5 rounded min-w-[24px] text-center">
                                  {match.score_participant2 ?? '-'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Main render function for the bracket viewer
  const isDoubleElimination = tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0;

  return (
    <div className="challonge-bracket">
      {/* Tournament format specific information header */}
      <div className={`p-4 rounded-lg border mb-4 ${tournament.format === 'SINGLE_ELIMINATION' ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <h3 className={`text-base font-medium mb-1 ${tournament.format === 'SINGLE_ELIMINATION' ? 'text-blue-700' : 'text-yellow-700'}`}>
          {tournament.format === 'SINGLE_ELIMINATION' 
            ? 'Single Elimination Tournament' 
            : tournament.format === 'DOUBLE_ELIMINATION' 
              ? 'Double Elimination Tournament'
              : tournament.format === 'ROUND_ROBIN'
                ? 'Round Robin Tournament'
                : 'Swiss Tournament'}
        </h3>
        <p className={`text-sm ${tournament.format === 'SINGLE_ELIMINATION' ? 'text-blue-600' : 'text-yellow-600'}`}>
          {tournament.format === 'SINGLE_ELIMINATION' 
            ? 'Players are eliminated after a single loss. The winner advances to the championship.' 
            : tournament.format === 'DOUBLE_ELIMINATION'
              ? 'Players must lose twice to be eliminated. Losers move to a separate bracket for a second chance.'
              : tournament.format === 'ROUND_ROBIN'
                ? 'Each participant plays against every other participant once.'
                : 'Participants play a predetermined number of rounds against opponents with similar records.'}
        </p>
      </div>

      {/* Main bracket container with relative positioning to allow grand finals placement */}
      <div className="relative" style={{ minHeight: '500px' }}>
        {/* Bracket container with specified width to ensure space for grand finals */}
        <div className="flex flex-col" style={{ width: isDoubleElimination ? 'calc(100% - 220px)' : '100%' }}>
          {/* Winners bracket section */}
          {regularWinnersMatches.length > 0 && renderBracketSection(regularWinnersMatches, "Winners Bracket")}
          
          {/* Losers bracket section for double elimination */}
          {isDoubleElimination && losersMatches.length > 0 && renderBracketSection(losersMatches, "Losers Bracket", true)}
        </div>
        
        {/* Connection lines to grand finals */}
        {isDoubleElimination && grandFinalMatches.length > 0 && renderGrandFinalConnections()}
        
        {/* Grand Finals section at the far right */}
        {isDoubleElimination && grandFinalMatches.length > 0 && renderGrandFinalsSection()}
      </div>
    </div>
  );
};

export default BracketViewer; 