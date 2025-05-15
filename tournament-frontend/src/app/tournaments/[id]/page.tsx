// src/app/tournaments/[id]/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { userApi, UserForLinkingResponse } from '@/lib/api/user';
import { Tournament, Participant, Match } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BracketRenderer from '@/components/tournament/BracketRenderer';
import EliminationStatsTable from '@/components/tournament/EliminationStatsTable';
import { ArrowLeftIcon, PlusIcon, BoltIcon, TableCellsIcon, ListBulletIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import useDebounce from '@/hooks/useDebounce'; // <<< IMPORT DEBOUNCE HOOK

export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const { id: tournamentId } = params;
  const router = useRouter();
  const { token } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // --- State for Add Participant with Autocomplete ---
  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantSearchText, setParticipantSearchText] = useState(''); // Text typed by organizer to search for a user
  const debouncedSearchText = useDebounce(participantSearchText, 300); // <<< USE DEBOUNCE
  const [participantDisplayName, setParticipantDisplayName] = useState(''); // Display name for this tournament
  const [selectedUserForParticipant, setSelectedUserForParticipant] = useState<UserForLinkingResponse | null>(null);
  const [allLinkableUsers, setAllLinkableUsers] = useState<UserForLinkingResponse[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserForLinkingResponse[]>([]);
  const [isLoadingLinkableUsers, setIsLoadingLinkableUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false); // Control suggestion visibility
  // --- End of Add Participant State ---

  const [isGenerating, setIsGenerating] = useState(false);
  const [inlineEditingMatchId, setInlineEditingMatchId] = useState<string | null>(null);
  const [inlineScores, setInlineScores] = useState<{ p1: string, p2: string }>({ p1: '', p2: '' });
  const [viewMode, setViewMode] = useState<'bracket' | 'list'>('bracket');

  const fetchTournamentData = useCallback(async () => {
    if (!token || !tournamentId) return;
    setIsLoading(true); setError(null);
    try {
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        tournamentApi.getTournament(token, tournamentId),
        tournamentApi.getParticipants(token, tournamentId),
        tournamentApi.getMatches(token, tournamentId)
      ]);
      setTournament(tournamentData);
      setParticipants(participantsData || []);
      setMatches(matchesData || []);
    } catch (err: any) { setError(err.message || 'Failed to fetch tournament data');
    } finally { setIsLoading(false); }
  }, [token, tournamentId]);

  useEffect(() => {
    if (token && tournamentId) {
      fetchTournamentData();
    }
  }, [token, tournamentId, fetchTournamentData]);

  useEffect(() => {
    if (tournament) {
      setViewMode(tournament.format === 'ROUND_ROBIN' ? 'list' : 'bracket');
    }
  }, [tournament]);

  useEffect(() => {
    if (isAddingParticipant && token && allLinkableUsers.length === 0) {
      setIsLoadingLinkableUsers(true);
      userApi.listUsersForLinking(token)
        .then(response => setAllLinkableUsers(response.users || []))
        .catch(err => { console.error("Failed to fetch linkable users:", err); setError("Could not load registered users list."); })
        .finally(() => setIsLoadingLinkableUsers(false));
    }
  }, [isAddingParticipant, token, allLinkableUsers.length]);

  // Filter users for suggestions based on DEBOUNCED search text
  useEffect(() => {
    if (debouncedSearchText.trim() === '') {
      setSuggestedUsers([]);
      setShowSuggestions(false);
      return;
    }
    // Don't show suggestions if a user is already selected and the search text matches their username
    if (selectedUserForParticipant && selectedUserForParticipant.username === debouncedSearchText) {
        setSuggestedUsers([]);
        setShowSuggestions(false);
        return;
    }

    const filtered = allLinkableUsers.filter(user =>
      user.username.toLowerCase().includes(debouncedSearchText.toLowerCase()) &&
      !participants.some(p => p.user_id === user.id)
    ).slice(0, 5);
    setSuggestedUsers(filtered);
    setShowSuggestions(filtered.length > 0); // Show suggestions if there are any
  }, [debouncedSearchText, allLinkableUsers, participants, selectedUserForParticipant]);

  const handleParticipantSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantSearchText(e.target.value);
    setSelectedUserForParticipant(null); // Clear selection if search text changes
    setParticipantDisplayName('');      // Also clear display name
    setShowSuggestions(true);           // Allow suggestions to show
    setError(null); setSuccessMessage(null);
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantDisplayName(e.target.value);
  };

  const handleSelectSuggestedUser = (user: UserForLinkingResponse) => {
    setParticipantSearchText(user.username);    // Fill search input with selected username
    setParticipantDisplayName(user.username);   // Default display name to their username
    setSelectedUserForParticipant(user);
    setSuggestedUsers([]);
    setShowSuggestions(false); // Hide suggestions after selection
  };

  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null); setError(null);

    if (!token || !tournament) { setError("Authentication or tournament data missing."); return; }
    if (!selectedUserForParticipant) { setError("Please search and select a registered platform user."); return; }
    if (!participantDisplayName.trim()) { setError("Participant display name for this tournament is required."); return; }
    // ... (other validation checks: registration phase, max participants, etc.) ...
    if (!isEffectivelyRegistrationPhase(tournament)) { setError("Registration is closed or tournament has already started/finished."); return; }
    if (matches.length > 0) { setError("Cannot add participants after the bracket has been generated."); return; }
    if (tournament.maxParticipants > 0 && participants.length >= tournament.maxParticipants) { setError(`Maximum participant limit (${tournament.maxParticipants}) reached.`); return; }
    if (participants.some(p => p.user_id === selectedUserForParticipant.id)) { setError(`User '${selectedUserForParticipant.username}' is already a participant in this tournament.`); return; }


    try {
      await tournamentApi.addParticipant(token, tournament.id, {
        name: participantDisplayName.trim(),         // This is the name for display IN THIS TOURNAMENT
        userIdToLink: selectedUserForParticipant.id, // This is the system UserID (UUID)
      });
      setSuccessMessage(`Participant '${participantDisplayName.trim()}' (linked to ${selectedUserForParticipant.username}) added!`);
      setParticipantSearchText('');
      setParticipantDisplayName('');
      setSelectedUserForParticipant(null);
      setShowSuggestions(false);
      // setIsAddingParticipant(false); // Optionally close form
      await fetchTournamentData();
    } catch (err: any) { setError(err.message || 'Failed to add participant'); }
  };

  // ... (handleGenerateBracket, submitScoreUpdate, handleInlineScoreSubmit, handleMatchClickForEdit, formatDateTime, isEffectivelyRegistrationPhase, canAddParticipants, canGenerateBracket) ...
  // ... (Keep these functions as they were, or with minor success/error message clearing)

  const handleGenerateBracket = async () => { /* ... clear success/error ... */ setError(null); setSuccessMessage(null); /* ... rest of function ... */ };
  const submitScoreUpdate = async (matchToUpdate: Match, score1Str: string, score2Str: string): Promise<Match | null> => { /* ... clear success/error ... */ setError(null); setSuccessMessage(null); /* ... rest of function ... */ return null; };
  const handleMatchClickForEdit = (match: Match) => { /* ... clear success/error ... */ setError(null); setSuccessMessage(null); /* ... rest of function ... */ };
  const formatDateTime = (dateString: string | null): string => { if (!dateString || dateString.trim() === "") return 'Not Set'; try { let dateToParse = dateString; if (dateString.length === 10 && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { dateToParse = dateString + 'T00:00:00Z'; return new Date(dateToParse).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }); } const date = new Date(dateToParse); if (isNaN(date.getTime())) throw new Error("Invalid date value from string: " + dateString); return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); } catch (e) { console.error("Date Parse Error in formatDateTime:", dateString, e); return 'Invalid Date Format'; } };
  const isEffectivelyRegistrationPhase = (currentTournament: Tournament | null): boolean => { if (!currentTournament) return false; const now = new Date(); const deadline = currentTournament.registrationDeadline ? new Date(currentTournament.registrationDeadline) : null; if (currentTournament.status !== 'DRAFT' && currentTournament.status !== 'REGISTRATION') return false; if (deadline && now > deadline) return false; return true; };
  const canAddParticipants = isEffectivelyRegistrationPhase(tournament) && matches.length === 0;
  const canGenerateBracket = tournament !== null && participants.length >= 2 && matches.length === 0 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && !isGenerating;


  if (isLoading && !tournament) return <ProtectedRoute><div className="min-h-screen flex justify-center items-center bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div></div></ProtectedRoute>;
  if (!tournament && !isLoading) return <ProtectedRoute><div className="min-h-screen bg-slate-900 text-slate-300 p-8 text-center">Tournament (ID: {tournamentId}) not found or failed to load. {error && <span className="block mt-2 text-red-400">Error: {error}</span>}</div></ProtectedRoute>;
  if (!tournament) return null;

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-900 text-slate-300 selection:bg-blue-500 selection:text-white">
        <div className="container mx-auto px-2 py-6 sm:px-4 md:px-6 lg:px-8 space-y-6 md:space-y-8">
          {/* Header Section ... same ... */}
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
                {isGenerating ? "Generating..." : (matches.length > 0 ? "Bracket Generated" : "Generate Bracket")}
              </button>
            </div>
          </div>

          {/* Error and Success Messages */}
          {error && <div role="alert" className="alert bg-red-500/20 border border-red-500/50 text-red-300 text-sm mb-4"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>ERROR: {error}</span></div>}
          {successMessage && <div role="alert" className="alert bg-green-500/20 border border-green-500/50 text-green-300 text-sm mb-4"><svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span>{successMessage}</span></div>}
          
          {/* Info Cards ... same ... */}
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
                            onClick={() => { setIsAddingParticipant(!isAddingParticipant); setError(null); setSuccessMessage(null); setParticipantSearchText(''); setParticipantDisplayName(''); setSelectedUserForParticipant(null); setShowSuggestions(false); }}
                            disabled={!canAddParticipants}
                          >
                            <PlusIcon className="h-3.5 w-3.5 mr-1"/> {isAddingParticipant ? 'Cancel Adding' : 'Add Participant'}
                          </button>
                      </div>
                      
                      {isAddingParticipant && canAddParticipants && (
                          <form onSubmit={handleAddParticipantSubmit} className="my-3 p-3 bg-slate-700/50 rounded-md space-y-3 relative">
                              {/* Search for Registered User */}
                              <div>
                                <label htmlFor="participantSearch" className="block text-xs font-medium text-slate-300 mb-1">Search Registered User <span className="text-red-400">*</span></label>
                                <div className="relative">
                                    <UserCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <input 
                                        id="participantSearch"
                                        type="text" 
                                        value={participantSearchText} 
                                        onChange={handleParticipantSearchChange} 
                                        onFocus={() => setShowSuggestions(true)} // Show suggestions on focus if search text is not empty
                                        // onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Hide on blur with delay
                                        placeholder="Type platform username..." 
                                        className="input input-sm input-bordered w-full pl-8 bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-500 placeholder-slate-500" 
                                        autoComplete="off"
                                    />
                                </div>
                                {isLoadingLinkableUsers && <p className="text-xs text-slate-400 mt-1 animate-pulse">Loading users...</p>}
                                {showSuggestions && suggestedUsers.length > 0 && (
                                    <ul className="absolute z-20 w-full bg-slate-800 border border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {suggestedUsers.map(user => (
                                            <li 
                                                key={user.id} 
                                                onClick={() => handleSelectSuggestedUser(user)}
                                                className="px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-500 hover:text-white cursor-pointer"
                                            >
                                                {user.username}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showSuggestions && debouncedSearchText.trim() !== '' && !isLoadingLinkableUsers && suggestedUsers.length === 0 && (
                                    <p className="text-xs text-amber-400 mt-1">No matching registered users found.</p>
                                )}
                              </div>
                              
                              {/* Display Name for this Tournament */}
                              <div>
                                <label htmlFor="participantDisplayName" className="block text-xs font-medium text-slate-300 mb-1">
                                  Display Name in Tournament <span className="text-red-400">*</span>
                                  {selectedUserForParticipant && <span className="text-slate-500 text-xxs"> (linked to: {selectedUserForParticipant.username})</span>}
                                </label>
                                <input 
                                  id="participantDisplayName"
                                  type="text"
                                  value={participantDisplayName}
                                  onChange={handleDisplayNameChange}
                                  placeholder="Name shown in bracket/standings"
                                  className="input input-sm input-bordered w-full bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-500 placeholder-slate-500"
                                  required
                                  disabled={!selectedUserForParticipant} // Only enable if a user is selected
                                />
                              </div>

                              <button 
                                type="submit" 
                                className="btn btn-sm btn-success text-white w-full disabled:opacity-50 disabled:saturate-50 disabled:cursor-not-allowed"
                                disabled={!selectedUserForParticipant || !participantDisplayName.trim()}
                              >
                                Add Selected User ({participantDisplayName.trim() || '...'})
                              </button>
                          </form>
                      )}

                       {participants.length > 0 ? ( 
                           <div className="max-h-32 overflow-y-auto text-xs pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50 mt-1">
                              <ul className="list-none space-y-1 text-slate-300">
                                  {participants.map((p, i) => <li key={p.id} className="py-1 px-1.5 bg-slate-700/60 rounded-md flex justify-between items-center">
                                    <span>{i + 1}. {p.participant_name}{p.user_id ? <UserCircleIcon title={`Linked to system user ID: ${p.user_id}`} className="h-3 w-3 inline-block ml-1 text-teal-400" /> : ''}{p.seed != null ? <span className="text-slate-500 text-xxs ml-1">(S:{p.seed})</span>: ''}</span>
                                    {/* Add remove button here if needed */}
                                    </li>)}
                              </ul>
                          </div>
                       ) : <p className="text-slate-500 italic text-xs py-2">{canAddParticipants ? "No participants yet. Click 'Add Participant' to start." : "No participants registered."}</p>}
                      
                      {!canAddParticipants && !isAddingParticipant && matches.length === 0 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && 
                        <p className="text-sky-400 text-xs mt-2 p-2 bg-sky-500/10 rounded-md">
                            {(participants.length < 2) ? "Needs at least 2 participants to generate." : "Ready to generate bracket."}
                        </p>
                      }
                      {matches.length > 0 && <p className="text-green-400 text-xs mt-2 p-2 bg-green-500/10 rounded-md">Bracket has been generated.</p>}
                   </div>
              </div>
          </div>

          {/* Bracket/Matches Rendering ... same ... */}
          {/* ... (rest of the component) ... */}
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
                  
                  {isLoading && matches.length === 0 && participants.length < 2 ? <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div></div> :
                  (matches.length > 0 || (tournament.format === 'ROUND_ROBIN' && participants.length >= 2 && tournament.status !== 'COMPLETED' && tournament.status !== 'CANCELLED')) ? ( 
                       <BracketRenderer
                          tournament={tournament}
                          matches={matches}
                          participants={participants}
                          onMatchClick={handleMatchClickForEdit}
                          inlineEditingMatchId={inlineEditingMatchId}
                          inlineScores={inlineScores}
                          onInlineScoreChange={setInlineScores}
                          onInlineScoreSubmit={handleInlineScoreSubmit}
                          onCancelInlineEdit={() => { setInlineEditingMatchId(null); setInlineScores({p1:'', p2:''}); setError(null); setSuccessMessage(null); }}
                      />
                  ) : (
                      <div className="text-center py-10 px-4 min-h-[200px] flex flex-col justify-center items-center">
                          <p className="text-slate-400 mb-4">
                              {participants.length < 2 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') ? "This tournament needs at least 2 participants to generate matches." : 
                               (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') ? `This tournament is ${tournament.status.toLowerCase()}.` :
                               "The matches for this tournament have not been generated yet."}
                          </p>
                           {!matches.length && canGenerateBracket &&
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