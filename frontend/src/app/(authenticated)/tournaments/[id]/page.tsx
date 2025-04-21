'use client';

import TournamentDetailClient from './TournamentDetailClient';

// This is a server component that handles URL params
export default function TournamentPage({ params }: { params: { id: string } }) {
  return (
    <div>
      <TournamentDetailClient tournamentId={params.id} />
    </div>
  );
} 