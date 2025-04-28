import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import BracketRenderer from '../../components/tournament/BracketRenderer';
import MatchModal from '../../components/tournament/MatchModal';
import Head from 'next/head';
import '../../styles/bracket.css';

export default function TournamentPage() {
  const router = useRouter();
  const { id } = router.query;
  
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [useAdvancedBracket, setUseAdvancedBracket] = useState(false);

  // Fetch tournament data
  useEffect(() => {
    if (!id) return;

    const fetchTournamentData = async () => {
      try {
        setLoading(true);
        
        // Fetch tournament details
        const tournamentResponse = await fetch(`/api/tournaments/${id}`);
        if (!tournamentResponse.ok) {
          throw new Error('Failed to fetch tournament');
        }
        const tournamentData = await tournamentResponse.json();
        setTournament(tournamentData);
        
        // Fetch matches
        const matchesResponse = await fetch(`/api/tournaments/${id}/matches`);
        if (!matchesResponse.ok) {
          throw new Error('Failed to fetch matches');
        }
        const matchesData = await matchesResponse.json();
        setMatches(matchesData);
        
        // Fetch participants
        const participantsResponse = await fetch(`/api/tournaments/${id}/participants`);
        if (!participantsResponse.ok) {
          throw new Error('Failed to fetch participants');
        }
        const participantsData = await participantsResponse.json();
        setParticipants(participantsData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching tournament data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchTournamentData();
  }, [id]);

  // Handle match click
  const handleMatchClick = (match) => {
    setSelectedMatch(match);
    setIsModalOpen(true);
  };

  // Handle match update
  const handleMatchUpdate = async (updatedMatch) => {
    try {
      const response = await fetch(`/api/matches/${updatedMatch.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedMatch),
      });

      if (!response.ok) {
        throw new Error('Failed to update match');
      }

      // Update matches in state
      setMatches(matches.map(m => 
        m.id === updatedMatch.id ? updatedMatch : m
      ));
      
      setIsModalOpen(false);
    } catch (err) {
      console.error('Error updating match:', err);
      alert('Failed to update match: ' + err.message);
    }
  };

  // Toggle advanced bracket visualization
  const toggleAdvancedBracket = () => {
    setUseAdvancedBracket(!useAdvancedBracket);
  };

  if (loading) {
    return <div className="loading">Loading tournament...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="tournament-page">
      <Head>
        <title>{tournament?.name || 'Tournament'}</title>
      </Head>
      
      <div className="tournament-header">
        <h1>{tournament?.name}</h1>
        <div className="tournament-info">
          <p>Format: {tournament?.format}</p>
          <p>Participants: {participants.length}</p>
          {tournament?.format === 'SINGLE_ELIMINATION' && (
            <button 
              onClick={toggleAdvancedBracket}
              className="toggle-bracket-button"
            >
              {useAdvancedBracket ? 'Use Simple Bracket' : 'Use Advanced Bracket'}
            </button>
          )}
        </div>
      </div>

      <BracketRenderer
        tournament={tournament}
        matches={matches}
        participants={participants}
        onMatchClick={handleMatchClick}
        useAdvanced={useAdvancedBracket}
      />

      {isModalOpen && selectedMatch && (
        <MatchModal
          match={selectedMatch}
          participants={participants}
          onClose={() => setIsModalOpen(false)}
          onUpdate={handleMatchUpdate}
        />
      )}
    </div>
  );
} 