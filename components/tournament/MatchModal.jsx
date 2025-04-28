import React, { useState } from 'react';

const MatchModal = ({ match, participants, onClose, onUpdate }) => {
  const [score1, setScore1] = useState(match.score1 || 0);
  const [score2, setScore2] = useState(match.score2 || 0);

  const participant1 = participants.find(p => p.id === match.participant1ID);
  const participant2 = participants.find(p => p.id === match.participant2ID);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Determine winner based on scores
    let winnerID = null;
    let loserID = null;
    
    if (score1 > score2) {
      winnerID = match.participant1ID;
      loserID = match.participant2ID;
    } else if (score2 > score1) {
      winnerID = match.participant2ID;
      loserID = match.participant1ID;
    }
    
    const updatedMatch = {
      ...match,
      score1,
      score2,
      winnerID,
      loserID,
      status: score1 === score2 ? match.status : 'COMPLETED'
    };
    
    onUpdate(updatedMatch);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>Update Match</h2>
        
        <div className="match-teams">
          <div className="team">{participant1?.name || 'TBD'}</div>
          <div className="vs">vs</div>
          <div className="team">{participant2?.name || 'TBD'}</div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="score-inputs">
            <input
              type="number"
              min="0"
              value={score1}
              onChange={(e) => setScore1(parseInt(e.target.value, 10) || 0)}
              disabled={!participant1 || !participant2}
            />
            <div className="score-separator">-</div>
            <input
              type="number"
              min="0"
              value={score2}
              onChange={(e) => setScore2(parseInt(e.target.value, 10) || 0)}
              disabled={!participant1 || !participant2}
            />
          </div>
          
          <div className="modal-actions">
            <button 
              type="button" 
              className="cancel-button" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="save-button"
              disabled={!participant1 || !participant2}
            >
              Save Result
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchModal; 