'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getTournament, getParticipants, addParticipant, generateBracket } from '../../../lib/api';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserIcon, TrophyIcon } from '@heroicons/react/24/outline';

const addParticipantSchema = z.object({
  participant_name: z.string().min(2, 'Name must be at least 2 characters'),
});

type AddParticipantFormData = z.infer<typeof addParticipantSchema>;

export default function TournamentDetailPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const queryClient = useQueryClient();
  const [showAddParticipant, setShowAddParticipant] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddParticipantFormData>({
    resolver: zodResolver(addParticipantSchema),
  });

  const { data: tournamentResponse, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', tournamentId],
    queryFn: () => getTournament(tournamentId),
  });

  const { data: participantsResponse, isLoading: participantsLoading } = useQuery({
    queryKey: ['participants', tournamentId],
    queryFn: () => getParticipants(tournamentId),
  });

  const addParticipantMutation = useMutation({
    mutationFn: (data: AddParticipantFormData) => addParticipant(tournamentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants', tournamentId] });
      reset();
      setShowAddParticipant(false);
    },
  });

  const generateBracketMutation = useMutation({
    mutationFn: () => generateBracket(tournamentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] });
    },
  });

  if (tournamentLoading || participantsLoading) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading tournament details...</p>
      </div>
    );
  }

  const tournament = tournamentResponse?.data;
  const participants = participantsResponse?.data || [];

  if (!tournament) {
    return (
      <div className="text-center text-red-600">
        Tournament not found or an error occurred.
      </div>
    );
  }

  const onSubmit = async (data: AddParticipantFormData) => {
    addParticipantMutation.mutate(data);
  };

  const handleGenerateBracket = () => {
    if (participants.length < 2) {
      alert('Need at least 2 participants to generate bracket');
      return;
    }
    generateBracketMutation.mutate();
  };

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">{tournament.name}</h1>
          <p className="mt-2 text-sm text-gray-700">{tournament.description}</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
            tournament.status === 'IN_PROGRESS'
              ? 'bg-green-100 text-green-800'
              : tournament.status === 'COMPLETED'
              ? 'bg-gray-100 text-gray-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {tournament.status}
          </span>
        </div>
      </div>

      <div className="mt-8">
        <div className="sm:flex sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Participants</h2>
          <div className="mt-4 sm:mt-0">
            {tournament.status === 'PENDING' && (
              <>
                <button
                  onClick={() => setShowAddParticipant(true)}
                  className="inline-flex items-center gap-x-1.5 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  <UserIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                  Add Participant
                </button>
                {participants.length >= 2 && (
                  <button
                    onClick={handleGenerateBracket}
                    className="ml-3 inline-flex items-center gap-x-1.5 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                  >
                    <TrophyIcon className="-ml-0.5 h-5 w-5" aria-hidden="true" />
                    Generate Bracket
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {showAddParticipant && tournament.status === 'PENDING' && (
          <div className="mt-4">
            <form onSubmit={handleSubmit(onSubmit)} className="flex gap-4 items-end">
              <div className="flex-1">
                <label htmlFor="participant_name" className="block text-sm font-medium text-gray-700">
                  Participant Name
                </label>
                <input
                  type="text"
                  id="participant_name"
                  {...register('participant_name')}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                {errors.participant_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.participant_name.message}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddParticipant(false)}
                  className="inline-flex justify-center rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-4 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Joined At
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {participants.map((participant) => (
                      <tr key={participant.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {participant.participant_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {new Date(participant.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                    {participants.length === 0 && (
                      <tr>
                        <td colSpan={2} className="px-6 py-4 text-center text-sm text-gray-500">
                          No participants yet. Add some to get started!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 