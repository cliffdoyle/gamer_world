// src/app/tournaments/[id]/page.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { Tournament, Participant, Match, TournamentFormat } from '@/types/tournament'; // Your existing types
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BracketRenderer from '@/components/tournament/BracketRenderer';
import MatchScoreEditor from '@/components/tournament/MatchScoreEditor'; // You'll need this for scoring

interface AddParticipantFormData {
  name: string;
}

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const { id: tournamentId } = params;
  const router = useRouter();
  const { token } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // UI State
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantForm, setParticipantForm] = useState<AddParticipantFormData>({ name: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'bracket' | 'list'>('bracket'); // Default to bracket/table view
  const [isEditingMatch, setIsEditingMatch] = useState<Match | null>(null); // Store the whole match object

  useEffect(() => {
    if (token && tournamentId) {
      fetchTournamentData();
    }
  }, [token, tournamentId]);

  const fetchTournamentData = async () => {
    setIsLoading(true);
    try {
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        tournamentApi.getTournament(token!, tournamentId),
        tournamentApi.getParticipants(token!, tournamentId),
        tournamentApi.getMatches(token!, tournamentId)
      ]);
      setTournament(tournamentData);
      setParticipants(participantsData || []);
      setMatches(matchesData || []);
      setError('');
       // Default view mode based on format if matches are present
      if (matchesData && matchesData.length > 0) {
          if (tournamentData.format === 'ROUND_ROBIN') {
            setViewMode('bracket'); // 'bracket' view for RoundRobinTable will show standings and matches
          } else {
            setViewMode('bracket'); // Default to actual bracket for elimination
          }
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
    if (!token || !tournament || !participantForm.name.trim()) return;
    if (!isRegistrationOpen(tournament)) {
      setError("Registration deadline has passed or tournament has started.");
      return;
    }
    if (matches.length > 0) {
        setError("Cannot add participants after the bracket has been generated.");
        return;
    }

    try {
      await tournamentApi.addParticipant(token, tournament.id, { name: participantForm.name.trim() });
      setParticipantForm({ name: '' });
      setIsAddingParticipant(false);
      fetchTournamentData(); // Refresh
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  const handleGenerateBracket = async () => {
    if (!token || !tournament || participants.length < 2) {
        setError("At least 2 participants are needed to generate a bracket.");
        return;
    }
    setIsGenerating(true);
    try {
      await tournamentApi.generateBracket(token, tournament.id);
      fetchTournamentData(); // Refresh to get new matches
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateMatchScore = async (matchId: string, p1ScoreStr: string, p2ScoreStr: string) => {
    if (!token || !isEditingMatch || !tournament) return;

    const score1 = parseInt(p1ScoreStr);
    const score2 = parseInt(p2ScoreStr);

    if (isNaN(score1) || isNaN(score2)) {
        setError("Scores must be numbers.");
        return;
    }
    if (tournament.format !== 'ROUND_ROBIN' && score1 === score2) {
        setError("Ties are not allowed in this format.");
        return;
    }

    const winnerId = score1 > score2 ? isEditingMatch.participant1_id
                   : score2 > score1 ? isEditingMatch.participant2_id
                   : null;
    try {
      await tournamentApi.updateMatch(token, tournament.id, matchId, {
        participant1Score: score1,
        participant2Score: score2,
        winnerId: winnerId,
        status: 'COMPLETED'
      });
      setIsEditingMatch(null);
      fetchTournamentData(); // Refresh data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update score');
    }
  };


  const formatDateTime = (dateString: string | null): string => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return 'Invalid Date';
    }
  };

  const isRegistrationOpen = (currentTournament: Tournament | null): boolean => {
    if (!currentTournament) return false;
    const now = new Date();
    const deadline = currentTournament.registrationDeadline ? new Date(currentTournament.registrationDeadline) : null;
    const startTime = currentTournament.startTime ? new Date(currentTournament.startTime) : null;
    
    if (deadline && now > deadline) return false; // Past registration deadline
    if (startTime && now > startTime && currentTournament.status !== 'REGISTRATION') return false; // Tournament started (and not in REG status anymore)
    return true;
  };


  const getParticipantNameById = (id: string | null): string => {
    if (!id) return 'TBD';
    const p = participants.find(p => p.id === id);
    return p ? p.participant_name : 'Unknown';
  };


  if (isLoading) return <ProtectedRoute><div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div></div></ProtectedRoute>;
  if (error && !tournament) return <ProtectedRoute><div className="p-4 text-center text-red-500">Error loading tournament: {error}</div></ProtectedRoute>;
  if (!tournament) return <ProtectedRoute><div className="p-4 text-center">Tournament not found.</div></ProtectedRoute>;


  const canAddParticipants = isRegistrationOpen(tournament) && matches.length === 0;
  const canGenerateBracket = participants.length >= 2 && matches.length === 0;

  return (
    <ProtectedRoute>
      {isEditingMatch && (
        <MatchScoreEditor
          match={isEditingMatch}
          participant1Name={getParticipantNameById(isEditingMatch.participant1_id)}
          participant2Name={getParticipantNameById(isEditingMatch.participant2_id)}
          onSubmit={handleUpdateMatchScore}
          onCancel={() => setIsEditingMatch(null)}
          isSubmitting={false} // You can add submitting state if needed
        />
      )}
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{tournament.name}</h1>
            <p className="text-sm text-gray-600">{tournament.description}</p>
            <div className="mt-2 text-xs space-x-2">
                <span className="badge badge-info badge-outline">{tournament.format.replace(/_/g, ' ')}</span>
                <span className="badge badge-neutral badge-outline">{tournament.status}</span>
                <span className="badge badge-ghost">Game: {tournament.game}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/tournaments')} className="btn btn-sm btn-outline">
              All Tournaments
            </button>
            <button
              onClick={handleGenerateBracket}
              className="btn btn-sm btn-primary"
              disabled={!canGenerateBracket || isGenerating}
            >
              {isGenerating ? "Generating..." : (matches.length > 0 ? "Bracket Generated" : "Generate Bracket")}
            </button>
          </div>
        </div>

        {error && <div role="alert" className="alert alert-error text-sm"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{error}</span></div>}
        
        {/* Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="card bg-base-100 shadow">
                <div className="card-body p-4">
                    <h2 className="card-title text-base">Schedule</h2>
                    <p>Registration Deadline: <span className="font-semibold">{formatDateTime(tournament.registrationDeadline)}</span></p>
                    <p>Starts: <span className="font-semibold">{formatDateTime(tournament.startTime)}</span></p>
                    {!isRegistrationOpen(tournament) && matches.length === 0 && <p className="text-warning">Registration is closed. Generate bracket if ready.</p>}
                </div>
            </div>
            <div className="card bg-base-100 shadow">
                 <div className="card-body p-4">
                    <div className="flex justify-between items-center">
                        <h2 className="card-title text-base">Participants ({participants.length} / {tournament.maxParticipants || '∞'})</h2>
                        {canAddParticipants && (
                             <button className="btn btn-xs btn-outline btn-info" onClick={() => setIsAddingParticipant(true)}>Add</button>
                        )}
                    </div>
                    {isAddingParticipant && (
                        <form onSubmit={handleAddParticipant} className="flex gap-2 mt-2">
                            <input type="text" value={participantForm.name} onChange={e => setParticipantForm({name: e.target.value})} placeholder="Participant Name" className="input input-sm input-bordered flex-grow" required/>
                            <button type="submit" className="btn btn-sm btn-success">Save</button>
                            <button type="button" onClick={() => setIsAddingParticipant(false)} className="btn btn-sm btn-ghost">X</button>
                        </form>
                    )}
                    {participants.length > 0 ? (
                        <ul className="list-decimal list-inside max-h-40 overflow-y-auto text-xs mt-2">
                            {participants.map(p => <li key={p.id}>{p.participant_name}{p.seed ? ` (S${p.seed})`: ''}</li>)}
                        </ul>
                    ) : <p className="text-gray-500 italic">No participants yet.</p>}
                    {!canAddParticipants && !isAddingParticipant && matches.length === 0 && <p className="text-info text-xs mt-1">Registration closed or tournament started. Generate bracket.</p>}
                    {matches.length > 0 && <p className="text-success text-xs mt-1">Bracket has been generated.</p>}
                 </div>
            </div>
        </div>

        {/* Bracket/Table View */}
        {matches.length > 0 && tournament && (
            <div className="card bg-base-100 shadow">
                 <div className="card-body p-0 sm:p-4"> {/* Less padding on small screen for bracket */}
                    <div className="flex justify-end p-2 sm:p-0 mb-2">
                        {(tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && (
                             <div className="tabs tabs-boxed tabs-sm">
                                <a className={`tab ${viewMode === 'bracket' ? 'tab-active' : ''}`} onClick={() => setViewMode('bracket')}>Bracket</a>
                                <a className={`tab ${viewMode === 'list' ? 'tab-active' : ''}`} onClick={() => setViewMode('list')}>List</a>
                            </div>
                        )}
                    </div>

                    { (viewMode === 'list' && (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') ) ? (
                        // Basic List View placeholder - implement full list view as needed
                        <div className="p-4">
                           <h3 className="text-lg font-semibold mb-2">Matches (List View)</h3>
                            {/* Group matches by round for a more structured list view */}
                            {Object.entries(matches.reduce((acc, match) => {
                                (acc[match.round] = acc[match.round] || []).push(match);
                                return acc;
                            }, {} as Record<number, Match[]>)).sort(([a],[b])=>Number(a)-Number(b)).map(([round, roundMatches]) => (
                                <div key={round} className="mb-4">
                                    <h4 className="font-medium text-gray-700 mb-1">Round {round}</h4>
                                    {roundMatches.map(m => (
                                        <div key={m.id} className="text-xs p-2 border-b hover:bg-gray-50 cursor-pointer" onClick={() => m.participant1_id && m.participant2_id && m.status !== 'COMPLETED' && setIsEditingMatch(m)}>
                                            {getParticipantNameById(m.participant1_id)} ({m.score_participant1 ?? '-'}) vs {getParticipantNameById(m.participant2_id)} ({m.score_participant2 ?? '-'})
                                            <span className={`ml-2 badge badge-xs ${m.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>{m.status}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <BracketRenderer
                            tournament={tournament}
                            matches={matches}
                            participants={participants}
                            onMatchClick={(match) => { // Match object now directly passed
                                // Only allow editing if participants are present and match is not completed
                                if (match.participant1_id && match.participant2_id && match.status !== 'COMPLETED') {
                                    setIsEditingMatch(match);
                                }
                            }}
                        />
                    )}
                 </div>
            </div>
        )}
        {matches.length === 0 && !isLoading && (
            <div className="text-center p-6 bg-base-100 shadow rounded-lg">
                <p className="text-gray-500">
                    {participants.length < 2 ? "Add at least 2 participants to generate a bracket." : "Bracket has not been generated yet."}
                </p>
            </div>
        )}

      </div>
    </ProtectedRoute>
  );
}