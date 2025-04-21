'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface CreateTournamentForm {
  name: string;
  description: string;
  game: string;
  format: string;
  maxParticipants: number;
  startDate: string;
  registrationDeadline: string;
  rules: string;
  prizePool?: {
    currency: string;
    amount: number;
  };
  customFields?: Record<string, string>;
}

export default function CreateTournamentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState<CreateTournamentForm>({
    name: '',
    description: '',
    game: '',
    format: 'SINGLE_ELIMINATION',
    maxParticipants: 8,
    startDate: '',
    registrationDeadline: '',
    rules: '',
    prizePool: {
      currency: 'USD',
      amount: 0
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:8082/tournaments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create tournament');
      }

      const tournament = await response.json();
      router.push(`/tournaments/${tournament.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="md:flex md:items-center md:justify-between md:space-x-4 xl:border-b xl:pb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Tournament</h1>
          <p className="mt-2 text-sm text-gray-700">
            Set up a new tournament and invite participants to compete.
          </p>
        </div>
        <div className="mt-4 flex space-x-3 md:mt-0">
          <Link
            href="/tournaments"
            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Cancel
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-8 divide-y divide-gray-200">
        <div className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Tournament Name
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <div className="mt-1">
              <textarea
                id="description"
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-2">
            <div>
              <label htmlFor="game" className="block text-sm font-medium text-gray-700">
                Game
              </label>
              <div className="mt-1">
                <input
                  type="text"
                  id="game"
                  required
                  value={formData.game}
                  onChange={(e) => setFormData({ ...formData, game: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="format" className="block text-sm font-medium text-gray-700">
                Tournament Format
              </label>
              <div className="mt-1">
                <select
                  id="format"
                  required
                  value={formData.format}
                  onChange={(e) => setFormData({ ...formData, format: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                >
                  <option value="SINGLE_ELIMINATION">Single Elimination</option>
                  <option value="DOUBLE_ELIMINATION">Double Elimination</option>
                  <option value="ROUND_ROBIN">Round Robin</option>
                  <option value="SWISS">Swiss System</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="maxParticipants" className="block text-sm font-medium text-gray-700">
                Maximum Participants
              </label>
              <div className="mt-1">
                <select
                  id="maxParticipants"
                  required
                  value={formData.maxParticipants}
                  onChange={(e) => setFormData({ ...formData, maxParticipants: parseInt(e.target.value) })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                >
                  {[4, 8, 16, 32, 64].map((num) => (
                    <option key={num} value={num}>
                      {num} participants
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="registrationDeadline" className="block text-sm font-medium text-gray-700">
                Registration Deadline
              </label>
              <div className="mt-1">
                <input
                  type="datetime-local"
                  id="registrationDeadline"
                  required
                  value={formData.registrationDeadline}
                  onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">Must be before the start date</p>
            </div>

            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                Start Date
              </label>
              <div className="mt-1">
                <input
                  type="datetime-local"
                  id="startDate"
                  required
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="rules" className="block text-sm font-medium text-gray-700">
              Tournament Rules
            </label>
            <div className="mt-1">
              <textarea
                id="rules"
                required
                rows={6}
                value={formData.rules}
                onChange={(e) => setFormData({ ...formData, rules: e.target.value })}
                placeholder="Specify tournament rules, format details, and any specific requirements..."
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label htmlFor="prizeAmount" className="block text-sm font-medium text-gray-700">
                Prize Pool Amount
              </label>
              <div className="mt-1">
                <input
                  type="number"
                  id="prizeAmount"
                  min="0"
                  value={formData.prizePool?.amount === null || formData.prizePool?.amount === undefined ? '' : formData.prizePool?.amount}
                  onChange={(e) => setFormData({
                    ...formData,
                    prizePool: { ...formData.prizePool!, amount: parseFloat(e.target.value) }
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="prizeCurrency" className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <div className="mt-1">
                <select
                  id="prizeCurrency"
                  value={formData.prizePool?.currency}
                  onChange={(e) => setFormData({
                    ...formData,
                    prizePool: { ...formData.prizePool!, currency: e.target.value }
                  })}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white text-gray-900"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="ml-3 inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Tournament'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
} 