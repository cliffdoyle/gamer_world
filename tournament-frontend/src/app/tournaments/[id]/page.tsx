// src/app/tournaments/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { Tournament, Participant, Match, TournamentFormat } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BracketRenderer from '@/components/tournament/BracketRenderer';
import EliminationStatsTable from '@/components/tournament/EliminationStatsTable';
import { ArrowLeftIcon, PlusIcon, BoltIcon, TableCellsIcon, ListBulletIcon } from '@heroicons/react/24/outline';

interface AddParticipantFormData {
  name: string;
}

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const { id: tournamentId } = params;
  const router = useRouter();
  const { token } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]); // This holds raw API matches
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantForm, setParticipantForm] = useState<AddParticipantFormData>({ name: '' });
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [inlineEditingMatchId, setInlineEditingMatchId] = useState<string | null>(null);
  const [inlineScores, setInlineScores] = useState<{ p1: string, p2: string }>({ p1: '', p2: '' });
  
  const [viewMode, setViewMode] = useState<'bracket' | 'list'>('bracket');

  useEffect(() => {
    if (token && tournamentId) {
      fetchTournamentData();
    }
  }, [token, tournamentId]);

  useEffect(() => {
    if (tournament) {
      if (tournament.format === 'ROUND_ROBIN') {
        setViewMode('list');
      } else {
        setViewMode('bracket'); 
      }
    }
  }, [tournament]);

  const fetchTournamentData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        tournamentApi.getTournament(token!, tournamentId),
        tournamentApi.getParticipants(token!, tournamentId),
        tournamentApi.getMatches(token!, tournamentId) // Expecting matches with prereq IDs
      ]);
      setTournament(tournamentData);
      setParticipants(participantsData || []);
      setMatches(matchesData || []);
    } catch (err) {
      console.error('Error fetching tournament data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch tournament data';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token || !tournament || !participantForm.name.trim()) {
        setError("Name is required and you must be logged in."); return;
    }
    if (!isEffectivelyRegistrationPhase(tournament)) {
      setError("Registration is closed or tournament has already started/finished."); return;
    }
    if (matches.length > 0) {
        setError("Cannot add participants after the bracket has been generated."); return;
    }
    if (tournament.maxParticipants > 0 && participants.length >= tournament.maxParticipants) {
        setError(`Maximum participant limit (${tournament.maxParticipants}) reached.`); return;
    }
    try {
      await tournamentApi.addParticipant(token, tournament.id, { name: participantForm.name.trim() });
      setParticipantForm({ name: '' });
      setIsAddingParticipant(false); 
      await fetchTournamentData();
    } catch (err) {
      console.error("Add participant error:", err);
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  const handleGenerateBracket = async () => {
    setError(null);
    if (!token || !tournament) { 
        setError("Authentication or tournament data missing."); 
        return; 
    }
    if (participants.length < 2) { 
        setError("At least 2 participants are needed to generate a bracket."); 
        return; 
    }
    if (matches.length > 0) { 
        setError("Bracket has already been generated."); 
        return; 
    }
    if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION') {
        setError(`Tournament status (${tournament.status.toLowerCase()}) does not allow bracket generation.`); 
        return;
    }

    setIsGenerating(true);
    try {
      await tournamentApi.generateBracket(token, tournament.id);
      await fetchTournamentData(); 
    } catch (err) {
      console.error("Generate bracket error:", err);
      setError(err instanceof Error ? err.message : 'Failed to generate bracket');
    } finally {
      setIsGenerating(false);
    }
  };

  const submitScoreUpdate = async (matchToUpdate: Match, score1Str: string, score2Str: string): Promise<Match | null> => {
    if (!token || !tournament) return null;
    setError(null);
    const score1 = parseInt(score1Str);
    const score2 = parseInt(score2Str);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) { 
      setError("Scores must be non-negative numbers."); 
      return null; 
    }
    if (tournament.format !== 'ROUND_ROBIN' && score1 === score2) { 
      setError("Ties are not allowed in this format."); 
      return null; 
    }

    try {
      const updatedMatchData = await tournamentApi.updateMatch(token, tournament.id, matchToUpdate.id, {
        participant1Score: score1,
        participant2Score: score2,
      });

      setMatches(prevMatches =>
        prevMatches.map(m => (m.id === updatedMatchData.id ? { ...m, ...updatedMatchData } : m))
      );
      return updatedMatchData;
    } catch (err) { 
        console.error("Submit Score Update Error:", err);
        setError(err instanceof Error ? err.message : 'Failed to update score'); 
        return null; 
    }
  };

  const handleInlineScoreSubmit = async () => {
    if(!inlineEditingMatchId) return;
    const match = matches.find(m => m.id === inlineEditingMatchId);
    if(match) { 
      const updatedMatch = await submitScoreUpdate(match, inlineScores.p1, inlineScores.p2);
      if(updatedMatch) {
        setInlineEditingMatchId(null); 
        setInlineScores({p1:'', p2:''});
      }
    } else { setError("Error: Could not find match to update inline.");}
  };
  
  const handleMatchClickForEdit = (match: Match) => {
    if (!tournament) return;
    if (match.participant1_id && match.participant2_id && match.status !== 'COMPLETED') {
        setInlineEditingMatchId(match.id);
        setInlineScores({ 
          p1: match.score_participant1?.toString() || '0', 
          p2: match.score_participant2?.toString() || '0'
        });
    } else if (match.status !== 'COMPLETED' && (!match.participant1_id || !match.participant2_id) && (match.participant1_prereq_match_id || match.participant2_prereq_match_id)){
        // This condition allows clicking on a TBD match if its slots *could* be fillable by user action (though not via direct score input yet)
        // For now, let's prevent direct editing of TBD matches this way unless they are fully populated
        // console.log("Match is TBD and not directly editable for score:", match);
    }
  };

  const formatDateTime = (dateString: string | null): string => {
     if (!dateString || dateString.trim() === "") return 'Not Set';
    try {
        let dateToParse = dateString;
        if (dateString.length === 10 && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateToParse = dateString + 'T00:00:00Z'; 
            return new Date(dateToParse).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
        }
        const date = new Date(dateToParse);
        if (isNaN(date.getTime())) throw new Error("Invalid date value");
        return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
    } catch (e) { console.error("Date Parse Error in formatDateTime:", dateString, e); return 'Invalid Date Format'; }
  };

  const isEffectivelyRegistrationPhase = (currentTournament: Tournament | null): boolean => {
    if (!currentTournament) return false;
    const now = new Date();
    const deadline = currentTournament.registrationDeadline ? new Date(currentTournament.registrationDeadline) : null;
    if (currentTournament.status === 'COMPLETED' || currentTournament.status === 'CANCELLED' || currentTournament.status === 'IN_PROGRESS') return false;
    if (deadline && now > deadline) return false;
    return true;
  };

  const canAddParticipants = isEffectivelyRegistrationPhase(tournament) && matches.length === 0;
  
  const canGenerateBracket = 
    tournament !== null &&
    participants.length >= 2 &&
    matches.length === 0 &&
    (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') &&
    !isGenerating;


  if (isLoading) return <ProtectedRoute><div className="min-h-screen flex justify-center items-center bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div></div></ProtectedRoute>;
  if (!tournament && !isLoading) return <ProtectedRoute><div className="min-h-screen bg-slate-900 text-slate-300 p-8 text-center">Tournament (ID: {tournamentId}) not found or failed to load. {error && <span className="block mt-2 text-red-400">Error: {error}</span>}</div></ProtectedRoute>;
  if (!tournament) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-900 text-slate-300 selection:bg-blue-500 selection:text-white">
        <div className="container mx-auto px-2 py-6 sm:px-4 md:px-6 lg:px-8 space-y-6 md:space-y-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-700 pb-6">
            <div className="flex-grow">
              <button onClick={() => router.push('/tournaments')} className="text-xs text-blue-400 hover:text-blue-300 mb-2 inline-flex items-center group">
                <ArrowLeftIcon className="h-4 w-4 mr-1.5 group-hover:-translate-x-0.5 transition-transform" /> Back to Tournaments
              </button>
              <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-50 tracking-tight break-words">{tournament.name}</h1>
              <p className="text-sm text-slate-400 mt-1 italic">{tournament.description || "No description."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="badge badge-lg bg-sky-600/80 text-sky-50 border-sky-500 backdrop-blur-sm">{tournament.format.replace(/_/g, ' ')}</span>
                  <span className={`badge badge-lg text-white border-opacity-50 backdrop-blur-sm ${
                    tournament.status === 'COMPLETED' ? 'bg-green-600/80 border-green-500' :
                    tournament.status === 'IN_PROGRESS' ? 'bg-yellow-600/80 border-yellow-500' :
                    tournament.status === 'REGISTRATION' ? 'bg-blue-600/80 border-blue-500' :
                    'bg-purple-600/80 border-purple-500'
                  }`}>{tournament.status}</span>
                  <span className="badge badge-lg bg-slate-700/80 text-slate-300 border-slate-600 backdrop-blur-sm">Game: {tournament.game}</span>
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleGenerateBracket}
                className="btn btn-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold w-full sm:w-auto shadow-lg disabled:opacity-60 disabled:saturate-50 disabled:cursor-not-allowed"
                disabled={!canGenerateBracket}
              >
                <BoltIcon className="h-4 w-4 mr-1.5"/>
                {isGenerating ? "Generating..." : (matches.length > 0 ? "Generated" : "Generate Bracket")}
              </button>
            </div>
          </div>
          
          {error && <div role="alert" className="alert bg-red-500/20 border border-red-500/50 text-red-300 text-sm"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>ERROR: {error}</span></div>}
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 text-sm">
              <div className="md:col-span-1 card bg-slate-800/70 shadow-xl compact backdrop-blur-sm border border-slate-700/50">
                <div className="card-body p-4">
                      <h2 className="card-title text-base !mb-2 text-slate-200">Schedule</h2>
                      <div className="space-y-1">
                        <p className="text-slate-400">Reg. Deadline: <span className="font-semibold text-slate-100">{formatDateTime(tournament.registrationDeadline)}</span></p>
                        <p className="text-slate-400">Starts: <span className="font-semibold text-slate-100">{formatDateTime(tournament.startTime)}</span></p>
                      </div>
                      {isEffectivelyRegistrationPhase(tournament) && matches.length === 0 && <p className="text-green-400 text-xs mt-2 p-2 bg-green-500/10 rounded-md">Registration is currently open.</p>}
                      {!isEffectivelyRegistrationPhase(tournament) && matches.length === 0 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && <p className="text-amber-400 text-xs mt-2 p-2 bg-amber-500/10 rounded-md">Registration closed or TBD. Ready for bracket generation.</p>}
                  </div>
              </div>
              <div className="md:col-span-2 card bg-slate-800/70 shadow-xl compact backdrop-blur-sm border border-slate-700/50">
                   <div className="card-body p-4">
                      <div className="flex justify-between items-center mb-2">
                          <h2 className="card-title text-base !mb-0 text-slate-200">Participants ({participants.length} / {tournament.maxParticipants > 0 ? tournament.maxParticipants : 'Open'})</h2>
                          <button 
                            className="btn btn-xs bg-blue-500 hover:bg-blue-600 border-blue-600 text-white shadow disabled:opacity-50 disabled:saturate-50 disabled:cursor-not-allowed" 
                            onClick={() => setIsAddingParticipant(!isAddingParticipant)}
                            disabled={!canAddParticipants}
                          >
                            <PlusIcon className="h-3.5 w-3.5 mr-1"/> {isAddingParticipant ? 'Cancel Adding' : 'Add New'}
                          </button>
                      </div>
                      {isAddingParticipant && canAddParticipants && (
                          <form onSubmit={handleAddParticipant} className="flex gap-2 my-3 items-center p-2 bg-slate-700/50 rounded-md">
                              <input type="text" value={participantForm.name} onChange={e => setParticipantForm({name: e.target.value})} placeholder="New Participant Name" className="input input-sm input-bordered flex-grow bg-slate-700 text-slate-100 border-slate-600 focus:border-blue-500 placeholder-slate-500" required/>
                              <button type="submit" className="btn btn-sm btn-success text-white">Add</button>
                          </form>
                      )}
                       {participants.length > 0 ? (
                          <div className="max-h-32 overflow-y-auto text-xs pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50 mt-1">
                              <ul className="list-none space-y-1 text-slate-300">
                                  {participants.map((p, i) => <li key={p.id} className="py-1 px-1.5 bg-slate-700/60 rounded-md flex justify-between items-center">
                                    <span>{i + 1}. {p.participant_name}{p.seed != null ? <span className="text-slate-500 text-xxs ml-1">(S:{p.seed})</span>: ''}</span>
                                    </li>)}
                              </ul>
                          </div>
                      ) : <p className="text-slate-500 italic text-xs py-2">{canAddParticipants ? "No participants yet. Click 'Add New' to start." : "No participants registered."}</p>}
                      
                      {!canAddParticipants && !isAddingParticipant && matches.length === 0 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && 
                        <p className="text-sky-400 text-xs mt-2 p-2 bg-sky-500/10 rounded-md">
                            {(participants.length < 2) ? "Needs at least 2 participants to generate." : 
                             "Ready to generate bracket."
                            }
                        </p>
                      }
                      {matches.length > 0 && <p className="text-green-400 text-xs mt-2 p-2 bg-green-500/10 rounded-md">Bracket has been generated.</p>}
                   </div>
              </div>
          </div>

          {matches.length > 0 && tournament && (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && (
             <div className="my-6 md:my-8">
                <EliminationStatsTable tournament={tournament} participants={participants} matches={matches} />
             </div>
          )}

          <div className="card bg-slate-800 shadow-2xl backdrop-blur-sm border border-slate-700/50">
              <div className="card-body p-1 py-3 sm:p-2 md:p-4">
                  {(tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && matches.length > 0 && (
                     <div className="flex justify-center sm:justify-end mb-4">
                        <div className="tabs tabs-boxed tabs-sm bg-slate-700/50 p-0.5">
                            <a className={`tab text-xs px-3 py-1.5 ${viewMode === 'bracket' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-600/70'}`} onClick={() => setViewMode('bracket')}><TableCellsIcon className="h-4 w-4 mr-1"/>Bracket</a>
                            <a className={`tab text-xs px-3 py-1.5 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-600/70'}`} onClick={() => setViewMode('list')}><ListBulletIcon className="h-4 w-4 mr-1"/>List</a>
                        </div>
                    </div>
                  )}
                  
                  {isLoading && matches.length === 0 ? <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div></div> :
                  (matches.length > 0 || (tournament.format === 'ROUND_ROBIN' && participants.length >= 2 && tournament.status !== 'COMPLETED' && tournament.status !== 'CANCELLED')) ? ( 
                       <BracketRenderer
                          tournament={tournament}
                          matches={matches} // Pass raw matches here
                          participants={participants}
                          onMatchClick={handleMatchClickForEdit}
                          inlineEditingMatchId={inlineEditingMatchId}
                          inlineScores={inlineScores}
                          onInlineScoreChange={setInlineScores}
                          onInlineScoreSubmit={handleInlineScoreSubmit}
                          onCancelInlineEdit={() => { setInlineEditingMatchId(null); setInlineScores({p1:'', p2:''}); }}
                      />
                  ) : (
                      <div className="text-center py-10 px-4 min-h-[200px] flex flex-col justify-center items-center">
                          <p className="text-slate-400 mb-4">
                              {participants.length < 2 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') ? "This tournament needs at least 2 participants to generate matches." : 
                               (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') ? `This tournament is ${tournament.status.toLowerCase()}.` :
                               "The matches for this tournament have not been generated yet."}
                          </p>
                           {!matches.length && 
                              <button 
                                onClick={handleGenerateBracket} 
                                className="btn btn-md bg-blue-600 hover:bg-blue-700 text-white shadow-lg disabled:opacity-50 disabled:saturate-50 disabled:cursor-not-allowed"
                                disabled={!canGenerateBracket}
                              >
                                <BoltIcon className="h-5 w-5 mr-2"/> Generate Bracket Now
                              </button>
                           }
                      </div>
                  )}
              </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}