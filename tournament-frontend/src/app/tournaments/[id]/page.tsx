'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { Tournament, Participant, Match } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface AddParticipantFormData {
  name: string;
}

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
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

  useEffect(() => {
    if (token && params.id) {
      fetchTournamentData();
    }
  }, [token, params.id]);

  const fetchTournamentData = async () => {
    try {
      const [tournamentData, participantsData] = await Promise.all([
        tournamentApi.getTournament(token!, params.id),
        tournamentApi.getParticipants(token!, params.id)
      ]);
      
      setTournament(tournamentData);
      setParticipants(participantsData);
      
      // Always fetch matches
      const matchesData = await tournamentApi.getMatches(token!, params.id);
      console.log('Fetched matches:', matchesData);
      if (matchesData && matchesData.length > 0) {
        setMatches(matchesData);
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
      
      await tournamentApi.addParticipant(token, params.id, {
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
      
      // Format the score string as expected by the API
      const scoreString = `${scoreForm.score1}-${scoreForm.score2}`;
      
      await tournamentApi.updateMatch(token, params.id, matchId, scoreString);
      setIsEditingMatch(null);
      setScoreForm({ score1: '', score2: '' });
      setError('');
      await fetchTournamentData(); // Refresh data
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
      await tournamentApi.generateBracket(token, params.id);
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

  // Function to draw the bracket visualization
  const renderBracketView = () => {
    // Group matches by round
    const maxRound = Math.max(...matches.map(m => m.round));
    
    // Function to find the next match from match ID
    const findNextMatch = (matchId: string | null): Match | undefined => {
      if (!matchId) return undefined;
      return matches.find(m => m.id === matchId);
    };
    
    // Calculate positions for connection lines
    const getConnectionPositions = (match: Match, round: number): { index: number; spacing: number } => {
      const matchesInRound = matches.filter(m => m.round === round).sort((a, b) => a.match_number - b.match_number);
      const matchIndex = matchesInRound.findIndex(m => m.id === match.id);
      const spacing = Math.pow(2, maxRound - round) * 40; // Reduced spacing
      
      return {
        index: matchIndex,
        spacing: spacing
      };
    };
    
    return (
      <div className="overflow-auto pb-6">
        <div className="flex" style={{ minWidth: `${maxRound * 250}px`, position: 'relative' }}>
          {/* Draw connection lines between matches */}
          <svg 
            className="absolute top-0 left-0 w-full h-full" 
            style={{ zIndex: 1, pointerEvents: 'none' }}
          >
            {matches.filter(match => match.next_match_id).map(match => {
              const nextMatch = findNextMatch(match.next_match_id);
              if (!nextMatch) return null;
              
              const sourceRound = match.round;
              const targetRound = nextMatch.round;
              
              const sourcePosData = getConnectionPositions(match, sourceRound);
              const targetPosData = getConnectionPositions(nextMatch, targetRound);
              
              // Calculate vertical positions
              const sourceMatchHeight = 110; // Increased for better readability
              const sourceMatches = matches.filter(m => m.round === sourceRound).length;
              
              const sourceY = (sourcePosData.index * (sourceMatchHeight + sourcePosData.spacing)) + (sourceMatchHeight / 2) + 50;
              const targetY = (targetPosData.index * (sourceMatchHeight + targetPosData.spacing)) + (sourceMatchHeight / 2) + 50;
              
              // Calculate horizontal positions
              const columnWidth = 250; // Increased width for better text visibility
              const sourceX = sourceRound * columnWidth - 20;  // right edge of source match
              const targetX = targetRound * columnWidth - columnWidth + 10;  // left edge of target match
              
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
          
          {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => (
            <div key={round} className="w-60 px-2" style={{ minWidth: '220px' }}>
              <h3 className="text-center font-medium mb-4 text-base bg-gray-100 py-2 rounded-md shadow-sm">
                Round {round}
              </h3>
              <div className="flex flex-col relative">
                {matches
                  .filter(match => match.round === round)
                  .sort((a, b) => a.match_number - b.match_number)
                  .map((match, index, matchesInRound) => {
                    // Calculate spacing between matches based on the round
                    const spacing = Math.pow(2, maxRound - round) * 40; // Reduced spacing
                    
                    // Find source matches - these are matches that feed into this one
                    const sourceMatches = matches.filter(m => m.next_match_id === match.id);
                    const participant1SourceMatch = sourceMatches.find(m => m.match_number % 2 !== 0);
                    const participant2SourceMatch = sourceMatches.find(m => m.match_number % 2 === 0);
                    
                    // Get appropriate participant descriptions (name or "Winner of Match X")
                    const participant1Name = match.participant1_id 
                      ? getParticipantNameById(match.participant1_id)
                      : participant1SourceMatch 
                        ? `Winner of Match ${participant1SourceMatch.match_number}`
                        : 'TBD';
                        
                    const participant2Name = match.participant2_id 
                      ? getParticipantNameById(match.participant2_id)
                      : participant2SourceMatch 
                        ? `Winner of Match ${participant2SourceMatch.match_number}`
                        : 'TBD';
                    
                    // Calculate a text color for the participant based on status
                    const getTextColor = (participantId: string | null, sourceName: string) => {
                      if (match.winner_id === participantId) return 'text-green-600 font-bold';
                      if (sourceName.includes('Winner of Match')) return 'text-blue-600';
                      if (sourceName === 'TBD') return 'text-gray-400';
                      return '';
                    };
                    
                    return (
                      <div 
                        key={match.id} 
                        className="mb-4 relative" 
                        style={{ 
                          marginBottom: `${spacing}px`,
                          zIndex: 10
                        }}
                      >
                        <div className="border rounded-lg bg-white p-3 shadow-md w-full" style={{ height: '110px' }}>
                          <div className="flex justify-between items-center border-b pb-1 mb-2">
                            <p className="text-xs font-semibold text-gray-600">Match {match.match_number}</p>
                            <p className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded text-gray-600">
                              {match.status || 'PENDING'}
                            </p>
                          </div>
                          
                          <div className="flex flex-col justify-between h-[70px]">
                            <div className="flex justify-between items-center py-1 px-1 hover:bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <span 
                                  className={`text-sm font-medium block truncate ${getTextColor(match.participant1_id, participant1Name)}`}
                                  title={participant1Name}
                                >
                                  {participant1Name}
                                </span>
                              </div>
                              <span className="text-sm font-medium bg-gray-100 ml-2 px-2 py-0.5 rounded-md min-w-[30px] text-center">
                                {match.score_participant1 !== null ? match.score_participant1 : '-'}
                              </span>
                            </div>
                            
                            <div className="border-t my-1 border-gray-100"></div>
                            
                            <div className="flex justify-between items-center py-1 px-1 hover:bg-gray-50 rounded">
                              <div className="flex-1 min-w-0">
                                <span 
                                  className={`text-sm font-medium block truncate ${getTextColor(match.participant2_id, participant2Name)}`}
                                  title={participant2Name}
                                >
                                  {participant2Name}
                                </span>
                              </div>
                              <span className="text-sm font-medium bg-gray-100 ml-2 px-2 py-0.5 rounded-md min-w-[30px] text-center">
                                {match.score_participant2 !== null ? match.score_participant2 : '-'}
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
                // List view (enhanced for better visibility)
                <>
                  {Object.entries(matchesByRound).map(([round, roundMatches]) => (
                    <div key={round} className="mb-6">
                      <h3 className="text-lg font-medium mb-3 bg-gray-100 p-2 rounded">Round {round}</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {roundMatches.map((match) => (
                          <div key={match.id} className="border rounded-lg p-4 shadow-sm hover:shadow">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-medium text-gray-600">Match {match.match_number}</span>
                              <span className="text-sm font-medium px-2 py-1 rounded-full bg-gray-100">
                                {match.status || 'PENDING'}
                              </span>
                            </div>
                            
                            <div className="space-y-4">
                              {/* Row for participant 1 */}
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <span className={`font-medium ${match.winner_id === match.participant1_id ? 'text-green-600' : ''}`}>
                                    {getParticipantNameById(match.participant1_id)}
                                  </span>
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
                                  <span className="font-medium text-center px-3 py-1 bg-gray-100 rounded min-w-[2.5rem] inline-block">
                                    {match.score_participant1 ?? 0}
                                  </span>
                                )}
                              </div>
                              
                              {/* Row for participant 2 */}
                              <div className="flex items-center">
                                <div className="flex-1">
                                  <span className={`font-medium ${match.winner_id === match.participant2_id ? 'text-green-600' : ''}`}>
                                    {getParticipantNameById(match.participant2_id)}
                                  </span>
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
                                  <span className="font-medium text-center px-3 py-1 bg-gray-100 rounded min-w-[2.5rem] inline-block">
                                    {match.score_participant2 ?? 0}
                                  </span>
                                )}
                              </div>
                              
                              {/* Edit/Save buttons */}
                              <div className="flex justify-end pt-2">
                                {isEditingMatch === match.id ? (
                                  <>
                                    <button
                                      onClick={() => handleUpdateMatchScore(match.id)}
                                      disabled={isSubmittingScore}
                                      className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 mr-2"
                                    >
                                      {isSubmittingScore ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      onClick={() => setIsEditingMatch(null)}
                                      disabled={isSubmittingScore}
                                      className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-gray-700 bg-gray-100 hover:bg-gray-200"
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
                                    className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                                  >
                                    Edit Score
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                // Bracket view
                renderBracketView()
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 