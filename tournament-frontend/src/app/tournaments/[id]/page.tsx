// src/app/tournaments/[id]/page.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { userApi, UserForLinkingResponse } from '@/lib/api/user';
//Add TournamentFormatType
import { TournamentFormat } from '@/types/tournament';
import { TournamentResponse, Participant, Match,TournamentStatus, MatchStatus } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import BracketRenderer from '@/components/tournament/BracketRenderer';
import EliminationStatsTable from '@/components/tournament/EliminationStatsTable';
import { ArrowLeftIcon, PlusIcon, BoltIcon, TableCellsIcon, ListBulletIcon, UserCircleIcon,Squares2X2Icon } from '@heroicons/react/24/outline';
import useDebounce from '@/hooks/useDebounce';

// --- Import WebSocket related types ---
import { useWebSocket } from '@/contexts/WebSocketContext';
import {
  WS_EVENT_TYPES,
  WSParticipantJoinedPayload,
  WSMatchScoreUpdatedPayload,
  WSBracketGeneratedPayload,
  WSTournamentStatusChangedPayload,
} from '@/types/websocket';



// --- START OF NEW CODE TO ADD ---
// Helper function to get a display-friendly format name
const getBracketTitle = (format: TournamentFormat | undefined): string => {
  if (!format) return "Tournament Details"; // Fallback if format is not yet loaded
  switch (format) {
    case 'SINGLE_ELIMINATION':
      return "Single Elimination Bracket";
    case 'DOUBLE_ELIMINATION':
      return "Double Elimination Bracket";
    case 'ROUND_ROBIN':
      return "Round Robin Group Stage";
    case 'SWISS':
      return "Swiss Rounds";
    default:
      // For any new or unhandled formats, create a title from the format enum value
      const formattedName = format.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      return formattedName;
  }
};
// --- END OF NEW CODE TO ADD ---



