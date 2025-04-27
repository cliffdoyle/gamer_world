'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { Tournament, Participant, Match, TournamentFormat } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface AddParticipantFormData {
  name: string;
}

// Create typed bracket definition
type BracketType = 'WINNERS' | 'LOSERS' | null;

// Extended match type to handle grand finals
interface ExtendedMatch extends Match {
  isGrandFinal?: boolean;
  bracket?: BracketType;
}

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  // Directly use params.id instead of wrapping with React.use()
  const tournamentId = params.id;
  
  const router = useRouter();
  const { token } = useAuth();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantForm, setParticipantForm] = useState<AddParticipantFormData>({ name: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'bracket'>('list');
  const bracketRef = useRef<HTMLDivElement>(null);
  const [isEditingMatch, setIsEditingMatch] = useState<string | null>(null);
  const [scoreForm, setScoreForm] = useState<{ score1: string; score2: string }>({ score1: '', score2: '' });
  const [isSubmittingScore, setIsSubmittingScore] = useState(false);
  // State for bracket visualization data
  const [processedMatches, setProcessedMatches] = useState<ExtendedMatch[]>([]);
  const [regularWinnersMatches, setRegularWinnersMatches] = useState<ExtendedMatch[]>([]);
  const [losersMatches, setLosersMatches] = useState<ExtendedMatch[]>([]);
  const [grandFinalMatches, setGrandFinalMatches] = useState<ExtendedMatch[]>([]);
  const [maxRound, setMaxRound] = useState(0);

  useEffect(() => {
    if (token && tournamentId) {
      fetchTournamentData();
    }
  }, [token, tournamentId]);

  const fetchTournamentData = async () => {
    try {
      const [tournamentData, participantsData] = await Promise.all([
        tournamentApi.getTournament(token!, tournamentId),
        tournamentApi.getParticipants(token!, tournamentId)
      ]);
      
      setTournament(tournamentData);
      setParticipants(participantsData);
      
      // Always fetch matches
      const matchesData = await tournamentApi.getMatches(token!, tournamentId);
      console.log('Fetched matches:', matchesData);
      if (matchesData && matchesData.length > 0) {
        setMatches(matchesData);
        
        // Process bracket data when matches are updated
        const processed = prepareBracketData(matchesData, tournamentData.format);
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
        
        setError(''); // Clear error when matches are loaded successfully
      }
    } catch (err) {
      console.error('Error fetching tournament data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('You must be logged in to add participants');
      return;
    }
    if (!tournament) return;

    // Check registration deadline
    if (tournament.registrationDeadline && new Date(tournament.registrationDeadline) < new Date()) {
      setError('Registration deadline has passed');
      return;
    }

    try {
      if (!participantForm.name.trim()) {
        setError('Participant name cannot be empty');
        return;
      }
      
      console.log('Submitting participant with data:', {
        participant_name: participantForm.name.trim()
      });
      
      await tournamentApi.addParticipant(token, tournamentId, {
        name: participantForm.name.trim()
      });
      
      setIsAddingParticipant(false);
      setParticipantForm({ name: '' });
      setError(''); // Clear any previous errors
      await fetchTournamentData(); // Refresh data
    } catch (err) {
      console.error('Error adding participant:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to add participant');
      }
    }
  };

  const handleUpdateMatchScore = async (matchId: string) => {
    if (!token || !tournament) return;
    setIsSubmittingScore(true);
    
    try {
      const match = matches.find(m => m.id === matchId);
      if (!match) {
        throw new Error('Match not found');
      }
      
      // Validate scores
      const score1 = parseInt(scoreForm.score1);
      const score2 = parseInt(scoreForm.score2);
      
      if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
        throw new Error('Invalid scores. Please enter valid positive numbers.');
      }
      
      // Tie check - cannot have ties in tournament matches
      if (score1 === score2) {
        throw new Error('Match cannot end in a tie. Please provide a winner.');
      }
      
      // Format the score string as expected by the API
      const scoreString = `${score1}-${score2}`;
      console.log(`Updating match ${matchId} with score: ${scoreString}`);
      
      // Determine winner
      const winnerId = score1 > score2 
        ? match.participant1_id 
        : match.participant2_id;
      
      if (!winnerId) {
        throw new Error('Cannot determine winner. Please check participant data.');
      }
      
      // Call API to update match
      const updatedMatch = await tournamentApi.updateMatch(token, tournamentId, matchId, scoreString);
      console.log('Match updated successfully:', updatedMatch);
      
      // Show success message
      setError(`Match score updated successfully! Winner will advance to the next round.`);
      
      // Fully refresh data to get the updated bracket
      await fetchTournamentData();
      
      // Reset UI state
      setIsEditingMatch(null);
      setScoreForm({ score1: '', score2: '' });
      
      // Clear success message after delay
      setTimeout(() => {
        if (error && error.includes('updated successfully')) {
          setError('');
        }
      }, 3000);
    } catch (err) {
      console.error('Error updating match score:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update match score');
      }
    } finally {
      setIsSubmittingScore(false);
    }
  };

  const handleGenerateBracket = async () => {
    if (!token) {
      setError('You must be logged in to generate bracket');
      return;
    }
    if (!tournament) return;

    setIsGenerating(true);
    setError(''); // Clear previous errors
    try {
      await tournamentApi.generateBracket(token, tournamentId);
      await fetchTournamentData(); // Refresh all data
    } catch (err) {
      console.error('Error generating bracket:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Not set';
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });
    } catch (e) {
      return 'Not set';
    }
  };

  // Function to get participant name by ID
  const getParticipantNameById = (id: string | null) => {
    if (!id) return 'TBD';
    const participant = participants.find(p => p.id === id);
    return participant ? (participant.participant_name || 'Unnamed') : 'TBD';
  };

  // Function to check if registration is still open
  const isRegistrationOpen = () => {
    if (!tournament || !tournament.registrationDeadline) return true;
    return new Date(tournament.registrationDeadline) > new Date();
  };
  
  // Function to format "time remaining" for registration
  const getRegistrationTimeRemaining = () => {
    if (!tournament || !tournament.registrationDeadline) return 'No deadline set';
    
    const deadline = new Date(tournament.registrationDeadline);
    const now = new Date();
    
    if (deadline < now) return 'Registration closed';
    
    const diffMs = deadline.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (diffDays > 0) {
      return `${diffDays} days, ${diffHours} hours remaining`;
    } else if (diffHours > 0) {
      return `${diffHours} hours remaining`;
    } else {
      return 'Less than an hour remaining';
    }
  };

  // Get descriptive name for participants based on previous matches
  const getParticipantDescription = (matchId: string | null, participantPosition: 1 | 2) => {
    if (!matchId) return 'TBD';
    
    const match = matches.find(m => m.id === matchId);
    if (!match) return 'TBD';
    
    // If the match has a participant, return their name
    if (participantPosition === 1 && match.participant1_id) {
      return getParticipantNameById(match.participant1_id);
    } else if (participantPosition === 2 && match.participant2_id) {
      return getParticipantNameById(match.participant2_id);
    }
    
    // Otherwise return "Winner of Match X"
    return `Winner of Match ${match.match_number}`;
  };

  // Group matches by round for better display
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {} as Record<number, typeof matches>);

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

  // Function to draw the bracket visualization
  const renderBracketView = () => {
    if (!tournament) {
      return (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
          <p className="text-yellow-700 text-sm">Tournament data is not available.</p>
        </div>
      );
    }

    // Prepare data with proper bracket assignments
    const processedMatches = prepareBracketData(matches, tournament.format);
    
    // Separate winners and losers bracket
    const winnersMatches = processedMatches.filter(m => m.bracket === 'WINNERS' || !m.bracket);
    const losersMatches = processedMatches.filter(m => m.bracket === 'LOSERS');
    
    // Find grand finals
    const grandFinalMatches = processedMatches.filter(m => m.isGrandFinal === true);
    
    // Remove grand finals from winners matches for separate display
    const regularWinnersMatches = winnersMatches.filter(m => m.isGrandFinal !== true);
    
    const isDoubleElimination = tournament.format === 'DOUBLE_ELIMINATION' && losersMatches.length > 0;
    
    // Calculate round information for proper spacing
    const winnersMaxRound = Math.max(...regularWinnersMatches.map(m => m.round), 0);
    const losersMaxRound = Math.max(...losersMatches.map(m => m.round), 0);
    const maxRound = Math.max(winnersMaxRound, losersMaxRound) + (grandFinalMatches.length > 0 ? 1 : 0);
    
    // Function to create connection lines to the grand final
    const renderGrandFinalConnections = () => {
      if (grandFinalMatches.length === 0) return null;
      
      // Calculate connection points
      const grandFinal = grandFinalMatches[0];
      const winnersFinalMatch = regularWinnersMatches.find(m => 
        m.round === winnersMaxRound && 
        m.winner_id === grandFinal.participant1_id
      );
      
      const losersFinalMatch = losersMatches.find(m => 
        m.round === losersMaxRound && 
        m.winner_id === grandFinal.participant2_id
      );
      
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
              
              {match.status !== 'COMPLETED' && (
                <div className="mt-2 text-xs text-gray-600 border-t border-gray-100 pt-2">
                  <p>Update the score to determine the tournament champion</p>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    };
    
    return (
      <div className="overflow-auto pb-6 challonge-bracket">
        {/* Tournament format specific information header */}
        <div className={`p-4 rounded-lg border mb-4 ${tournament.format === 'SINGLE_ELIMINATION' ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <h3 className={`text-base font-medium mb-1 ${tournament.format === 'SINGLE_ELIMINATION' ? 'text-blue-700' : 'text-yellow-700'}`}>
            {tournament.format === 'SINGLE_ELIMINATION' ? 'Single Elimination Tournament' : 'Double Elimination Tournament'}
          </h3>
          <p className={`text-sm ${tournament.format === 'SINGLE_ELIMINATION' ? 'text-blue-600' : 'text-yellow-600'}`}>
            {tournament.format === 'SINGLE_ELIMINATION' 
              ? 'Players are eliminated after a single loss. The winner advances to the championship.' 
              : 'Players must lose twice to be eliminated. Losers move to a separate bracket for a second chance.'}
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
          
          {/* Final champion message if tournament is complete */}
          {tournament.status === 'COMPLETED' && grandFinalMatches.some(m => m.winner_id) && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
              <h3 className="text-lg font-bold text-green-800 mb-2">Tournament Champion</h3>
              <p className="text-green-700">
                {getParticipantNameById(grandFinalMatches[0].winner_id)}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Function for list view rendering of matches
  const renderMatchList = (roundMatches: Match[]) => {
    return roundMatches.map((match) => (
      <div key={match.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md bg-white">
        <div className="flex justify-between items-center mb-3 pb-2 border-b">
          <div>
            <span className="text-sm font-semibold text-gray-700">Match {match.match_number}</span>
            {match.bracket === 'LOSERS' && (
              <span className="ml-2 text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                Losers
              </span>
            )}
          </div>
          <span className={`text-sm font-medium px-2 py-1 rounded-full ${
            match.status === 'COMPLETED' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-blue-100 text-blue-800'
          }`}>
            {match.status || 'PENDING'}
          </span>
        </div>
        
        {/* Match explanation */}
        <div className="flex flex-col mb-3">
          {match.next_match_id && (
            <div className="text-xs text-gray-600 mb-1">
              Winner advances to Match {matches.find(m => m.id === match.next_match_id)?.match_number || '?'}
            </div>
          )}
          
          {match.bracket === 'WINNERS' && (
            <div className="text-xs text-gray-600 mb-1">
              Loser drops to losers bracket
            </div>
          )}
        </div>
        
        <div className="rounded border overflow-hidden">
          {/* Player 1 Row */}
          <div 
            className={`flex items-center p-3 ${
              match.winner_id === match.participant1_id 
                ? 'bg-green-50 border-l-4 border-green-500' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <span className={`font-medium text-base mr-2 ${match.winner_id === match.participant1_id ? 'text-green-700' : 'text-gray-800'}`}>
                  {getParticipantNameById(match.participant1_id)}
                </span>
                {match.winner_id === match.participant1_id && (
                  <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
            
            {isEditingMatch === match.id ? (
              <input
                type="number"
                min="0"
                value={scoreForm.score1}
                onChange={(e) => setScoreForm({...scoreForm, score1: e.target.value})}
                className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <div className="font-medium text-center px-3 py-1 bg-gray-100 rounded min-w-[2.5rem] inline-block">
                {match.score_participant1 ?? 0}
              </div>
            )}
          </div>
          
          {/* VS divider */}
          <div className="flex justify-center items-center py-1 bg-gray-50 border-y">
            <span className="text-xs font-medium text-gray-500">VS</span>
          </div>
          
          {/* Player 2 Row */}
          <div 
            className={`flex items-center p-3 ${
              match.winner_id === match.participant2_id 
                ? 'bg-green-50 border-l-4 border-green-500' 
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <span className={`font-medium text-base mr-2 ${match.winner_id === match.participant2_id ? 'text-green-700' : 'text-gray-800'}`}>
                  {getParticipantNameById(match.participant2_id)}
                </span>
                {match.winner_id === match.participant2_id && (
                  <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
            </div>
            
            {isEditingMatch === match.id ? (
              <input
                type="number"
                min="0"
                value={scoreForm.score2}
                onChange={(e) => setScoreForm({...scoreForm, score2: e.target.value})}
                className="w-16 text-center border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            ) : (
              <div className="font-medium text-center px-3 py-1 bg-gray-100 rounded min-w-[2.5rem] inline-block">
                {match.score_participant2 ?? 0}
              </div>
            )}
          </div>
        </div>
        
        {/* Edit/Save buttons */}
        <div className="flex justify-end pt-3 mt-3">
          {isEditingMatch === match.id ? (
            <>
              <button
                onClick={() => handleUpdateMatchScore(match.id)}
                disabled={isSubmittingScore}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 mr-2"
              >
                {isSubmittingScore ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : 'Save Score'}
              </button>
              <button
                onClick={() => setIsEditingMatch(null)}
                disabled={isSubmittingScore}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setIsEditingMatch(match.id);
                setScoreForm({
                  score1: match.score_participant1?.toString() || '0',
                  score2: match.score_participant2?.toString() || '0'
                });
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Edit Score
            </button>
          )}
        </div>
      </div>
    ));
  };

  // Add the missing functions needed for bracket rendering
  // Function to find the next match from match ID
  const findNextMatch = (matchId: string | null): ExtendedMatch | undefined => {
    if (!matchId) return undefined;
    return processedMatches.find(m => m.id === matchId);
  };

  // Calculate positions for connection lines
  const getConnectionPositions = (match: ExtendedMatch, round: number): { index: number; spacing: number } => {
    const bracketMatches = match.bracket === 'LOSERS' ? losersMatches : regularWinnersMatches;
    const matchesInRound = bracketMatches.filter(m => m.round === round).sort((a, b) => a.match_number - b.match_number);
    const matchIndex = matchesInRound.findIndex(m => m.id === match.id);
    const spacing = Math.pow(2, maxRound - round) * 20; // Reduced spacing
    
    return {
      index: matchIndex,
      spacing: spacing
    };
  };

  // Restore the missing renderBracketSection function
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

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!tournament) {
    return (
      <ProtectedRoute>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-red-700">Tournament not found</p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Tournament Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
              <p className="mt-2 text-gray-600">{tournament.description}</p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => router.push('/tournaments')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Back to Tournaments
              </button>
              <button
                onClick={handleGenerateBracket}
                disabled={isGenerating}
                className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                  isGenerating ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  'Generate Bracket'
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tournament Info - Simplified */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Tournament Details</h2>
                <dl className="grid grid-cols-1 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Game</dt>
                    <dd className="mt-1 text-sm text-gray-900">{tournament.game}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Format</dt>
                    <dd className="mt-1 text-sm text-gray-900">{tournament.format}</dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule</h2>
                
                {tournament.registrationDeadline && (
                  <div className={`mb-4 p-3 rounded-md ${isRegistrationOpen() ? 'bg-blue-50' : 'bg-red-50'}`}>
                    <h3 className="text-sm font-semibold mb-1">Registration Deadline</h3>
                    <p className="text-sm font-medium">
                      {formatDateTime(tournament.registrationDeadline)}
                    </p>
                    <p className={`text-sm mt-1 ${isRegistrationOpen() ? 'text-blue-600' : 'text-red-600'} font-medium`}>
                      {getRegistrationTimeRemaining()}
                    </p>
                  </div>
                )}
                
                {tournament.startTime && (
                  <div className="mb-4 p-3 rounded-md bg-green-50">
                    <h3 className="text-sm font-semibold mb-1">Tournament Starts</h3>
                    <p className="text-sm font-medium">
                      {formatDateTime(tournament.startTime)}
                    </p>
                    <p className="text-sm mt-1 text-green-600 font-medium">
                      {new Date(tournament.startTime) > new Date() 
                        ? 'Coming soon' 
                        : 'Tournament has started'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Participants Section */}
          <div className="bg-white shadow rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Participants</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                </p>
              </div>
              <button
                onClick={() => setIsAddingParticipant(true)}
                disabled={!isRegistrationOpen()}
                className={`inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md ${
                  isRegistrationOpen() 
                    ? 'text-white bg-blue-600 hover:bg-blue-700' 
                    : 'text-gray-400 bg-gray-200 cursor-not-allowed'
                }`}
              >
                Add Participant
              </button>
            </div>

            {!isRegistrationOpen() && !isAddingParticipant && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">Registration deadline has passed. No more participants can be added.</p>
                  </div>
                </div>
              </div>
            )}

            {isAddingParticipant && (
              <form onSubmit={handleAddParticipant} className="mb-4">
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={participantForm.name}
                    onChange={(e) => setParticipantForm({ name: e.target.value })}
                    placeholder="Participant Name"
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900"
                    required
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingParticipant(false);
                      setError('');
                    }}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {participants.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No participants yet</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {participants.map((participant, index) => (
                  <li key={participant.id} className="py-4">
                    <div className="flex items-center space-x-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {index + 1}. {participant.participant_name || participant.name || 'Unnamed Participant'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Matches Section */}
          {matches.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Tournament Bracket</h2>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`px-4 py-2 text-sm rounded-md font-medium ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    List View
                  </button>
                  <button 
                    onClick={() => setViewMode('bracket')} 
                    className={`px-4 py-2 text-sm rounded-md font-medium ${viewMode === 'bracket' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    Bracket View
                  </button>
                </div>
              </div>
              
              {viewMode === 'list' ? (
                <div className="challonge-list-view">
                  {(() => {
                    const processedMatches = prepareBracketData(matches, tournament.format);
                    
                    // Group by round
                    const roundMatchesMap = processedMatches.reduce((acc, match) => {
                      const key = match.round.toString();
                      if (!acc[key]) {
                        acc[key] = [];
                      }
                      acc[key].push(match);
                      return acc;
                    }, {} as Record<string, ExtendedMatch[]>);
                    
                    // Sort rounds for display
                    return Object.entries(roundMatchesMap)
                      .sort(([roundA], [roundB]) => parseInt(roundA) - parseInt(roundB))
                      .map(([round, roundMatches]) => {
                        const hasLosersMatches = roundMatches.some(m => m.bracket === 'LOSERS');
                        const hasGrandFinals = roundMatches.some(m => m.isGrandFinal === true);
                        
                        // Handle Grand Finals separately
                        if (tournament.format === 'DOUBLE_ELIMINATION' && hasGrandFinals) {
                          const grandFinalMatches = roundMatches.filter(m => m.isGrandFinal === true);
                          const otherMatches = roundMatches.filter(m => !m.isGrandFinal);
                          
                          return (
                            <React.Fragment key={round}>
                              {otherMatches.length > 0 && (
                                <div className="mb-8">
                                  <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-gray-100 rounded-md shadow-sm">
                                    Round {round}
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {renderMatchList(otherMatches)}
                                  </div>
                                </div>
                              )}
                              
                              <div className="mb-8">
                                <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-yellow-100 rounded-md shadow-sm text-yellow-800">
                                  Grand Finals
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {renderMatchList(grandFinalMatches)}
                                </div>
                              </div>
                            </React.Fragment>
                          );
                        }
                        
                        // If the round has both winners and losers, separate them
                        if (hasLosersMatches) {
                          const winnersMatches = roundMatches.filter(m => m.bracket === 'WINNERS' || !m.bracket);
                          const losersMatches = roundMatches.filter(m => m.bracket === 'LOSERS');
                          
                          return (
                            <React.Fragment key={round}>
                              {/* Winners bracket section */}
                              {winnersMatches.length > 0 && (
                                <div className="mb-8">
                                  <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-blue-50 rounded-md shadow-sm text-blue-800">
                                    Winners Round {round}
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {renderMatchList(winnersMatches)}
                                  </div>
                                </div>
                              )}
                              
                              {/* Losers bracket section */}
                              {losersMatches.length > 0 && (
                                <div className="mb-8">
                                  <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-red-50 rounded-md shadow-sm text-red-800">
                                    Losers Round {round}
                                  </h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {renderMatchList(losersMatches)}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        }
                        
                        // Regular round without separated brackets
                        return (
                          <div key={round} className="mb-8">
                            <h3 className="text-lg font-medium mb-4 px-4 py-2 bg-gray-100 rounded-md shadow-sm">
                              Round {round}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {renderMatchList(roundMatches)}
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              ) : (
                renderBracketView()
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 