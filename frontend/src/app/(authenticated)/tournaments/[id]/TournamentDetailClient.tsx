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
  const [newParticipantName, setNewParticipantName] = useState('');

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
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      console.log('Tournament response status:', tournamentResponse.status);
      
      if (!tournamentResponse.ok) {
        const errorData = await tournamentResponse.json();
        throw new Error(errorData.error || `Failed to fetch tournament: ${tournamentResponse.status}`);
      }

      const tournamentData = await tournamentResponse.json();
      console.log('Tournament data received:', tournamentData);
      setTournament(tournamentData);

      // Fetch participants
      const participantsResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}/participants`, { 
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!participantsResponse.ok) {
        const errorData = await participantsResponse.json();
        throw new Error(errorData.error || 'Failed to fetch participants');
      }
      
      const participantsData = await participantsResponse.json();
      setParticipants(participantsData || []); // Ensure we always set an array

      // Fetch matches
      const matchesResponse = await fetch(`http://localhost:8082/tournaments/${tournamentId}/matches`, { 
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!matchesResponse.ok) {
        const errorData = await matchesResponse.json();
        throw new Error(errorData.error || 'Failed to fetch matches');
      }
      
      const matchesData = await matchesResponse.json();
      setMatches(matchesData || []); // Ensure we always set an array

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

  const handleAddParticipant = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token || !user?.isAdmin) {
        setError('Only administrators can add participants');
        return;
      }

      if (!newParticipantName.trim()) {
        setError('Participant name is required');
        return;
      }

      // Check if tournament is full
      if (tournament && participants.length >= tournament.maxParticipants) {
        setError('Tournament is full');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          teamName: newParticipantName
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add participant');
      }

      const participant = await response.json();
      setParticipants([...participants, participant]);
      setNewParticipantName(''); // Clear input after successful addition
      setSuccessMessage('Successfully added participant!');
      
      // Refresh tournament data to get updated participant count
      await fetchTournamentData();
    } catch (err) {
      console.error('Error adding participant:', err);
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  const handleGenerateBracket = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate bracket');
      }

      // Refresh tournament data to get updated matches
      await fetchTournamentData();
      setSuccessMessage('Tournament bracket generated successfully!');
    } catch (err) {
      console.error('Error generating bracket:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
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

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    return new Date(dateString).toLocaleString();
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch(`http://localhost:8082/tournaments/${tournamentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update tournament status');
      }

      // Refresh tournament data
      await fetchTournamentData();
      setSuccessMessage('Tournament status updated successfully!');
    } catch (err) {
      console.error('Error updating tournament status:', err);
      setError(err instanceof Error ? err.message : 'Failed to update tournament status');
    }
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
    <div className="container mx-auto px-4 py-8">
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      ) : tournament ? (
        <div>
          {/* Tournament Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{tournament.name}</h1>
            <div className="flex items-center space-x-4">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {tournament.status}
              </span>
              <span className="text-gray-600">
                {participants.length} / {tournament.maxParticipants} Participants
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4 mb-8">
            {user?.isAdmin && tournament.status === 'REGISTRATION' && (
              <div className="flex items-center space-x-2 w-full max-w-md">
                <input
                  type="text"
                  value={newParticipantName}
                  onChange={(e) => setNewParticipantName(e.target.value)}
                  placeholder="Enter participant name"
                  className="flex-1 px-4 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={handleAddParticipant}
                  disabled={participants.length >= tournament.maxParticipants}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400"
                >
                  Add Participant
                </button>
              </div>
            )}
            {user?.isAdmin && tournament.status === 'REGISTRATION' && participants.length >= 2 && (
              <button
                onClick={handleGenerateBracket}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Generate Bracket
              </button>
            )}
            {user?.isAdmin && (
              <select
                onChange={(e) => handleUpdateStatus(e.target.value)}
                value={tournament.status}
                className="px-4 py-2 border rounded"
              >
                <option value="DRAFT">Draft</option>
                <option value="REGISTRATION">Registration</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              {['overview', 'participants', 'bracket', 'chat'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as TabType)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm
                    ${activeTab === tab
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                  `}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {activeTab === 'overview' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Tournament Details</h2>
                <div className="space-y-4">
                  <p><strong>Game:</strong> {tournament.game}</p>
                  <p><strong>Format:</strong> {tournament.format}</p>
                  <p><strong>Start Time:</strong> {formatDate(tournament.startTime)}</p>
                  <p><strong>Registration Deadline:</strong> {formatDate(tournament.registrationDeadline)}</p>
                  <p><strong>Description:</strong> {tournament.description}</p>
                </div>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Participants</h2>
                <div className="grid gap-4">
                  {participants.map((participant, index) => (
                    <div key={participant.id} className="flex items-center justify-between border-b pb-2">
                      <div>
                        <span className="font-medium">{participant.teamName || participant.name}</span>
                        {participant.isWaitlisted && (
                          <span className="ml-2 text-sm text-yellow-600">(Waitlisted)</span>
                        )}
                      </div>
                      <span className="text-gray-500">Seed: {participant.seed || index + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'bracket' && matches.length > 0 && (
              <div className="bg-white shadow rounded-lg p-6 overflow-x-auto">
                <h2 className="text-xl font-semibold mb-4">Tournament Bracket</h2>
                <TournamentBracket
                  matches={matches}
                  participants={participants}
                  onMatchClick={handleMatchClick}
                  isAdmin={user?.isAdmin || false}
                />
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Tournament Chat</h2>
                <div className="h-96 overflow-y-auto mb-4 space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className="flex space-x-3">
                      <div className="flex-1 bg-gray-50 rounded-lg px-4 py-2">
                        <div className="font-medium text-gray-900">{message.userName}</div>
                        <div className="text-gray-700">{message.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleSendMessage} className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-xl text-gray-600">Tournament not found</p>
        </div>
      )}

      {/* Score Update Modal */}
      {showScoreModal && selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg">
            <h3 className="text-lg font-medium mb-4">Update Match Score</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const score1 = parseInt(form.score1.value);
              const score2 = parseInt(form.score2.value);
              handleScoreSubmit(score1, score2);
              setShowScoreModal(false);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {getParticipantName(selectedMatch.participant1Id)}
                  </label>
                  <input
                    type="number"
                    name="score1"
                    min="0"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    {getParticipantName(selectedMatch.participant2Id)}
                  </label>
                  <input
                    type="number"
                    name="score2"
                    min="0"
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowScoreModal(false)}
                    className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                  >
                    Update Score
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
} 