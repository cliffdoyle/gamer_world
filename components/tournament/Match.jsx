import React from 'react';

const Match = ({ match, onClick }) => {
  return (
    <div className="match-container" data-match-id={match.id}>
      <div 
        className={`match ${match.status === 'COMPLETED' ? 'completed' : 'pending'}`}
        onClick={() => onClick && onClick(match)}
      >
        <div className={`participant ${match.winnerID === match.participant1ID ? 'winner' : ''}`}>
          <span className="seed">{match.participant1?.seed || '-'}</span>
          <span className="name">{match.participant1?.name || 'TBD'}</span>
          <span className="score">{match.score1 || '-'}</span>
        </div>
        <div className={`participant ${match.winnerID === match.participant2ID ? 'winner' : ''}`}>
          <span className="seed">{match.participant2?.seed || '-'}</span>
          <span className="name">{match.participant2?.name || 'TBD'}</span>
          <span className="score">{match.score2 || '-'}</span>
        </div>
      </div>
    </div>
  );
};

export default Match; 