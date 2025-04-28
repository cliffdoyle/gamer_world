'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { Tournament, Match, Participant, TournamentFormat } from '@/types/tournament';
import BracketViewer from '@/components/tournament/BracketViewer';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function BracketTestPage() {
  const { token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tournaments on component mount
  useEffect(() => {
    if (token) {
      fetchTournaments();
    }
  }, [token]);

  // Fetch selected tournament data
  useEffect(() => {
    if (token && selectedTournament) {
      fetchTournamentData(selectedTournament.id);
    }
  }, [token, selectedTournament]);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await tournamentApi.getAllTournaments(token!);
      setTournaments(response.tournaments);
      setError(null);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournaments. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTournamentData = async (tournamentId: string) => {
    try {
      setLoading(true);
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        tournamentApi.getTournament(token!, tournamentId),
        tournamentApi.getParticipants(token!, tournamentId),
        tournamentApi.getMatches(token!, tournamentId)
      ]);
      
      setSelectedTournament(tournamentData);
      setParticipants(participantsData);
      setMatches(matchesData);
      setError(null);
    } catch (err) {
      console.error('Error fetching tournament data:', err);
      setError('Failed to load tournament data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBracket = async () => {
    if (!token || !selectedTournament) return;
    
    try {
      setLoading(true);
      await tournamentApi.generateBracket(token, selectedTournament.id);
      await fetchTournamentData(selectedTournament.id);
      setError(null);
    } catch (err) {
      console.error('Error generating bracket:', err);
      setError('Failed to generate bracket. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatCount = (count: number | undefined) => {
    if (count === undefined) return 'None';
    return count;
  };

  return (
    <ProtectedRoute>
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900">Bracket Visualization Test</h1>
          
          {error && (
            <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          <div className="mt-6 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Select a Tournament</h2>
            
            {loading && !selectedTournament ? (
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tournaments.map((tournament) => (
                  <div 
                    key={tournament.id}
                    onClick={() => setSelectedTournament(tournament)}
                    className={`p-4 border rounded-md cursor-pointer transition-all ${
                      selectedTournament?.id === tournament.id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900">{tournament.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{tournament.format}</p>
                    <p className="text-sm text-gray-500">Status: {tournament.status}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {selectedTournament && (
            <div className="mt-6 bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{selectedTournament.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedTournament.description}</p>
                  <div className="mt-2 flex items-center space-x-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {selectedTournament.format}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {selectedTournament.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Participants:</span> {formatCount(participants.length)}
                    </div>
                    <div>
                      <span className="font-medium">Matches:</span> {formatCount(matches.length)}
                    </div>
                  </div>
                </div>
                
                <div className="flex">
                  <button
                    onClick={() => setSelectedTournament(null)}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 mr-2"
                  >
                    Back to List
                  </button>
                  
                  <button
                    onClick={handleGenerateBracket}
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : 'Generate Bracket'}
                  </button>
                </div>
              </div>
              
              {/* Bracket Visualization */}
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : matches.length > 0 ? (
                <div className="mt-6 bg-white rounded-lg overflow-auto">
                  <BracketViewer 
                    tournament={selectedTournament}
                    matches={matches}
                    participants={participants}
                  />
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 rounded-md">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No bracket generated</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Click "Generate Bracket" to create a tournament bracket.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
} 