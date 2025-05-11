// src/components/tournament/RoundRobinTable.tsx
import React from 'react';
import { Tournament, Match as MatchType, Participant as ParticipantType } from '@/types/tournament';
import { CheckCircleIcon, XCircleIcon, PencilSquareIcon } from '@heroicons/react/24/outline'; // Ensure this import path is correct for your project

interface RoundRobinTableProps {
  tournament: Tournament;
  matches: MatchType[];
  participants: ParticipantType[];
  onMatchClick?: (match: MatchType) => void;
  inlineEditingMatchId?: string | null;
  inlineScores?: { p1: string; p2: string };
  onInlineScoreChange?: (scores: { p1: string; p2: string }) => void;
  onInlineScoreSubmit?: () => void;
  onCancelInlineEdit?: () => void;
}

const RoundRobinTable: React.FC<RoundRobinTableProps> = ({
  tournament,
  matches,
  participants,
  onMatchClick,
  inlineEditingMatchId,
  inlineScores,
  onInlineScoreChange,
  onInlineScoreSubmit,
  onCancelInlineEdit,
}) => {
  const participantsMap = React.useMemo(() =>
    new Map(participants.map(p => [p.id, p]))
  , [participants]);

  const getParticipantName = (id: string | null): string => {
    if (!id) return 'TBD'; // Should ideally not happen in generated RR matches
    return participantsMap.get(id)?.participant_name || 'Unknown Participant';
  };

  // Calculate Standings
  const standings = React.useMemo(() => {
    // console.log("RRTable: Recalculating standings with matches:", matches); // For debugging
    return participants.map(participant => {
        let wins = 0;
        let losses = 0;
        let draws = 0;
        let gamesPlayed = 0;

        matches.forEach(match => {
            // Ensure the match involves the current participant
            if (match.participant1_id !== participant.id && match.participant2_id !== participant.id) {
                return; 
            }

            if (match.status === 'COMPLETED') {
                gamesPlayed++;
                if (match.winner_id === participant.id) {
                    wins++;
                } else if (match.winner_id === null) { // A draw is when winner_id is null for a completed match
                    draws++;
                } else if (match.winner_id !== null && match.winner_id !== participant.id) { // Winner is someone else
                    losses++;
                }
            }
        });
        const points = (wins * 3) + (draws * 1); // 3 for win, 1 for draw
        return { ...participant, gamesPlayed, wins, losses, draws, points };
    }).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points; // Primary: points
        if (b.wins !== a.wins) return b.wins - a.wins;         // Secondary: wins
        // Optional tie-breaker: Goal Difference
        const scoreDiff = (p: typeof a) => matches.reduce((diff, m) => {
            if(m.status === 'COMPLETED'){
                if (m.participant1_id === p.id) return diff + ((m.score_participant1 || 0) - (m.score_participant2 || 0));
                if (m.participant2_id === p.id) return diff + ((m.score_participant2 || 0) - (m.score_participant1 || 0));
            }
            return diff;
        }, 0);
        if (scoreDiff(b) !== scoreDiff(a)) return scoreDiff(b) - scoreDiff(a);
        return a.participant_name.localeCompare(b.participant_name); // Tertiary: alphabetical by name
    });
  }, [matches, participants, participantsMap]); // Dependencies for standings


  const matchesByRound = React.useMemo(() => {
    return matches.reduce((acc, match) => {
        (acc[match.round] = acc[match.round] || []).push(match);
        return acc;
    }, {} as Record<number, MatchType[]>);
  }, [matches]);

  const roundNumbers = React.useMemo(() => 
    Object.keys(matchesByRound).map(Number).sort((a, b) => a - b)
  , [matchesByRound]);

  // Condition before the main return
  if (participants.length < 2 && matches.length === 0 && tournament.status !== 'COMPLETED') {
      return <div className="p-6 text-center text-slate-400 italic">Add at least two participants and generate matches for Round Robin.</div>;
  }

  return (
    <div className="space-y-6 text-slate-200">
      {/* Standings Table */}
      <div className="card bg-slate-800 shadow-xl compact">
        <div className="card-body p-3 sm:p-4">
            <h2 className="card-title text-lg !mb-2 text-slate-100">Standings</h2>
            <div className="overflow-x-auto rounded-md max-h-72 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50">
            <table className="table table-sm w-full text-slate-300 table-pin-rows">
                <thead className="bg-slate-700 text-slate-400 sticky top-0 z-10">
                <tr className="text-xs">
                    <th>#</th>
                    <th className="text-left">Participant</th>
                    <th className="text-center">GP</th>
                    <th className="text-center">W</th>
                    <th className="text-center">L</th>
                    <th className="text-center">D</th>
                    <th className="text-center">Pts</th>
                </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                {standings.map((s, index) => (
                    <tr key={s.id} className="hover:bg-slate-700/50 text-xs">
                    <td className="py-2 px-3">{index + 1}</td>
                    <td className="py-2 px-3 font-medium text-slate-100">{s.participant_name}</td>
                    <td className="py-2 px-3 text-center">{s.gamesPlayed}</td>
                    <td className="py-2 px-3 text-center text-green-400">{s.wins}</td>
                    <td className="py-2 px-3 text-center text-red-400">{s.losses}</td>
                    <td className="py-2 px-3 text-center text-yellow-400">{s.draws}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-100">{s.points}</td>
                    </tr>
                ))}
                {standings.length === 0 && (
                    <tr><td colSpan={7} className="text-center italic py-4 text-slate-500">No completed matches yet to display standings.</td></tr>
                )}
                </tbody>
            </table>
            </div>
        </div>
      </div>

      {/* Matches by Round */}
      <div className="card bg-slate-800 shadow-xl compact">
        <div className="card-body p-3 sm:p-4">
            <h2 className="card-title text-lg !mb-2 text-slate-100">Matches</h2>
            <div className="max-h-[32rem] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-800/50 pr-2">
            {roundNumbers.length > 0 ? roundNumbers.map(roundNum => (
                <div key={roundNum} className="mb-4 last:mb-0">
                <h3 className="text-sm font-semibold text-slate-400 mb-2 ml-1">Round {roundNum}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {(matchesByRound[roundNum] || []).map(match => {
                    const p1Name = getParticipantName(match.participant1_id);
                    const p2Name = getParticipantName(match.participant2_id);
                    const isBeingEdited = inlineEditingMatchId === match.id;
                    const canEditMatch = match.participant1_id && match.participant2_id && match.status !== 'COMPLETED';

                    if (isBeingEdited && inlineScores && onInlineScoreChange && onInlineScoreSubmit && onCancelInlineEdit) {
                        // INLINE EDITING UI
                        return ( 
                            <div key={`${match.id}-edit`} className="p-3 rounded-md border-2 border-blue-500 bg-slate-700 shadow-xl space-y-2 text-sm transition-all duration-150 ease-in-out">
                                <div className="flex items-center justify-between text-slate-100">
                                    <span className="font-medium flex-1 truncate pr-2">{p1Name}</span>
                                    <input type="number" min="0" className="input input-xs input-bordered w-16 text-center bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-400 focus:ring-blue-400" value={inlineScores.p1} onChange={(e) => onInlineScoreChange({ ...inlineScores, p1: e.target.value })} autoFocus />
                                </div>
                                <div className="text-center text-xs text-slate-500 py-0.5">vs</div>
                                 <div className="flex items-center justify-between text-slate-100">
                                    <span className="font-medium flex-1 truncate pr-2">{p2Name}</span>
                                    <input type="number" min="0" className="input input-xs input-bordered w-16 text-center bg-slate-800 text-slate-100 border-slate-600 focus:border-blue-400 focus:ring-blue-400" value={inlineScores.p2} onChange={(e) => onInlineScoreChange({ ...inlineScores, p2: e.target.value })}/>
                                </div>
                                <div className="flex justify-end items-center gap-2 pt-2">
                                    <button onClick={onCancelInlineEdit} className="btn btn-xs btn-ghost text-slate-400 hover:bg-slate-600 hover:text-slate-200"> <XCircleIcon className="h-4 w-4"/> Cancel </button>
                                    <button onClick={onInlineScoreSubmit} className="btn btn-xs btn-success text-white hover:bg-green-500"> <CheckCircleIcon className="h-4 w-4"/> Save </button>
                                </div>
                            </div>
                        );
                    }

                    // DISPLAY UI
                    return ( 
                        <div key={match.id} className={`flex items-center justify-between p-2.5 rounded-md border text-slate-300 
                                    ${match.status === 'COMPLETED' ? 'bg-green-900/30 border-green-500/40' : 'bg-slate-700/80 border-slate-600'} 
                                    ${canEditMatch && onMatchClick ? 'cursor-pointer hover:bg-blue-700/40 hover:border-blue-500 transition-shadow duration-150 ease-in-out' : 'opacity-80'}`} 
                             onClick={() => canEditMatch && onMatchClick && onMatchClick(match)} 
                             title={canEditMatch && onMatchClick ? "Click to Update Score" : (match.status === 'COMPLETED' ? "Match Completed" : "Match not ready for score input")}>
                            <span className={`text-sm flex-1 truncate pr-1 ${match.winner_id === match.participant1_id ? 'font-semibold text-green-300' : 'text-slate-200'}`}>{p1Name}</span>
                            <div className="mx-1 text-center flex-shrink-0 px-1 min-w-[60px]"> 
                                {match.status === 'COMPLETED' ? 
                                    (<span className="text-sm font-bold text-slate-100">{match.score_participant1 ?? 0} - {match.score_participant2 ?? 0}</span>) : 
                                    (<span className="text-xs text-slate-500">vs</span>)
                                }
                            </div>
                            <span className={`text-sm text-right flex-1 truncate pl-1 ${match.winner_id === match.participant2_id ? 'font-semibold text-green-300' : 'text-slate-200'}`}>{p2Name}</span>
                            {match.status !== 'COMPLETED' && canEditMatch && onMatchClick && (
                                <PencilSquareIcon className="h-4 w-4 text-blue-400 hover:text-blue-300 ml-2 flex-shrink-0"/>
                            )}
                            {match.status === 'COMPLETED' && (
                                <CheckCircleIcon className="h-4 w-4 text-green-400 ml-2 flex-shrink-0"/>
                            )}
                        </div>
                    );
                    })}
                </div>
                </div>
            )) : (
                <p className="italic text-slate-500 text-center py-4">
                    {participants.length < 2 ? "Add more participants to generate matches." : "No matches have been generated for this tournament."}
                </p>
            )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default RoundRobinTable;