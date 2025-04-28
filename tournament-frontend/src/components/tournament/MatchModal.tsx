import React, { useState } from 'react';
import { Match, Participant } from '@/types/tournament';

interface MatchModalProps {
  match: Match;
  participants: Participant[];
  onClose: () => void;
  onUpdate: (updatedMatch: Match) => Promise<void>;
}

const MatchModal: React.FC<MatchModalProps> = ({ match, participants, onClose, onUpdate }) => {
  const [score1, setScore1] = useState<number>(match.score_participant1 || 0);
  const [score2, setScore2] = useState<number>(match.score_participant2 || 0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const participant1 = participants.find(p => p.id === match.participant1_id);
  const participant2 = participants.find(p => p.id === match.participant2_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate scores
    if (score1 === score2) {
      alert('Matches cannot end in a tie. Please ensure one participant has a higher score.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Determine winner based on scores
      let winner_id = null;
      if (score1 > score2) {
        winner_id = match.participant1_id;
      } else if (score2 > score1) {
        winner_id = match.participant2_id;
      }
      
      const updatedMatch: Match = {
        ...match,
        score_participant1: score1,
        score_participant2: score2,
        winner_id,
        status: 'COMPLETED'
      };
      
      await onUpdate(updatedMatch);
    } catch (error) {
      console.error('Error updating match:', error);
      alert('Failed to update match. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Update Match</h2>
        
        <div className="mb-4 p-3 bg-gray-50 rounded-md">
          <div className="flex justify-between items-center">
            <div className="font-medium">{participant1?.participant_name || 'TBD'}</div>
            <div className="text-gray-500">vs</div>
            <div className="font-medium">{participant2?.participant_name || 'TBD'}</div>
          </div>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-center space-x-4 mb-6">
            <input
              type="number"
              min="0"
              className="w-20 h-14 text-center text-xl border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={score1}
              onChange={(e) => setScore1(parseInt(e.target.value || '0', 10))}
              disabled={!participant1 || !participant2 || isSubmitting}
            />
            <div className="text-xl font-bold text-gray-400">-</div>
            <input
              type="number"
              min="0"
              className="w-20 h-14 text-center text-xl border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
              value={score2}
              onChange={(e) => setScore2(parseInt(e.target.value || '0', 10))}
              disabled={!participant1 || !participant2 || isSubmitting}
            />
          </div>
          
          <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-md mb-4">
            <ul className="list-disc pl-5 space-y-1">
              <li>Scores must be non-negative numbers</li>
              <li>Matches cannot end in a tie</li>
              <li>The winner will advance to the next round automatically</li>
            </ul>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button 
              type="button" 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              disabled={!participant1 || !participant2 || isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : 'Save Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MatchModal; 