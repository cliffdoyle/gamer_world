// src/components/tournament/EliminationStatsTable.tsx
import React from 'react';
import { Match, Participant, TournamentResponse } from '@/types/tournament';

interface EliminationStatsTableProps {
  tournament: TournamentResponse;
  participants: Participant[];
  matches: Match[];
}

const EliminationStatsTable: React.FC<EliminationStatsTableProps> = ({
  tournament,
  participants,
  matches,
}) => {
  const stats = React.useMemo(() => {
    return participants
      .map(participant => {
        let wins = 0;
        let losses = 0;
        let matchesPlayed = 0;
        let goalsFor = 0;
        let goalsAgainst = 0;

        matches.forEach(match => {
          if (match.status === 'COMPLETED' &&
              (match.participant1_id === participant.id || match.participant2_id === participant.id)) {
            matchesPlayed++;
            
            // Calculate goals for and against
            if (match.participant1_id === participant.id) {
              goalsFor += match.score_participant1 || 0;
              goalsAgainst += match.score_participant2 || 0;
            } else if (match.participant2_id === participant.id) {
              goalsFor += match.score_participant2 || 0;
              goalsAgainst += match.score_participant1 || 0;
            }
            
            if (match.winner_id === participant.id) {
              wins++;
            } else if (match.winner_id !== null && match.winner_id !== participant.id) { 
              // Explicitly a loss if there was a winner and it wasn't this participant
              losses++;
            }
            // Ties are not expected in elimination formats, so no specific "draw" handling here for points.
          }
        });
        
        const points = wins * 3; // 3 points for a win, 0 for a loss (no draws)
        const goalDifference = goalsFor - goalsAgainst;

        // Basic status determination - can be greatly expanded for DE
        let currentStatus = "Active";
        if (losses > 0 && tournament.format === 'SINGLE_ELIMINATION') {
            currentStatus = "Eliminated";
        } else if (losses >= 2 && tournament.format === 'DOUBLE_ELIMINATION') { 
            // Simple DE elimination
            currentStatus = "Eliminated";
        }
        // TODO: More detailed status for DE: "In Losers Bracket", "Winner"
        // For Winner status, you'd check if this participant won the final match of the tournament.

        return {
          ...participant,
          matchesPlayed,
          wins,
          losses,
          points,
          goalsFor,
          goalsAgainst,
          goalDifference,
          currentStatus, // You can choose to display this or not
        };
      })
      .sort((a, b) => {
        // Sort by: Wins (desc), then Goal Difference (desc), then Goals For (desc), then Losses (asc)
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
        if (a.losses !== b.losses) return a.losses - b.losses;
        if (b.points !== a.points) return b.points - a.points;
        return a.participant_name.localeCompare(b.participant_name);
      });
  }, [participants, matches, tournament.format]);

  if (participants.length === 0) {
    return <div className="p-4 text-slate-400 italic text-center">No participants available to display statistics.</div>;
  }

  return (
    <div className="card bg-slate-800/80 shadow-xl compact backdrop-blur-sm border border-slate-700/50 text-slate-200">
      <div className="card-body p-3 sm:p-4">
        <h2 className="card-title text-base sm:text-lg !mb-3 text-slate-100">Participant Statistics</h2>
        <div className="overflow-x-auto rounded-md max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
          <table className="table table-sm w-full text-slate-300 table-pin-rows"> {/* `table-pin-rows` for sticky header via DaisyUI */}
            <thead className="bg-slate-700 text-slate-400 sticky top-0 z-10"> {/* Sticky header */}
              <tr className="text-xs">
                <th className="py-2 px-3">#</th>
                <th className="text-left py-2 px-3">Participant</th>
                <th className="text-center py-2 px-3">MP</th>
                <th className="text-center py-2 px-3">W</th>
                <th className="text-center py-2 px-3">L</th>
                <th className="text-center py-2 px-3">GF</th>
                <th className="text-center py-2 px-3">GA</th>
                <th className="text-center py-2 px-3">GD</th>
                <th className="text-center py-2 px-3">Pts</th>
                {/* <th className="text-left py-2 px-3">Status</th> */}
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700/50">
              {stats.map((s, index) => (
                <tr key={s.id} className="hover:bg-slate-700/50 text-xs">
                  <td className="py-2 px-3">{index + 1}</td>
                  <td className="py-2 px-3 font-medium text-slate-100">{s.participant_name}</td>
                  <td className="py-2 px-3 text-center">{s.matchesPlayed}</td>
                  <td className="py-2 px-3 text-center text-green-400 font-semibold">{s.wins}</td>
                  <td className="py-2 px-3 text-center text-red-400 font-semibold">{s.losses}</td>
                  <td className="py-2 px-3 text-center">{s.goalsFor}</td>
                  <td className="py-2 px-3 text-center">{s.goalsAgainst}</td>
                  <td className="py-2 px-3 text-center font-medium">
                    <span className={s.goalDifference > 0 ? 'text-green-400' : s.goalDifference < 0 ? 'text-red-400' : 'text-slate-300'}>
                      {s.goalDifference > 0 ? '+' : ''}{s.goalDifference}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center font-bold text-slate-100">{s.points}</td>
                  {/* <td className="py-2 px-3 text-slate-400">{s.currentStatus}</td> */}
                </tr>
              ))}
              {stats.length === 0 && (
                <tr><td colSpan={9} className="text-center italic py-4 text-slate-500">No completed matches to display statistics.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EliminationStatsTable;