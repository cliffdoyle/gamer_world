'use client';

import { useState } from 'react';
import { Button, TextField, Box, Card, Typography } from '@mui/material';

export default function TournamentTest() {
  const [tournamentData, setTournamentData] = useState({
    name: '8-Player Tournament',
    game: 'Test Game',
    format: 'SINGLE_ELIMINATION',
    maxParticipants: 8,
    registrationDeadline: '2024-12-31T23:59:59Z',
    startTime: '2025-01-01T00:00:00Z'
  });

  const [tournament, setTournament] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const createTournament = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8082/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData)
      });

      if (!response.ok) {
        throw new Error('Failed to create tournament');
      }

      const data = await response.json();
      setTournament(data);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const registerParticipant = async () => {
    if (!tournament) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8082/tournaments/${tournament.id}/participants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamName: `Team ${participants.length + 1}`
        })
      });

      if (!response.ok) {
        throw new Error('Failed to register participant');
      }

      const data = await response.json();
      setParticipants([...participants, data]);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateBracket = async () => {
    if (!tournament) return;

    try {
      setLoading(true);
      const response = await fetch(`http://localhost:8082/tournaments/${tournament.id}/bracket`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to generate bracket');
      }

      // Refresh tournament data to get updated status
      const tournamentResponse = await fetch(`http://localhost:8082/tournaments/${tournament.id}`);
      const updatedTournament = await tournamentResponse.json();
      setTournament(updatedTournament);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        Tournament Test Page
      </Typography>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {!tournament ? (
        <Button
          variant="contained"
          onClick={createTournament}
          disabled={loading}
        >
          Create 8-Player Tournament
        </Button>
      ) : (
        <Box>
          <Card sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6">Tournament Details</Typography>
            <Typography>ID: {tournament.id}</Typography>
            <Typography>Name: {tournament.name}</Typography>
            <Typography>Status: {tournament.status}</Typography>
            <Typography>Participants: {participants.length}/{tournament.maxParticipants}</Typography>
          </Card>

          <Box sx={{ mb: 2 }}>
            <Button
              variant="contained"
              onClick={registerParticipant}
              disabled={loading || participants.length >= tournament.maxParticipants}
              sx={{ mr: 2 }}
            >
              Add Participant
            </Button>

            <Button
              variant="contained"
              onClick={generateBracket}
              disabled={loading || participants.length < tournament.maxParticipants}
            >
              Generate Bracket
            </Button>
          </Box>

          {participants.length > 0 && (
            <Card sx={{ p: 2 }}>
              <Typography variant="h6">Registered Participants</Typography>
              {participants.map((p, index) => (
                <Typography key={index}>
                  {p.teamName}
                </Typography>
              ))}
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
} 