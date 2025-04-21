'use client';
import { useState, useEffect } from 'react';
import TournamentBracket from '../components/TournamentBracket';
import TournamentForm from '../components/TournamentForm';
import ParticipantForm from '../components/ParticipantForm';
import Auth from '../components/Auth';
import { api } from '../services/api';
import { Match, Participant, Tournament } from '../types/tournament';
import { AddParticipantRequest, CreateTournamentRequest, LoginRequest } from '../types/api';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'participants' | 'bracket'>('details');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      setIsAuthenticated(true);
      fetchTournaments();
    }
  }, []);

  const handleLogin = async (credentials: LoginRequest) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.login(credentials);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        localStorage.setItem('token', response.data.token);
        api.setToken(response.data.token);
        setIsAuthenticated(true);
        await fetchTournaments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchTournaments = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.getTournaments();
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setTournaments(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tournaments');
    } finally {
      setLoading(false);
    }
  };

  const handleTournamentSelect = async (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setActiveTab('details');
    await fetchTournamentData(tournament.id);
  };

  const fetchTournamentData = async (tournamentId: string) => {
    setLoading(true);
    setError('');
    try {
      const [matchesResponse, participantsResponse] = await Promise.all([
        api.getMatches(tournamentId),
        api.getParticipants(tournamentId),
      ]);

      if (matchesResponse.error) {
        throw new Error(matchesResponse.error);
      }
      if (participantsResponse.error) {
        throw new Error(participantsResponse.error);
      }

      if (matchesResponse.data) {
        setMatches(matchesResponse.data);
      }
      if (participantsResponse.data) {
        setParticipants(participantsResponse.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (tournamentData: CreateTournamentRequest) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.createTournament(tournamentData);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setTournaments([...tournaments, response.data]);
        setShowCreateForm(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async (participant: AddParticipantRequest) => {
    if (!selectedTournament) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.addParticipant(selectedTournament.id, participant);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setParticipants([...participants, response.data]);
        // Refresh tournament to get updated participant count
        const tournamentResponse = await api.getTournament(selectedTournament.id);
        if (tournamentResponse.error) {
          throw new Error(tournamentResponse.error);
        }
        if (tournamentResponse.data) {
          setSelectedTournament(tournamentResponse.data);
          const tournamentIndex = tournaments.findIndex(t => t.id === tournamentResponse.data.id);
          if (tournamentIndex !== -1) {
            const updatedTournaments = [...tournaments];
            updatedTournaments[tournamentIndex] = tournamentResponse.data;
            setTournaments(updatedTournaments);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = async (match: Match) => {
    if (!selectedTournament) return;
    // For now, just log the match. You can implement a match update modal/form here
    console.log('Match clicked:', match);
  };

  const handleGenerateBracket = async () => {
    if (!selectedTournament) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.generateBracket(selectedTournament.id);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setMatches(response.data);
        setActiveTab('bracket');
        // Refresh tournament to get updated status
        const tournamentResponse = await api.getTournament(selectedTournament.id);
        if (tournamentResponse.error) {
          throw new Error(tournamentResponse.error);
        }
        if (tournamentResponse.data) {
          setSelectedTournament(tournamentResponse.data);
          const tournamentIndex = tournaments.findIndex(t => t.id === tournamentResponse.data.id);
          if (tournamentIndex !== -1) {
            const updatedTournaments = [...tournaments];
            updatedTournaments[tournamentIndex] = tournamentResponse.data;
            setTournaments(updatedTournaments);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
    } finally {
      setLoading(false);
    }
  };

  const handleStartTournament = async () => {
    if (!selectedTournament) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.startTournament(selectedTournament.id);
      if (response.error) {
        throw new Error(response.error);
      }
      if (response.data) {
        setSelectedTournament(response.data);
        const tournamentIndex = tournaments.findIndex(t => t.id === response.data.id);
        if (tournamentIndex !== -1) {
          const updatedTournaments = [...tournaments];
          updatedTournaments[tournamentIndex] = response.data;
          setTournaments(updatedTournaments);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start tournament');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Tournament Manager</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            {showCreateForm ? 'Cancel' : 'Create Tournament'}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        )}

        {showCreateForm ? (
          <TournamentForm onSubmit={handleCreateTournament} />
        ) : (
          <div className="space-y-6">
            {!selectedTournament ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className="p-4 bg-white rounded-lg shadow cursor-pointer hover:shadow-md"
                    onClick={() => handleTournamentSelect(tournament)}
                  >
                    <h3 className="text-lg font-semibold">{tournament.name}</h3>
                    <p className="text-gray-600">{tournament.game}</p>
                    <p className="text-sm text-gray-500">
                      Status: {tournament.status}
                    </p>
                    <p className="text-sm text-gray-500">
                      Participants: {tournament.currentParticipants}/{tournament.maxParticipants}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <button
                    onClick={() => setSelectedTournament(null)}
                    className="text-indigo-600 hover:text-indigo-800"
                  >
                    ← Back to Tournaments
                  </button>
                  <div className="space-x-4">
                    {selectedTournament.status === 'REGISTRATION' && (
                      <button
                        onClick={handleGenerateBracket}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                        disabled={loading}
                      >
                        Generate Bracket
                      </button>
                    )}
                    {selectedTournament.status === 'DRAFT' && (
                      <button
                        onClick={handleStartTournament}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        disabled={loading}
                      >
                        Start Tournament
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                  <div className="border-b border-gray-200">
                    <nav className="-mb-px flex">
                      <button
                        onClick={() => setActiveTab('details')}
                        className={`py-4 px-6 text-sm font-medium ${
                          activeTab === 'details'
                            ? 'border-b-2 border-indigo-500 text-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Details
                      </button>
                      <button
                        onClick={() => setActiveTab('participants')}
                        className={`py-4 px-6 text-sm font-medium ${
                          activeTab === 'participants'
                            ? 'border-b-2 border-indigo-500 text-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Participants
                      </button>
                      <button
                        onClick={() => setActiveTab('bracket')}
                        className={`py-4 px-6 text-sm font-medium ${
                          activeTab === 'bracket'
                            ? 'border-b-2 border-indigo-500 text-indigo-600'
                            : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Bracket
                      </button>
                    </nav>
                  </div>

                  <div className="p-6">
                    {activeTab === 'details' && (
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900 mb-4">{selectedTournament.name}</h2>
                          <p>Game: {selectedTournament.game}</p>
                          <p>Format: {selectedTournament.format}</p>
                          <p>Status: {selectedTournament.status}</p>
                        </div>
                        <div>
                          <p>Participants: {selectedTournament.currentParticipants}/{selectedTournament.maxParticipants}</p>
                          <p>Start Date: {new Date(selectedTournament.startDate).toLocaleDateString()}</p>
                          <p>Registration Deadline: {new Date(selectedTournament.registrationDeadline).toLocaleDateString()}</p>
                        </div>
                        {selectedTournament.description && (
                          <div className="col-span-2 mt-4">
                            <h3 className="font-medium text-gray-900">Description</h3>
                            <p className="mt-1">{selectedTournament.description}</p>
                          </div>
                        )}
                        {selectedTournament.rules && (
                          <div className="col-span-2 mt-4">
                            <h3 className="font-medium text-gray-900">Rules</h3>
                            <p className="mt-1 whitespace-pre-wrap">{selectedTournament.rules}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'participants' && (
                      <ParticipantForm
                        onAddParticipant={handleAddParticipant}
                        participants={participants}
                        maxParticipants={selectedTournament.maxParticipants}
                        isLoading={loading}
                      />
                    )}

                    {activeTab === 'bracket' && (
                      <TournamentBracket
                        matches={matches}
                        participants={participants}
                        onMatchClick={handleMatchClick}
                        isLoading={loading}
                        error={error}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
