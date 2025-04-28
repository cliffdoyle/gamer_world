import React, { useState } from 'react';
import { Match } from '@/types/tournament';

interface MatchScoreEditorProps {
  match: Match;
  participant1Name: string;
  participant2Name: string;
  onSubmit: (matchId: string, score1: string, score2: string) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

const MatchScoreEditor: React.FC<MatchScoreEditorProps> = ({
  match,
  participant1Name,
  participant2Name,
  onSubmit,
  onCancel,
  isSubmitting
}) => {
  const [scoreForm, setScoreForm] = useState<{ score1: string; score2: string }>({
    score1: match.score_participant1?.toString() || '',
    score2: match.score_participant2?.toString() || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(match.id, scoreForm.score1, scoreForm.score2);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 border border-blue-100 mb-4">
      <h3 className="text-lg font-medium mb-3 text-blue-800">Update Match Score</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700 w-1/2 pr-2">
              {participant1Name}
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center"
                value={scoreForm.score1}
                onChange={(e) => setScoreForm({ ...scoreForm, score1: e.target.value })}
                required
              />
            </label>
            
            <div className="text-lg font-bold text-gray-500">vs</div>
            
            <label className="block text-sm font-medium text-gray-700 w-1/2 pl-2">
              {participant2Name}
              <input
                type="number"
                min="0"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center"
                value={scoreForm.score2}
                onChange={(e) => setScoreForm({ ...scoreForm, score2: e.target.value })}
                required
              />
            </label>
          </div>
          
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <p>• Scores must be non-negative numbers</p>
            <p>• Matches cannot end in a tie</p>
            <p>• The winner will advance to the next round automatically</p>
          </div>
          
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Updating...
                </span>
              ) : (
                'Update Score'
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MatchScoreEditor; 