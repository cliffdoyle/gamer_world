// src/app/tournaments/create/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { CreateTournamentRequest, TournamentFormat } from '@/types/tournament';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function CreateTournamentPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    game: '',
    format: 'SINGLE_ELIMINATION' as TournamentFormat,
    maxParticipants: '', // Kept as string for input field, parsed on submit
    registrationDeadline: '',
    startTime: '',
    rules: '',
    prizePool: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!token) {
        throw new Error('You must be logged in to create a tournament');
      }

      let prizePoolValue: any = undefined;
      if (formData.prizePool.trim() !== '') {
        try {
            prizePoolValue = JSON.parse(formData.prizePool);
        } catch (jsonError) {
            prizePoolValue = formData.prizePool;
        }
      }

      const tournamentData: CreateTournamentRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        game: formData.game.trim(),
        format: formData.format,
        maxParticipants: parseInt(formData.maxParticipants) || 0,
        registrationDeadline: formData.registrationDeadline || undefined,
        startTime: formData.startTime || undefined,
        rules: formData.rules.trim() === '' ? undefined : formData.rules.trim(),
        prizePool: prizePoolValue,
      };

      if (!tournamentData.name) {
        throw new Error('Tournament Name is required.');
      }
      if (!tournamentData.game) {
        throw new Error('Game is required.');
      }
      if (tournamentData.maxParticipants < 2 && tournamentData.maxParticipants !== 0) {
        throw new Error('Maximum Participants must be at least 2 (or 0 for unlimited).');
      }

      const response = await tournamentApi.createTournament(token, tournamentData);
      console.log('Tournament created:', response);
      // Consider navigating to the new tournament's detail page if the API returns an ID
      // router.push(`/tournaments/${response.id}`);
      router.push('/tournaments');
    } catch (err) {
      console.error('Error creating tournament:', err);
      setError(err instanceof Error ? err.message : 'Failed to create tournament. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 bg-gray-100 dark:bg-slate-900 min-h-screen">
        <div className="bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 md:p-10">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-slate-100 mb-8 tracking-tight text-center sm:text-left">Create New Tournament</h1>

          {error && (
            <div className="bg-red-100 dark:bg-red-500/20 border-l-4 border-red-500 dark:border-red-400 p-4 mb-6 rounded-md" role="alert">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-500 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v4a1 1 0 102 0V5zm-1 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-700 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Tournament Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tournament Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="name"
                id="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder="Enter tournament name"
              />
            </div>
            
            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Description</label>
              <textarea
                name="description"
                id="description"
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder="A brief summary of the tournament"
                rows={3}
              />
            </div>

            {/* Game */}
            <div>
              <label htmlFor="game" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Game <span className="text-red-500">*</span></label>
              <input
                type="text"
                name="game"
                id="game"
                required
                value={formData.game}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder="E.g., Street Fighter 6, FIFA 24"
              />
            </div>

            {/* Tournament Format */}
            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tournament Format <span className="text-red-500">*</span></label>
              <select
                name="format"
                id="format"
                required
                value={formData.format}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700"
              >
                <option value="SINGLE_ELIMINATION">Single Elimination</option>
                <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="SWISS">Swiss</option>
              </select>
            </div>

            {/* Maximum Participants */}
            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Max Participants <span className="text-red-500">*</span></label>
              <input
                type="number"
                name="maxParticipants"
                id="maxParticipants"
                required
                value={formData.maxParticipants}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder="Enter a number (0 for unlimited)"
                min="0"
              />
            </div>

            {/* Prize Pool / Details */}
            <div>
              <label htmlFor="prizePool" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Prize Pool / Details</label>
              <textarea
                name="prizePool"
                id="prizePool"
                rows={3}
                value={formData.prizePool}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder='E.g., "$500 + Merch", "Bragging Rights", or JSON: {"currency":"USD", "amount":1000}'
              />
               <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Enter a description (e.g., "$1000 total prize pool") or simple structured JSON.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Registration Deadline */}
                <div>
                <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Registration Deadline (Optional)</label>
                <input
                    type="datetime-local"
                    name="registrationDeadline"
                    id="registrationDeadline"
                    value={formData.registrationDeadline}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700"
                />
                </div>

                {/* Start Time */}
                <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Start Time (Optional)</label>
                <input
                    type="datetime-local"
                    name="startTime"
                    id="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700"
                />
                </div>
            </div>


            {/* Tournament Rules */}
            <div>
              <label htmlFor="rules" className="block text-sm font-medium text-gray-700 dark:text-slate-300">Tournament Rules (Optional)</label>
              <textarea
                name="rules"
                id="rules"
                value={formData.rules}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:text-slate-100 bg-gray-50 dark:bg-slate-700 placeholder-gray-400 dark:placeholder-slate-500"
                placeholder="Enter specific rules for the tournament"
                rows={4}
              />
            </div>

            <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${isSubmitting ? 'opacity-60 cursor-not-allowed saturate-50' : ''}`}
              >
                {isSubmitting ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                    </>
                ) : 'Create Tournament'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ProtectedRoute>
  );
}