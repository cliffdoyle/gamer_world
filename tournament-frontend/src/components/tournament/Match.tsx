import React from 'react';
import { Match as MatchType, Participant } from '@/types/tournament'; // Assuming MatchType is your extended match from API

interface PreparedMatchInternal extends MatchType { // The type MatchComponent receives
  participant1?: Participant | {id: string; participant_name: string}; // Allow TBD object
  participant2?: Participant | {id: string; participant_name: string};
}

interface MatchComponentProps {
  match: PreparedMatchInternal; // Use the extended type with resolved participant names or TBDs
  onClick?: (match: MatchType) => void; // Use the original MatchType for onClick
}

const MatchComponent: React.FC<MatchComponentProps> = ({ match, onClick }) => {
  const p1Name = match.participant1?.participant_name || 'TBD';
  const p2Name = match.participant2?.participant_name || 'TBD';

  const isP1Winner = match.winner_id && match.winner_id === match.participant1_id;
  const isP2Winner = match.winner_id && match.winner_id === match.participant2_id;

  return (
    <div 
      className="match-component-container" // Class for global styling from parent
      onClick={() => onClick && onClick(match)} // Pass original match structure
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      data-match-id={match.id} // Important for SVG line drawing
    >
      <div className="match-component-header">
        <span>M{match.match_number}</span>
        <span>{match.status || 'PENDING'}</span>
      </div>
      <div className={`match-component-participant ${isP1Winner ? 'winner' : ''}`}>
        <span className="match-component-name" title={p1Name}>{p1Name}</span>
        <span className="match-component-score">{match.score_participant1 ?? '-'}</span>
      </div>
      <div style={{ borderTop: '1px solid #4A5567', margin: '4px 0' }}></div> {/* Separator */}
      <div className={`match-component-participant ${isP2Winner ? 'winner' : ''}`}>
        <span className="match-component-name" title={p2Name}>{p2Name}</span>
        <span className="match-component-score">{match.score_participant2 ?? '-'}</span>
      </div>
    </div>
  );
};

export default MatchComponent;