import React from 'react';
import { Match as MatchType, Participant } from '@/types/tournament';

interface MatchProps {
  match: MatchType & {
    participant1?: Participant | null;
    participant2?: Participant | null;
  };
  onClick?: (match: MatchType) => void;
}

const Match: React.FC<MatchProps> = ({ match, onClick }) => {
  return (
    <div className="match-container" data-match-id={match.id}>
      <div 
        className={`match ${match.status === 'COMPLETED' ? 'completed' : 'pending'}`}
        onClick={() => onClick && onClick(match)}
      >
        <div className={`participant ${match.winner_id === match.participant1_id ? 'winner' : ''}`}>
          <span className="seed">{match.participant1?.seed || '-'}</span>
          <span className="name">{match.participant1?.participant_name || 'TBD'}</span>
          <span className="score">{match.score_participant1 || '-'}</span>
        </div>
        <div className={`participant ${match.winner_id === match.participant2_id ? 'winner' : ''}`}>
          <span className="seed">{match.participant2?.seed || '-'}</span>
          <span className="name">{match.participant2?.participant_name || 'TBD'}</span>
          <span className="score">{match.score_participant2 || '-'}</span>
        </div>
      </div>
    </div>
  );
};

export default Match; 