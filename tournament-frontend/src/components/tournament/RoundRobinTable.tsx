// src/components/tournament/RoundRobinTable.tsx
import React from 'react';
import { Match as MatchType, Participant as ParticipantType, Tournament } from '@/types/tournament'; // Assuming Tournament type is needed/available

interface RoundRobinTableProps {
  tournament: Tournament; // Pass the whole tournament object for context
  matches: MatchType[];
  participants: ParticipantType[];
  onMatchClick?: (match: MatchType) => void; // Callback when a match is clicked for scoring
}

const RoundRobinTable: React.FC<RoundRobinTableProps> = ({
  tournament,
  matches,
  participants,
  onMatchClick
}) => {
  if (!participants || participants.length === 0) {
    return <div className="p-4 text-gray-500">No participants available for Round Robin table.</div>;
  }
  if (!matches) {
    return <div className="p-4 text-gray-500">No matches available for Round Robin table.</div>;
  }


  const participantsMap = React.useMemo(() =>
    new Map(participants.map(p => [p.id, p]))
  , [participants]);

  const getParticipantName = (id: string | null): string => {
    if (!id) return 'TBD';
    return participantsMap.get(id)?.participant_name || 'Unknown';
  };

  // Calculate Standings
  const standings = participants.map(participant => {
    let wins = 0;
    let losses = 0;
    let draws = 0;
    let gamesPlayed = 0;

    matches.forEach(match => {
      if (match.status === 'COMPLETED' && (match.participant1_id === participant.id || match.participant2_id === participant.id)) {
        gamesPlayed++;
        if (match.winner_id === participant.id) {
          wins++;
        } else if (match.winner_id === null) { // A draw
          draws++;
        } else { // Loss (winner_id is not null and not this participant)
          losses++;
        }
      }
    });
    const points = (wins * 3) + (draws * 1); // Standard points: 3 for win, 1 for draw
    return { ...participant, gamesPlayed, wins, losses, draws, points };
  }).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points; // Primary sort: points
    // Add tie-breaking rules here if needed (e.g., head-to-head, score difference)
    return 0;
  });

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    (acc[match.round] = acc[match.round] || []).push(match);
    return acc;
  }, {} as Record<number, MatchType[]>);

  const roundNumbers = Object.keys(matchesByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-6 p-1 sm:p-4">
      {/* Standings Table */}
      <div>
        <h2 className="text-xl font-semibold mb-3 text-gray-700">Standings</h2>
        <div className="overflow-x-auto shadow-md rounded-lg">
          <table className="table table-zebra table-sm w-full">
            <thead className="bg-gray-100">
              <tr>
                <th>Rank</th>
                <th>Participant</th>
                <th className="text-center">GP</th>
                <th className="text-center">W</th>
                <th className="text-center">L</th>
                <th className="text-center">D</th>
                <th className="text-center">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, index) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td>{index + 1}</td>
                  <td>{s.participant_name}</td>
                  <td className="text-center">{s.gamesPlayed}</td>
                  <td className="text-center">{s.wins}</td>
                  <td className="text-center">{s.losses}</td>
                  <td className="text-center">{s.draws}</td>
                  <td className="text-center font-semibold">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Matches by Round */}
      <div>
        <h2 className="text-xl font-semibold mb-3 text-gray-700">Matches</h2>
        <div className="space-y-4">
          {roundNumbers.length > 0 ? roundNumbers.map(roundNum => (
            <div key={roundNum} className="p-3 bg-gray-50 rounded-lg shadow">
              <h3 className="text-md font-medium text-gray-600 mb-2">Round {roundNum}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(matchesByRound[roundNum] || []).map(match => {
                  const p1Name = getParticipantName(match.participant1_id);
                  const p2Name = getParticipantName(match.participant2_id);
                  const canEdit = match.participant1_id && match.participant2_id && match.status !== 'COMPLETED';

                  return (
                    <div
                      key={match.id}
                      className={`flex items-center justify-between p-2 rounded border ${
                        match.status === 'COMPLETED' ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
                      } ${canEdit && onMatchClick ? 'cursor-pointer hover:bg-blue-50 hover:shadow-md transition-all' : ''}`}
                      onClick={() => canEdit && onMatchClick && onMatchClick(match)}
                      title={canEdit && onMatchClick ? "Click to update score" : (match.status === 'COMPLETED' ? "Match completed" : "Participants not set")}
                    >
                      <div className={`flex-1 text-sm ${match.winner_id === match.participant1_id ? 'font-bold text-green-700' : ''}`}>
                        {p1Name}
                      </div>
                      <div className="mx-2 text-center">
                        {match.status === 'COMPLETED' ? (
                          <span className="font-semibold text-gray-700">
                            {match.score_participant1 ?? 0} - {match.score_participant2 ?? 0}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">vs</span>
                        )}
                      </div>
                      <div className={`flex-1 text-sm text-right ${match.winner_id === match.participant2_id ? 'font-bold text-green-700' : ''}`}>
                        {p2Name}
                      </div>
                       {/* Optional: small status indicator */}
                        <span className={`ml-2 badge badge-xs ${match.status === 'COMPLETED' ? 'badge-success' : 'badge-ghost'}`}>{match.status}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )) : <p className="text-gray-500 italic">No matches scheduled yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default RoundRobinTable;