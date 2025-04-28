import React from 'react';

const RoundRobinTable = ({ matches, participants, onMatchClick }) => {
  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    if (!acc[match.round]) acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
  }, {});

  // Get participant objects by ID
  const participantsById = participants.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {});

  // Calculate standings
  const standings = participants.map(p => {
    const participantMatches = matches.filter(
      m => m.participant1ID === p.id || m.participant2ID === p.id
    );
    
    let wins = 0;
    let losses = 0;
    let draws = 0;
    
    participantMatches.forEach(match => {
      if (match.status !== 'COMPLETED') return;
      
      if (match.winnerID === p.id) {
        wins++;
      } else if (match.winnerID && match.winnerID !== p.id) {
        losses++;
      } else if (match.winnerID === null && match.status === 'COMPLETED') {
        draws++;
      }
    });
    
    return {
      participant: p,
      matches: participantMatches.length,
      wins,
      losses,
      draws,
      points: wins * 3 + draws * 1 // Example: 3 points for win, 1 for draw
    };
  }).sort((a, b) => b.points - a.points);

  // Get max round number
  const maxRound = Math.max(...matches.map(m => m.round));

  return (
    <div className="round-robin-container">
      <div className="standings-table">
        <h2>Standings</h2>
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>W</th>
              <th>L</th>
              <th>D</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, index) => (
              <tr key={s.participant.id}>
                <td>{index + 1}</td>
                <td>{s.participant.name}</td>
                <td>{s.wins}</td>
                <td>{s.losses}</td>
                <td>{s.draws}</td>
                <td>{s.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounds-container">
        <h2>Matches by Round</h2>
        {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => (
          <div key={round} className="round-container">
            <h3>Round {round}</h3>
            <div className="round-matches">
              {matchesByRound[round]?.map(match => (
                <div 
                  key={match.id} 
                  className={`round-match ${match.status === 'COMPLETED' ? 'completed' : 'pending'}`}
                  onClick={() => onMatchClick && onMatchClick(match)}
                >
                  <span className="participant">
                    {match.participant1ID ? participantsById[match.participant1ID].name : 'TBD'}
                    {match.status === 'COMPLETED' && ` (${match.score1 || 0})`}
                  </span>
                  <span className="vs">vs</span>
                  <span className="participant">
                    {match.participant2ID ? participantsById[match.participant2ID].name : 'TBD'}
                    {match.status === 'COMPLETED' && ` (${match.score2 || 0})`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RoundRobinTable; 