export default function TournamentDetailPage({ params }: { params: { id: string } }) {
  const { id: tournamentId } = params;
  const router = useRouter();
  const { token } = useAuth();
   const { lastJsonMessage } = useWebSocket();

  const [tournament, setTournament] = useState<TournamentResponse | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isAddingParticipant, setIsAddingParticipant] = useState(false);
  const [participantSearchText, setParticipantSearchText] = useState('');
  const debouncedSearchText = useDebounce(participantSearchText, 300);
  const [participantDisplayName, setParticipantDisplayName] = useState('');
  const [selectedUserForParticipant, setSelectedUserForParticipant] = useState<UserForLinkingResponse | null>(null);
  const [allLinkableUsers, setAllLinkableUsers] = useState<UserForLinkingResponse[]>([]);
  const [suggestedUsers, setSuggestedUsers] = useState<UserForLinkingResponse[]>([]);
  const [isLoadingLinkableUsers, setIsLoadingLinkableUsers] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [inlineEditingMatchId, setInlineEditingMatchId] = useState<string | null>(null);
  const [inlineScores, setInlineScores] = useState<{ p1: string, p2: string }>({ p1: '', p2: '' });
  const [viewMode, setViewMode] = useState<'bracket' | 'list'>('bracket');
  // Fetch ALL tournament data (tournament details, participants, matches)
  const fetchFullTournamentData = useCallback(async (showLoadingSpinner = true) => {
    if (!token || !tournamentId) return;
    if (showLoadingSpinner) setIsLoading(true);
    // setError(null); // Clear error before fetching
    try {
      console.log(`TD_PAGE (${tournamentId}): Fetching ALL tournament data.`);
      const [tournamentData, participantsData, matchesData] = await Promise.all([
        tournamentApi.getTournament(token, tournamentId),
        tournamentApi.getParticipants(token, tournamentId),
        tournamentApi.getMatches(token, tournamentId),
      ]);
      setTournament(tournamentData);
      setParticipants(participantsData || []);
      setMatches(matchesData || []);
      console.log(`TD_PAGE (${tournamentId}): Fetched Data:`, { tournamentData, participantsData, matchesData });
    } catch (err: any) {
      console.error(`TD_PAGE (${tournamentId}): Error fetching full tournament data:`, err);
      setError(err.message || 'Failed to fetch tournament data');
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  }, [token, tournamentId]);

  // Initial data fetch
  useEffect(() => {
    if (token && tournamentId) {
      fetchFullTournamentData(true);
    }
  }, [token, tournamentId, fetchFullTournamentData]); // fetchFullTournamentData is stable

  // Effects for participant adding UI logic (keep your existing ones)
    useEffect(() => {
      if (isAddingParticipant && token && allLinkableUsers.length === 0) {
        //Ensure tournament context is relevant
        console.log(`TD_PAGE (${tournamentId}): Reacting to WebSocket message: Type=${lastJsonMessage.type}, Payload=${JSON.stringify(lastJsonMessage.payload)}`);
      setIsLoadingLinkableUsers(true);
      userApi.listUsersForLinking(token)
        .then(response => setAllLinkableUsers(response.users || []))
        .catch(err => { console.error("Failed to fetch linkable users:", err); setError("Could not load registered users list."); })
        .finally(() => setIsLoadingLinkableUsers(false));
    }
  }, [isAddingParticipant, token, allLinkableUsers.length]);

  useEffect(() => {
    if (debouncedSearchText.trim() === '') {
      setSuggestedUsers([]); setShowSuggestions(false); return;
    }
    if (selectedUserForParticipant && selectedUserForParticipant.username === debouncedSearchText) {
      setSuggestedUsers([]); setShowSuggestions(false); return;
    }
    const filtered = allLinkableUsers.filter(user =>
      user.username.toLowerCase().includes(debouncedSearchText.toLowerCase()) &&
      !participants.some(p => p.user_id === user.id) // Ensure p.user_id exists and is string for comparison
    ).slice(0, 5);
    setSuggestedUsers(filtered);
    setShowSuggestions(filtered.length > 0);
  }, [debouncedSearchText, allLinkableUsers, participants, selectedUserForParticipant]);


  // --- WebSocket Message Handler for Tournament Detail Page ---
  useEffect(() => {
    // Ensure tournament data is loaded before processing WS messages for it
    if (lastJsonMessage && tournament && tournament.id === tournamentId) {
      console.log(`TD_PAGE (${tournamentId}): Reacting to WebSocket message:`, lastJsonMessage);
      // Ensure your WebSocketMessage in types/websocket.ts uses lowercase 'type' and 'payload'
      const { type, payload } = lastJsonMessage;

      switch (type) {
        case WS_EVENT_TYPES.PARTICIPANT_JOINED: {
          const wsPayload = payload as WSParticipantJoinedPayload;
          if (wsPayload.tournament_id === tournamentId) {
            console.log(`TD_PAGE (${tournamentId}): PARTICIPANT_JOINED`, wsPayload.participant.participant_name);
            setParticipants(prev => {
              if (prev.find(p => p.id === wsPayload.participant.id)) return prev;
              return [...prev, wsPayload.participant];
            });
            setTournament(prevT => (prevT ? { ...prevT, currentParticipants: wsPayload.participant_count } : null));
            setSuccessMessage(`Participant '${wsPayload.participant.participant_name}' added!`);
            setIsAddingParticipant(false); // Close add form
            setParticipantSearchText(''); setParticipantDisplayName(''); setSelectedUserForParticipant(null);
          }
          break;
        }
       // In src/app/tournaments/[id]/page.tsx
// (inside the useEffect that handles lastJsonMessage)

case WS_EVENT_TYPES.MATCH_SCORE_UPDATED: {
  const wsPayload = payload as WSMatchScoreUpdatedPayload; // from types/websocket.ts

  // Ensure this WS message is for the current tournament page
  if (wsPayload.tournament_id === tournamentId) {
    console.log(`TD_PAGE (${tournamentId}): WS - MATCH_SCORE_UPDATED received for Match ${wsPayload.match_id}. Payload:`, JSON.stringify(wsPayload));

    // This functional update ensures we're always working with the freshest previous state for `matches`
    setMatches(prevMatches => {
      let matchFoundAndUpdated = false;
      const updatedMatches = prevMatches.map(currentMatchInState => {
        if (currentMatchInState.id === wsPayload.match_id) {
          matchFoundAndUpdated = true;
          console.log(`TD_PAGE (${tournamentId}): Updating match ${wsPayload.match_id} in local state from WS. New status: ${wsPayload.status}, P1_ID: ${wsPayload.participant1_id}, P2_ID: ${wsPayload.participant2_id}`);
          // Construct the fully updated match.
          // This will apply updates from M1's payload to M1, and M2's payload to M2.
          const newMatchData: Match = { // Ensure all fields of Match are considered
            ...currentMatchInState, // Spread to keep existing properties
            participant1_id: wsPayload.participant1_id !== undefined ? wsPayload.participant1_id : currentMatchInState.participant1_id,
            participant2_id: wsPayload.participant2_id !== undefined ? wsPayload.participant2_id : currentMatchInState.participant2_id,
            score_participant1: wsPayload.score_participant1,
            score_participant2: wsPayload.score_participant2,
            winner_id: wsPayload.winner_id, // This is UUIDString | null
            status: wsPayload.status as MatchStatus, // wsPayload.status is already MatchStatus
            // If your wsPayload included an 'updated_at' from the server, assign it here:
            // updated_at: wsPayload.server_updated_at_timestamp || currentMatchInState.updated_at,
          };
          return newMatchData;
        }
        return currentMatchInState;
      });

      // If a match was updated, check for tournament completion on this new 'updatedMatches' array
      if (matchFoundAndUpdated) {
        // If the specific match being inline-edited was the one completed by this WS message:
        if (inlineEditingMatchId === wsPayload.match_id && wsPayload.status === 'COMPLETED') {
          console.log(`TD_PAGE (${tournamentId}): Inline-edited match ${wsPayload.match_id} completed via WS, closing editor.`);
          setInlineEditingMatchId(null); // Close editor immediately
          setInlineScores({ p1: '', p2: '' });
        }
        setSuccessMessage(`Match ${wsPayload.match_id.substring(0,6)}... live update!`);


        // Check if ALL matches are now 'COMPLETED' using the just-updated 'updatedMatches' array
        const allNowCompleted = updatedMatches.length > 0 && updatedMatches.every(m => m.status === 'COMPLETED');

        if (allNowCompleted && tournament && tournament.status === 'IN_PROGRESS') {
          console.log(`TD_PAGE (${tournamentId}): All matches appear COMPLETED based on local state after WS. Fetching full tournament data to confirm & update status.`);
          // The backend should ideally send a TOURNAMENT_STATUS_CHANGED to 'COMPLETED'.
          // If it does, this fetchFullTournamentData might become redundant for status change,
          // but it's a good way to ensure data consistency.
          fetchFullTournamentData(false); // false for no global spinner
        }
      }
      return updatedMatches; // Return the new array for setMatches
    });
  }
  break;
}
        case WS_EVENT_TYPES.TOURNAMENT_STATUS_CHANGED: {
            const wsPayload = payload as WSTournamentStatusChangedPayload;
            if (wsPayload.tournament_id === tournamentId) {
                console.log(`TD_PAGE (${tournamentId}): TOURNAMENT_STATUS_CHANGED to ${wsPayload.new_status}`);
                setTournament(prevT => (prevT ? { ...prevT, status: wsPayload.new_status as TournamentStatus } : null));
                setSuccessMessage(`Tournament status is now: ${wsPayload.new_status.replace(/_/g, ' ')}.`);
                // If bracket was being generated and status changed due to it
                if (isGenerating && (wsPayload.new_status === 'IN_PROGRESS' || wsPayload.new_status === 'REGISTRATION')) {
                     setIsGenerating(false);
                }
            }
            break;
        }
        default:
          break;
      }
    }
  }, [lastJsonMessage, tournamentId, token, tournament, fetchFullTournamentData, isGenerating, inlineEditingMatchId]); // Added isGenerating & inlineEditingMatchId

  const handleParticipantSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantSearchText(e.target.value);
    setSelectedUserForParticipant(null);
    setParticipantDisplayName('');
    setShowSuggestions(true);
    setError(null); setSuccessMessage(null);
  };

  const handleDisplayNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setParticipantDisplayName(e.target.value);
  };

  const handleSelectSuggestedUser = (user: UserForLinkingResponse) => {
    setParticipantSearchText(user.username);
    setParticipantDisplayName(user.username);
    setSelectedUserForParticipant(user);
    setSuggestedUsers([]);
    setShowSuggestions(false);
  };

  const handleAddParticipantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null); setError(null);
    if (!token || !tournament) { setError("Authentication or tournament data missing."); return; }
    if (!selectedUserForParticipant) { setError("Please search and select a registered platform user."); return; }
    if (!participantDisplayName.trim()) { setError("Participant display name for this tournament is required."); return; }
    if (!isEffectivelyRegistrationPhase(tournament)) { setError("Registration is closed or tournament has already started/finished."); return; }
    if (matches.length > 0) { setError("Cannot add participants after the bracket has been generated."); return; }
    if (tournament.maxParticipants > 0 && participants.length >= tournament.maxParticipants) { setError(`Maximum participant limit (${tournament.maxParticipants}) reached.`); return; }
    if (participants.some(p => p.user_id === selectedUserForParticipant.id)) { setError(`User '${selectedUserForParticipant.username}' is already a participant in this tournament.`); return; }

    try {
      await tournamentApi.addParticipant(token, tournament.id, {
        name: participantDisplayName.trim(),
        userIdToLink: selectedUserForParticipant.id,
      });
      setSuccessMessage(`Participant '${participantDisplayName.trim()}' (linked to ${selectedUserForParticipant.username}) added!`);
      setParticipantSearchText(''); setParticipantDisplayName(''); setSelectedUserForParticipant(null); setShowSuggestions(false);
      await fetchFullTournamentData();
    } catch (err: any) { setError(err.message || 'Failed to add participant'); }
  };

  // --- RESTORED/COMPLETED FUNCTIONS ---
  const handleGenerateBracket = async () => {
    setError(null); setSuccessMessage(null);
    if (!token || !tournament) { 
        setError("Authentication or tournament data missing."); 
        console.error("Generate Bracket Check: No token or tournament object");
        return; 
    }
    if (participants.length < 2) { 
        setError("At least 2 participants are needed to generate a bracket."); 
        console.error("Generate Bracket Check: Not enough participants - ", participants.length);
        return; 
    }
    if (matches.length > 0) { 
        setError("Bracket has already been generated."); 
        console.error("Generate Bracket Check: Matches already exist - ", matches.length);
        return; 
    }
    if (tournament.status !== 'DRAFT' && tournament.status !== 'REGISTRATION') {
        setError(`Tournament status (${tournament.status.toLowerCase()}) does not allow bracket generation.`); 
        console.error("Generate Bracket Check: Invalid tournament status - ", tournament.status);
        return;
    }

    console.log("Attempting to generate bracket for tournament:", tournament.id, "with status:", tournament.status, "and", participants.length, "participants");
    setIsGenerating(true);
    try {
      const generatedMatches = await tournamentApi.generateBracket(token, tournament.id);
      console.log("Bracket generation API response:", generatedMatches);
      setSuccessMessage("Bracket generated successfully! Tournament may have started.");
      await fetchFullTournamentData(); // Crucial to refresh all data, including tournament status and matches
    } catch (err: any) {
      console.error("Generate bracket error in API call:", err);
      setError(err.message || 'Failed to generate bracket');
    } finally {
      setIsGenerating(false);
    }
  };

  const submitScoreUpdate = async (matchToUpdate: Match, score1Str: string, score2Str: string): Promise<Match | null> => {
    setError(null); setSuccessMessage(null);
    if (!token || !tournament) {
        console.error("submitScoreUpdate: No token or tournament");
        return null;
    }
    
    const score1 = parseInt(score1Str);
    const score2 = parseInt(score2Str);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) { 
      setError("Scores must be non-negative numbers."); 
      return null; 
    }
    if (tournament.format !== 'ROUND_ROBIN' && score1 === score2) { 
      setError("Ties are not allowed in this format for this tournament."); 
      return null; 
    }

    console.log(`Submitting score for match ${matchToUpdate.id}: ${score1} - ${score2}`);
    try {
      const updatedMatchData = await tournamentApi.updateMatch(token, tournament.id, matchToUpdate.id, {
        participant1Score: score1, 
        participant2Score: score2,
      });
      console.log("Score update API response:", updatedMatchData);

      // Update local matches state
      const newMatches = prevMatches => prevMatches.map(m => (m.id === updatedMatchData.id ? { ...m, ...updatedMatchData } : m));
      setMatches(newMatches);
      
      setSuccessMessage("Match score updated!");

      // Check if all matches are completed to update tournament status
      const allPlayerMatches = newMatches(matches); // Get the most up-to-date matches array
      const allMatchesCompleted = allPlayerMatches.length > 0 && allPlayerMatches.every(m => m.status === 'COMPLETED');
      
      console.log("All matches completed status:", allMatchesCompleted, "Current tournament status:", tournament.status);

      if (allMatchesCompleted && tournament.status === 'IN_PROGRESS') {
        console.log("All matches complete, attempting to set tournament to COMPLETED.");
        try {
            await tournamentApi.updateTournamentStatus(token, tournament.id, 'COMPLETED');
            setSuccessMessage("Match score updated! All matches complete, tournament status updated to COMPLETED.");
            await fetchTournamentData(); // Refresh all data
        } catch (statusErr: any) {
            console.error("Failed to update tournament status to COMPLETED:", statusErr);
            setError("Failed to mark tournament as completed: " + statusErr.message);
        }
      }
      return updatedMatchData;
    } catch (err: any) { 
        console.error("Submit Score Update Error:", err);
        setError(err.message || 'Failed to update score'); 
        return null; 
    }
  };
  
  const handleInlineScoreSubmit = async () => { // This function should now be defined
    if(!inlineEditingMatchId) return;
    const match = matches.find(m => m.id === inlineEditingMatchId);
    if(match) { 
      const updatedMatch = await submitScoreUpdate(match, inlineScores.p1, inlineScores.p2);
      if(updatedMatch) {
        setInlineEditingMatchId(null); 
        setInlineScores({p1:'', p2:''});
        // Optionally re-fetch data if submitScoreUpdate doesn't handle all state updates adequately
        // await fetchTournamentData(); 
      }
    } else { setError("Error: Could not find match to update inline.");}
  };
  
  const handleMatchClickForEdit = (match: Match) => {
    setError(null); setSuccessMessage(null);
    if (!tournament) return;
    // Allow editing if both participants are present and match is not completed
    if (match.participant1_id && match.participant2_id && match.status !== 'COMPLETED') {
        setInlineEditingMatchId(match.id);
        setInlineScores({ 
          p1: match.score_participant1?.toString() || '', // Default to empty string for fresh input
          p2: match.score_participant2?.toString() || ''  // Default to empty string
        });
    } else {
        console.log("Match not editable:", match);
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
        if (isNaN(date.getTime())) throw new Error("Invalid date value from string: " + dateString); 
        return date.toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }); 
    } catch (e) { console.error("Date Parse Error in formatDateTime:", dateString, e); return 'Invalid Date Format'; } 
  };

  const isEffectivelyRegistrationPhase = (currentTournament: TournamentResponse | null): boolean => { 
    if (!currentTournament) return false; 
    const now = new Date(); 
    const deadline = currentTournament.registrationDeadline ? new Date(currentTournament.registrationDeadline) : null; 
    if (currentTournament.status !== 'DRAFT' && currentTournament.status !== 'REGISTRATION') return false; 
    if (deadline && now > deadline) return false; 
    return true; 
  };

  const canAddParticipants = isEffectivelyRegistrationPhase(tournament) && matches.length === 0;
  
  const canGenerateBracket = 
    tournament !== null &&
    participants.length >= 2 &&
    matches.length === 0 && // No matches should exist yet
    (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && // Status must be appropriate
    !isGenerating; // Not already in the process of generating

  // --- END OF RESTORED/COMPLETED FUNCTIONS ---


  if (isLoading && !tournament) return <ProtectedRoute><div className="min-h-screen flex justify-center items-center bg-slate-900"><div className="animate-spin rounded-full h-16 w-16 border-t-4 border-blue-500"></div></div></ProtectedRoute>;
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
             {/* // REPLACE WITH FIFA-STYLED BUTTON: (from fifa-generate-button artifact) */}
<button
  onClick={handleGenerateBracket}
  disabled={!canGenerateBracket}
  className={`
    relative flex items-center justify-center
    px-5 py-2.5 w-full sm:w-auto
    rounded-md overflow-hidden
    font-bold text-sm tracking-wider
    transition-all duration-300 transform hover:scale-105
    ${isGenerating 
      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' 
      : matches.length > 0 
        ? 'bg-gradient-to-r from-green-600 to-emerald-500 text-white' 
        : 'bg-gradient-to-r from-indigo-600 to-purple-500 text-white'}
    disabled:opacity-60 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:scale-100
    shadow-lg hover:shadow-xl
  `}
>
  {/* Animated background effect */}
  <div className={`absolute inset-0 w-full h-full bg-black opacity-10 
    ${isGenerating ? 'animate-pulse' : ''}`}></div>
  
  {/* Icon */}
  <div className="relative z-10 mr-2">
    <BoltIcon className={`h-4 w-4 ${isGenerating ? 'animate-bounce' : ''}`} />
  </div>
  
  {/* Text */}
  <span className="relative z-10">
    {isGenerating ? "GENERATING..." : (matches.length > 0 ? "BRACKET GENERATED" : "GENERATE BRACKET")}
  </span>
  
  {/* FIFA-like animated accents */}
  <div className={`
    absolute bottom-0 left-0 h-1.5 
    ${isGenerating 
      ? 'bg-yellow-300 w-full animate-pulse' 
      : matches.length > 0 
        ? 'bg-green-300 w-full' 
        : 'bg-violet-300 w-full animate-pulse'}
    transition-all duration-500 ease-out
  `}></div>
  
  {/* Side accent */}
  <div className={`
    absolute top-0 right-0 h-full w-1.5
    ${isGenerating 
      ? 'bg-yellow-300/50' 
      : matches.length > 0 
        ? 'bg-green-300/50' 
        : 'bg-violet-300/50'}
    transition-all duration-500 ease-out
  `}></div>
  
  {/* Diagonal pattern for FIFA-like aesthetic */}
  <div className="absolute inset-0 opacity-10">
    <div className="absolute inset-0 bg-black/20 rotate-45 transform-gpu scale-150"></div>
  </div>
</button>
            </div>
          </div>
          
          {/* Error and Success Messages */}
          {error && <div role="alert" className="alert bg-red-500/20 border border-red-500/50 text-red-300 text-sm mb-4"><UserCircleIcon className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" /><span>ERROR: {error}</span></div>} {/* Used UserCircleIcon as placeholder for error icon, replace if needed */}
          {successMessage && <div role="alert" className="alert bg-green-500/20 border border-green-500/50 text-green-300 text-sm mb-4"><UserCircleIcon className="stroke-current shrink-0 h-5 w-5 mr-2 mt-0.5" /><span>{successMessage}</span></div>} {/* Used UserCircleIcon as placeholder for success icon */}
          
          {/* Info Cards */}
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
                          
{/* // Replace it with this enhanced FIFA-styled button: */}
<button
  onClick={() => { 
    setIsAddingParticipant(!isAddingParticipant); 
    setError(null); 
    setSuccessMessage(null); 
    setParticipantSearchText(''); 
    setParticipantDisplayName(''); 
    setSelectedUserForParticipant(null); 
    setShowSuggestions(false); 
  }}
  disabled={!canAddParticipants}
  className={`
    relative flex items-center justify-center
    px-4 py-1.5 
    rounded-md overflow-hidden
    font-bold text-xs tracking-wider
    transition-all duration-300 transform hover:scale-105
    ${isAddingParticipant 
      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white' 
      : 'bg-gradient-to-r from-blue-600 to-teal-500 text-white'}
    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
    shadow-lg hover:shadow-xl
  `}
>
  {/* Animated background effect */}
  <div className={`absolute inset-0 w-full h-full bg-black opacity-10 
    ${isAddingParticipant ? 'animate-pulse' : ''}`}></div>
  
  {/* Icon - using your existing PlusIcon */}
  <div className="mr-1.5">
    {isAddingParticipant 
      ? <span className="w-3.5 h-3.5">✕</span> 
      : <PlusIcon className="w-3.5 h-3.5" />
    }
  </div>
  
  {/* Text */}
  <span className="relative z-10">
    {isAddingParticipant ? 'CANCEL ADDING' : 'ADD PARTICIPANT'}
  </span>
  
  {/* FIFA-like animated accent */}
  <div className={`
    absolute bottom-0 left-0 h-1 
    bg-yellow-400
    transition-all duration-500 ease-out
    ${isAddingParticipant ? 'w-1/3' : 'w-full animate-pulse'}
  `}></div>
</button>
                      </div>
                      
                      {isAddingParticipant && canAddParticipants && (
                          <form onSubmit={handleAddParticipantSubmit} className="my-3 p-3 bg-slate-700/50 rounded-md space-y-3 relative">
                              <div>
                                <label htmlFor="participantSearch" className="block text-xs font-medium text-slate-300 mb-1">Search Registered User <span className="text-red-400">*</span></label>
                                <div className="relative">
                                    <UserCircleIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                                    <input 
                                        id="participantSearch" type="text" value={participantSearchText} 
                                        onChange={handleParticipantSearchChange} 
                                        onFocus={() => participantSearchText && setShowSuggestions(true)}
                                        placeholder="Type platform username..." 
                                        className="input input-sm input-bordered w-full pl-8 bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-500 placeholder-slate-500" 
                                        autoComplete="off" />
                                </div>
                                {isLoadingLinkableUsers && <p className="text-xs text-slate-400 mt-1 animate-pulse">Loading users...</p>}
                                {showSuggestions && suggestedUsers.length > 0 && (
                                    <ul className="absolute z-20 w-full bg-slate-800 border border-slate-600 rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
                                        {suggestedUsers.map(user => (
                                            <li key={user.id} onClick={() => handleSelectSuggestedUser(user)}
                                                className="px-3 py-1.5 text-xs text-slate-200 hover:bg-blue-500 hover:text-white cursor-pointer">
                                                {user.username}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {showSuggestions && debouncedSearchText.trim() !== '' && !isLoadingLinkableUsers && suggestedUsers.length === 0 && (
                                    <p className="text-xs text-amber-400 mt-1">No matching registered users found.</p>
                                )}
                              </div>
                              <div>
                                <label htmlFor="participantDisplayName" className="block text-xs font-medium text-slate-300 mb-1">
                                  Display Name in Tournament <span className="text-red-400">*</span>
                                  {selectedUserForParticipant && <span className="text-slate-500 text-xxs"> (linked to: {selectedUserForParticipant.username})</span>}
                                </label>
                                <input id="participantDisplayName" type="text" value={participantDisplayName}
                                  onChange={handleDisplayNameChange}
                                  placeholder="Name shown in bracket/standings"
                                  className="input input-sm input-bordered w-full bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-500 placeholder-slate-500"
                                  required disabled={!selectedUserForParticipant} />
                              </div>
                              <button type="submit" 
                                className="btn btn-sm btn-success text-white w-full disabled:opacity-50 disabled:saturate-50 disabled:cursor-not-allowed"
                                disabled={!selectedUserForParticipant || !participantDisplayName.trim()}>
                                Add Selected User ({participantDisplayName.trim() || '...'})
                              </button>
                          </form>
                      )}
                       {participants.length > 0 ? ( 
                           <div className="max-h-32 overflow-y-auto text-xs pr-2 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50 mt-1">
                              <ul className="list-none space-y-1 text-slate-300">
                                  {participants.map((p, i) => <li key={p.id} className="py-1 px-1.5 bg-slate-700/60 rounded-md flex justify-between items-center">
                                    <span>{i + 1}. {p.participant_name}{p.user_id ? <UserCircleIcon title={`Linked to system user ID: ${p.user_id}`} className="h-3 w-3 inline-block ml-1 text-teal-400" /> : ''}{p.seed != null ? <span className="text-slate-500 text-xxs ml-1">(S:{p.seed})</span>: ''}</span>
                                    </li>)}
                              </ul>
                          </div>
                       ) : <p className="text-slate-500 italic text-xs py-2">{canAddParticipants ? "No participants yet. Click 'Add Participant' to start." : "No participants registered."}</p>}
                      {!canAddParticipants && !isAddingParticipant && matches.length === 0 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') && 
                        <p className="text-sky-400 text-xs mt-2 p-2 bg-sky-500/10 rounded-md">
                            {(participants.length < 2) ? "Needs at least 2 participants to generate." : "Ready to generate bracket."}
                        </p> }
                      {matches.length > 0 && <p className="text-green-400 text-xs mt-2 p-2 bg-green-500/10 rounded-md">Bracket has been generated.</p>}
                   </div>
              </div>
          </div>

          {/* Stats Table for Elimination */}
          {matches.length > 0 && tournament && (tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && (
             <div className="my-6 md:my-8">
                <EliminationStatsTable tournament={tournament} participants={participants} matches={matches} />
             </div>
          )}
          {/* Bracket/Matches Rendering Section */}
          <div className="card bg-slate-800 shadow-2xl backdrop-blur-sm border border-slate-700/50">
            <div className="card-body p-1 py-3 sm:p-2 md:p-4">
                            {/* --- START OF MODIFIED SECTION FOR BRACKET TITLE --- */}
               <div className="flex flex-col sm:flex-row justify-between items-center mb-4 px-1 sm:px-2 gap-2">
                    <h2 className="text-lg sm:text-xl font-semibold text-slate-100 inline-flex items-center whitespace-nowrap">
                        <Squares2X2Icon className="h-5 w-5 mr-2 text-sky-400 flex-shrink-0"/>
                        {getBracketTitle(tournament?.format)} {/* Using the helper function */}
                    </h2>
                    {/* View mode tabs moved here, original responsive classes kept */}
                    {(tournament.format === 'SINGLE_ELIMINATION' || tournament.format === 'DOUBLE_ELIMINATION') && matches.length > 0 && (
                        <div className="tabs tabs-boxed tabs-xs sm:tabs-sm bg-slate-700/50 p-0.5">
                        </div>
                    )}
                  </div>
                  {/* --- END OF MODIFIED SECTION FOR BRACKET TITLE --- */}

                  {/* The rest of this section (isLoading, BracketRenderer, placeholders) remains UNCHANGED from your original code */}
                  
                  {isLoading && matches.length === 0 && participants.length < 2 && !error ? 
                    <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-400"></div></div> :
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
                              { error ? `Error loading match data: ${error}` :
                                participants.length < 2 && (tournament.status === 'DRAFT' || tournament.status === 'REGISTRATION') ? "This tournament needs at least 2 participants to generate matches." : 
                               (tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED') ? `This tournament is ${tournament.status.toLowerCase()}.` :
                               "The matches for this tournament have not been generated yet."}
                          </p>
                           {!matches.length && canGenerateBracket && !error &&
                         
// REPLACE WITH LARGER FIFA-STYLED BUTTON: (from fifa-generate-button-large artifact)
<button 
  onClick={handleGenerateBracket} 
  disabled={!canGenerateBracket || isGenerating}
  className={`
    relative flex items-center justify-center
    px-6 py-3
    rounded-md overflow-hidden
    font-bold text-base tracking-wider
    transition-all duration-300 transform hover:scale-105
    ${isGenerating 
      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white' 
      : 'bg-gradient-to-r from-indigo-600 to-purple-500 text-white'}
    disabled:opacity-60 disabled:saturate-50 disabled:cursor-not-allowed disabled:hover:scale-100
    shadow-lg hover:shadow-xl
  `}
>
  {/* Animated background effect */}
  <div className={`absolute inset-0 w-full h-full bg-black opacity-10 
    ${isGenerating ? 'animate-pulse' : ''}`}></div>
  
  {/* Icon */}
  <div className="relative z-10 mr-2">
    <BoltIcon className={`h-5 w-5 ${isGenerating ? 'animate-bounce' : ''}`} />
  </div>
  
  {/* Text */}
  <span className="relative z-10">
    {isGenerating ? 'GENERATING...' : 'GENERATE BRACKET NOW'}
  </span>
  
  {/* FIFA-like animated accents */}
  <div className={`
    absolute bottom-0 left-0 h-1.5 
    bg-violet-300
    transition-all duration-500 ease-out
    w-full animate-pulse
  `}></div>
  
  {/* Side accent */}
  <div className="absolute top-0 right-0 h-full w-1.5 bg-violet-300/50"></div>
  
  {/* Diagonal pattern for FIFA-like aesthetic */}
  <div className="absolute inset-0 opacity-10">
    <div className="absolute inset-0 bg-black/20 rotate-45 transform-gpu scale-150"></div>
  </div>
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