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
  // Parse match notes to get progression info
  const getParticipantDisplay = (participant: Participant | null | undefined, participantId: string | null | undefined) => {
    if (participant) {
      return participant.participant_name;
    }
    
    // If no participant but we have match notes, try to show progression
    if (match.match_notes) {
      const matchNumberRegex = /Winner of Match (\d+)/;
      const loserMatchRegex = /Loser of Match (\d+)/;
      
      const winnerMatches = match.match_notes.match(matchNumberRegex);
      const loserMatches = match.match_notes.match(loserMatchRegex);
      
      if (winnerMatches) {
        return `Winner of M${winnerMatches[1]}`;
      }
      if (loserMatches) {
        return `Loser of M${loserMatches[1]}`;
      }
      if (match.match_notes.includes('(Bye)')) {
        return 'Bye';
      }
    }
    
    return 'TBD';
  };

  const getBracketType = () => {
    if (match.match_notes?.includes('WINNERS')) return 'winners';
    if (match.match_notes?.includes('LOSERS')) return 'losers';
    if (match.match_notes?.includes('GRAND_FINALS')) return 'grand-finals';
    return '';
  };

  return (
    <div className="match-container" data-match-id={match.id}>
      <div 
        className={`match ${match.status === 'COMPLETED' ? 'completed' : 'pending'} ${getBracketType()}`}
        onClick={() => onClick && onClick(match)}
      >
        <div className={`participant ${match.winner_id === match.participant1_id ? 'winner' : ''}`}>
          <span className="seed">{match.participant1?.seed || '-'}</span>
          <span className="name">{getParticipantDisplay(match.participant1, match.participant1_id)}</span>
          <span className="score">{match.score_participant1 || '-'}</span>
        </div>
        <div className={`participant ${match.winner_id === match.participant2_id ? 'winner' : ''}`}>
          <span className="seed">{match.participant2?.seed || '-'}</span>
          <span className="name">{getParticipantDisplay(match.participant2, match.participant2_id)}</span>
          <span className="score">{match.score_participant2 || '-'}</span>
        </div>
        <div className="match-info">
          <span className="match-number">M{match.match_number}</span>
          {match.match_notes?.includes('FINALS') && (
            <span className="finals-indicator">
              {match.match_notes.includes('WINNERS') ? 'Winners Finals' :
               match.match_notes.includes('LOSERS') ? 'Losers Finals' :
               match.match_notes.includes('GRAND_FINALS') ? 'Grand Finals' : ''}
            </span>
          )}
        </div>
      </div>
      <style jsx>{`
        .match-container {
          margin: 0.5rem 0;
        }
        
        .match {
          background: #2a2a2a;
          border-radius: 4px;
          padding: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .match:hover {
          transform: translateX(2px);
          box-shadow: -2px 2px 5px rgba(0,0,0,0.2);
        }
        
        .match.winners {
          border-left: 3px solid #4299e1;
        }
        
        .match.losers {
          border-left: 3px solid #f56565;
        }
        
        .match.grand-finals {
          border-left: 3px solid #9f7aea;
        }
        
        .participant {
          display: flex;
          align-items: center;
          padding: 0.5rem;
          margin: 0.25rem 0;
          background: #333;
          border-radius: 2px;
        }
        
        .participant.winner {
          background: #2c5282;
        }
        
        .seed {
          width: 24px;
          text-align: center;
          margin-right: 0.5rem;
          color: #666;
        }
        
        .name {
          flex: 1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .score {
          width: 32px;
          text-align: right;
          margin-left: 0.5rem;
        }
        
        .match-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 0.25rem;
          font-size: 0.8rem;
          color: #666;
        }
        
        .match-number {
          font-weight: bold;
        }
        
        .finals-indicator {
          color: #9f7aea;
          font-weight: bold;
        }
      `}</style>
    </div>
  );
};

export default Match; 