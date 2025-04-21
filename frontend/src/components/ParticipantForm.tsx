import { useState } from 'react';
import { Participant } from '../types/tournament';
import { AddParticipantRequest } from '../types/api';

interface ParticipantFormProps {
  onAddParticipant: (participant: AddParticipantRequest) => Promise<void>;
  participants: Participant[];
  maxParticipants: number;
  isLoading?: boolean;
}

export default function ParticipantForm({ onAddParticipant, participants, maxParticipants, isLoading }: ParticipantFormProps) {
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (participants.length >= maxParticipants) {
      setError('Tournament has reached maximum participants');
      return;
    }
    try {
      await onAddParticipant({ userId, name });
      setUserId('');
      setName('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add participant');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white shadow-sm rounded-lg divide-y divide-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900">Participants ({participants.length}/{maxParticipants})</h3>
          <div className="mt-4">
            {participants.length > 0 ? (
              <ul className="divide-y divide-gray-200">
                {participants.map((participant) => (
                  <li key={participant.id} className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{participant.name}</p>
                        <p className="text-sm text-gray-500">{participant.userId}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        participant.status === 'CHECKED_IN' ? 'bg-green-100 text-green-800' :
                        participant.status === 'ELIMINATED' ? 'bg-red-100 text-red-800' :
                        participant.status === 'WAITLISTED' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {participant.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No participants yet</p>
            )}
          </div>
        </div>

        <div className="p-6">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Add Participant</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-700">
                User ID
              </label>
              <input
                type="text"
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || participants.length >= maxParticipants}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                ${isLoading || participants.length >= maxParticipants
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
                }`}
            >
              {isLoading ? 'Adding...' : 'Add Participant'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
} 