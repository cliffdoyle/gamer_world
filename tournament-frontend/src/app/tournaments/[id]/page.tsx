'use client';

import { useEffect, useState } from 'react';
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
      console.log('Tournament Data:', tournamentData);
      console.log('Participants Data:', participantsData);
      setTournament(tournamentData);
      setParticipants(participantsData);
      
      // If tournament is in progress or completed, fetch matches
      if (tournamentData.status === 'IN_PROGRESS' || tournamentData.status === 'COMPLETED') {
        const matchesData = await tournamentApi.getMatches(token!, params.id);
        setMatches(matchesData);
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

    try {
      if (!participantForm.name.trim()) {
        setError('Participant name cannot be empty');
        return;
      }
      
      console.log('Submitting participant with data:', {
        ParticipantName: participantForm.name.trim()
      });
      
      await tournamentApi.addParticipant(token, params.id, {
        ParticipantName: participantForm.name.trim()
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

  const handleGenerateBracket = async () => {
    if (!token) {
      setError('You must be logged in to generate bracket');
      return;
    }
    if (!tournament) return;

    try {
      const bracketData = await tournamentApi.generateBracket(token, params.id);
      setMatches(bracketData);
      setError(''); // Clear any previous errors
      await fetchTournamentData(); // Refresh tournament status
    } catch (err) {
      console.error('Error generating bracket:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
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
        hour12: true
      });
    } catch (e) {
      return 'Not set';
    }
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
              {tournament.status === 'DRAFT' && (
                <button
                  onClick={async () => {
                    if (!token) {
                      setError('You must be logged in to update tournament status');
                      return;
                    }
                    try {
                      await tournamentApi.updateTournamentStatus(token, params.id, 'REGISTRATION');
                      setError(''); // Clear any previous errors
                      await fetchTournamentData();
                    } catch (err) {
                      setError('Failed to start registration');
                    }
                  }}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  Start Registration
                </button>
              )}
              {tournament.status === 'REGISTRATION' && participants.length >= 2 && (
                <button
                  onClick={handleGenerateBracket}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Generate Bracket
                </button>
              )}
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

          {/* Tournament Info */}
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
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Status</dt>
                    <dd className="mt-1 text-sm text-gray-900">{tournament.status}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Maximum Participants</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {typeof tournament.maxParticipants === 'number' ? tournament.maxParticipants : 'Unlimited'}
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Schedule</h2>
                <dl className="grid grid-cols-1 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Registration Deadline</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {tournament.registrationDeadline ? 
                        new Date(tournament.registrationDeadline).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) 
                        : 'Not set'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Start Time</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {tournament.startTime ? 
                        new Date(tournament.startTime).toLocaleString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true
                        }) 
                        : 'Not set'}
                    </dd>
                  </div>
                </dl>
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
                  {typeof tournament.maxParticipants === 'number' ? 
                    ` (max ${tournament.maxParticipants})` : 
                    ' (unlimited)'}
                </p>
              </div>
              {(!tournament.registrationDeadline || new Date(tournament.registrationDeadline) > new Date()) && (
                (!tournament.maxParticipants || participants.length < tournament.maxParticipants) ? (
                  <button
                    onClick={() => setIsAddingParticipant(true)}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Add Participant
                  </button>
                ) : (
                  <p className="text-sm text-yellow-600">Maximum participants reached</p>
                )
              )}
              {tournament.registrationDeadline && new Date(tournament.registrationDeadline) <= new Date() && (
                <p className="text-sm text-red-600">
                  Registration deadline has passed
                </p>
              )}
            </div>

            {isAddingParticipant && (!tournament.registrationDeadline || new Date(tournament.registrationDeadline) > new Date()) && (
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
                          {index + 1}. {participant.name}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Matches Section */}
          {tournament.status !== 'REGISTRATION' && tournament.status !== 'DRAFT' && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Matches</h2>
              {matches.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No matches generated yet</p>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {matches.map((match) => (
                    <div key={match.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Round {match.round}</span>
                        <span className="text-sm text-gray-500">{match.status}</span>
                      </div>
                      <div className="mt-2 space-y-2">
                        <div className="flex justify-between items-center">
                          <span>{match.participant1Id || 'TBD'}</span>
                          <span className="text-sm font-semibold">{match.score || '-'}</span>
                          <span>{match.participant2Id || 'TBD'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 