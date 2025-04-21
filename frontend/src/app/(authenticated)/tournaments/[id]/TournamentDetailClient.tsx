'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TournamentBracket from '@/components/TournamentBracket';
import { Tournament, Match, Participant, Message, TournamentStatus } from '@/types/tournament';
import { useAuth } from '@/hooks/useAuth';

type TabType = 'overview' | 'participants' | 'matches' | 'bracket' | 'chat';

interface TournamentDetailClientProps {
  tournamentId: string;
}

export default function TournamentDetailClient({ tournamentId }: TournamentDetailClientProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleMatchClick = (match: Match) => {
    setSelectedMatch(match);
    setShowScoreModal(true);
  };

  useEffect(() => {
    console.log('Auth state:', { isLoading: authLoading, user });
    
    // Only fetch data - don't redirect yet
    if (!authLoading) {
      fetchTournamentData();
    }
  }, [tournamentId, user, authLoading]);

  const fetchTournamentData = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Token:', token ? 'Token exists' : 'No token found');
      
      // Even if there's no token, try to fetch the tournament data anyway
      // We'll let the API decide if it requires authentication
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('Making tournament request...');
      // Fetch tournament details
      const tournamentResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}`, { 
        headers,
        credentials: 'include'
      });
      
      console.log('Tournament response status:', tournamentResponse.status);
      
      if (!tournamentResponse.ok) {
        if (tournamentResponse.status === 401) {
          console.log('Unauthorized request - redirecting to login');
          router.push('/auth/login');
          return;
        }
        throw new Error(`Failed to fetch tournament: ${tournamentResponse.status}`);
      }

      const tournamentData = await tournamentResponse.json();
      console.log('Tournament data received:', tournamentData);
      setTournament(tournamentData);

      // Fetch participants
      const participantsResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}/participants`, { 
        headers,
        credentials: 'include'
      });
      
      if (!participantsResponse.ok) {
        throw new Error('Failed to fetch participants');
      }
      
      const participantsData = await participantsResponse.json();
      setParticipants(participantsData);

      // Fetch matches
      const matchesResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}/matches`, { 
        headers,
        credentials: 'include'
      });
      
      if (!matchesResponse.ok) {
        throw new Error('Failed to fetch matches');
      }
      
      const matchesData = await matchesResponse.json();
      setMatches(matchesData);

      // Fetch messages
      const messagesResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}/messages`, { 
        headers,
        credentials: 'include'
      });
      
      if (!messagesResponse.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const messagesData = await messagesResponse.json();
      setMessages(messagesData);

    } catch (err) {
      console.error('Error in fetchTournamentData:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tournament data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newMessage }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const message = await response.json();
      setMessages([...messages, message]);
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  const handleJoinTournament = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !user) {
        router.push('/auth/login');
        return;
      }

      // Check if user is already a participant
      const isParticipant = participants.some(p => p.userId === user.id);
      if (isParticipant) {
        setError('You are already registered for this tournament');
        return;
      }

      // Check if tournament is full
      if (tournament && participants.length >= tournament.maxParticipants && !tournament.allowWaitlist) {
        setError('Tournament is full');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          name: user.username,
          seed: 0  // Default seed
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to join tournament');
      }

      const participant = await response.json();
      setParticipants([...participants, participant]);
      
      // Show success message
      setSuccessMessage('Successfully joined the tournament!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join tournament');
    }
  };

  const handleScoreSubmit = async (scoreParticipant1: number, scoreParticipant2: number) => {
    if (!selectedMatch) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to update scores');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/matches/${selectedMatch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          scoreParticipant1,
          scoreParticipant2,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update match score');
      }

      // Refresh tournament data to get updated matches
      fetchTournamentData();
      setShowScoreModal(false);
    } catch (error) {
      console.error('Error updating match score:', error);
      setError(error instanceof Error ? error.message : 'Failed to update match score');
    }
  };

  const getParticipantName = (participantId: string | undefined) => {
    if (!participantId) return 'TBD';
    const participant = participants.find(p => p.id === participantId);
    return participant ? participant.name : 'TBD';
  };

  // Score update modal
  const ScoreModal = () => {
    const [score1, setScore1] = useState('');
    const [score2, setScore2] = useState('');

    if (!showScoreModal || !selectedMatch) return null;

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      handleScoreSubmit(parseInt(score1), parseInt(score2));
    };

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
          <div className="mt-3">
            <h3 className="text-lg font-medium leading-6 text-gray-900">Update Match Score</h3>
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  {getParticipantName(selectedMatch.participant1Id)}
                </label>
                <input
                  type="number"
                  min="0"
                  value={score1}
                  onChange={(e) => setScore1(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700">
                  {getParticipantName(selectedMatch.participant2Id)}
                </label>
                <input
                  type="number"
                  min="0"
                  value={score2}
                  onChange={(e) => setScore2(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowScoreModal(false)}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Update Score
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="mt-4 text-gray-600">Loading tournament...</p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="text-center py-12">
        <h3 className="mt-2 text-sm font-medium text-gray-900">Tournament not found</h3>
        <p className="mt-1 text-sm text-gray-500">
          The tournament you're looking for doesn't exist or you don't have access to it.
        </p>
        <div className="mt-6">
          <Link
            href="/tournaments"
            className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go back to tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
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

      {successMessage && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
          </div>
        </div>
      )}

      <div className="md:flex md:items-center md:justify-between md:space-x-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tournament?.name || 'Tournament Details'}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tournament?.game || ''} {tournament?.format ? `• ${tournament.format}` : ''}
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0">
          {tournament?.status === 'REGISTRATION' && (
            <button
              onClick={handleJoinTournament}
              disabled={!user || (participants && tournament && participants.some(p => p.userId === user.id) || participants.length >= tournament.maxParticipants)}
              className={`
                inline-flex justify-center rounded-md px-4 py-2 text-sm font-medium shadow-sm
                ${!user || (participants && tournament && participants.some(p => p.userId === user.id) || participants.length >= tournament.maxParticipants)
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                }
              `}
            >
              {!user
                ? 'Please log in to join'
                : participants && participants.some(p => p.userId === user.id)
                ? 'Already Registered'
                : participants && tournament && participants.length >= tournament.maxParticipants
                ? 'Tournament Full'
                : 'Join Tournament'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            className={`${
              activeTab === 'participants'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
          >
            Participants
          </button>
          {tournament?.status === 'IN_PROGRESS' && (
            <button
              onClick={() => setActiveTab('bracket')}
              className={`${
                activeTab === 'bracket'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              } whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium`}
            >
              Bracket
            </button>
          )}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Tournament Details</h3>
            </div>
            <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
              <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1 text-sm text-gray-900">{tournament?.status || 'N/A'}</dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Participants</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {participants?.length || 0} / {tournament?.maxParticipants || '?'}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Start Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {tournament?.startDate ? new Date(tournament.startDate).toLocaleString() : 'TBD'}
                  </dd>
                </div>
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-gray-500">Registration Deadline</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {tournament?.registrationDeadline ? new Date(tournament.registrationDeadline).toLocaleString() : 'TBD'}
                  </dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Description</dt>
                  <dd className="mt-1 text-sm text-gray-900">{tournament?.description || 'No description available'}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Rules</dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">{tournament?.rules || 'No rules specified'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'participants' && (
        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Participants</h3>
              <span className="text-sm text-gray-500">{participants?.length || 0} / {tournament?.maxParticipants || '?'}</span>
            </div>
            {participants && participants.length > 0 ? (
              <ul role="list" className="divide-y divide-gray-200">
                {participants.map((participant) => (
                  <li key={participant.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-sm font-medium text-gray-500">
                              {participant.name && participant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{participant.name}</div>
                          <div className="text-sm text-gray-500">Joined {participant.createdAt ? new Date(participant.createdAt).toLocaleDateString() : 'N/A'}</div>
                        </div>
                      </div>
                      <div>
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                          ${participant.status === 'CHECKED_IN'
                            ? 'bg-green-100 text-green-800'
                            : participant.status === 'WAITLISTED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : participant.status === 'ELIMINATED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {participant.status || 'REGISTERED'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No participants yet</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Be the first to join this tournament!
                </p>
                {tournament?.status === 'REGISTRATION' && user && (
                  <div className="mt-6">
                    <button
                      onClick={handleJoinTournament}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Join Tournament
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'bracket' && (
        <div className="mt-8">
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Tournament Bracket</h3>
              {tournament?.status === 'IN_PROGRESS' && (
                <p className="mt-1 text-sm text-gray-500">Click on a match to update its score</p>
              )}
            </div>
            <div className="px-4 py-5 sm:p-6">
              {matches && matches.length > 0 ? (
                <TournamentBracket
                  matches={matches}
                  participants={participants || []}
                  onMatchClick={handleMatchClick}
                />
              ) : (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No matches yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {tournament?.status === 'DRAFT' || tournament?.status === 'REGISTRATION'
                      ? 'The bracket will be generated when the tournament starts.'
                      : 'Waiting for matches to be created.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showScoreModal && (
        <ScoreModal />
      )}
    </div>
  );
} 