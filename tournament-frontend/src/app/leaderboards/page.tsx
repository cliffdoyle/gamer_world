// src/app/leaderboards/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { rankingApi } from '@/lib/api/ranking';
import { LeaderboardEntry, PaginatedLeaderboardResponse } from '@/types/ranking';
// import ProtectedRoute from '@/components/auth/ProtectedRoute'; // If leaderboard is protected
import Link from 'next/link'; // Not used in this snippet, but keep if needed elsewhere

export default function LeaderboardsPage() {
  const { token } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<PaginatedLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [gameIdFilter, setGameIdFilter] = useState<string>('');

  const PAGE_SIZE = 15;

  const fetchLeaderboard = async (page: number, gameId?: string) => {
    // No need to check token here if endpoint is public or rankingApi handles it
    setIsLoading(true);
    setError(null);
    try {
      const data = await rankingApi.getLeaderboard(token || "dummy_token_if_public_or_ranking_api_handles_auth", gameId || undefined, page, PAGE_SIZE);
      // Ensure leaderboard array exists, even if empty
      if (data && !Array.isArray(data.leaderboard)) {
        console.warn("API returned leaderboard data but 'leaderboard' field is not an array. Defaulting to empty.", data);
        data.leaderboard = [];
      }
      setLeaderboardData(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch leaderboard.");
      setLeaderboardData(null); // Clear data on error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(currentPage, gameIdFilter);
  }, [currentPage, gameIdFilter, token]); // Added token dependency if fetchLeaderboard uses it

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (leaderboardData && Array.isArray(leaderboardData.leaderboard) && currentPage * PAGE_SIZE < leaderboardData.totalPlayers) {
      setCurrentPage(prev => prev - 1);
    }
  };
  
  const handleGameFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGameIdFilter(e.target.value);
  };
  const applyGameFilter = () => {
    setCurrentPage(1);
    fetchLeaderboard(1, gameIdFilter);
  }

  return (
    // <ProtectedRoute> // Uncomment if this page needs auth
      <div className="min-h-screen bg-black text-gray-100 py-8 font-sans">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold text-teal-400 mb-2">Leaderboards</h1>
            <p className="text-gray-400">See who's dominating the ranks!</p>
          </div>

          <div className="mb-6 p-4 bg-gray-950 border border-teal-500/30 rounded-lg flex flex-col sm:flex-row gap-4 items-center">
            <label htmlFor="gameIdFilter" className="text-sm text-gray-300 whitespace-nowrap">Filter by Game ID:</label>
            <input
              type="text"
              id="gameIdFilter"
              value={gameIdFilter}
              onChange={handleGameFilterChange}
              placeholder="e.g., global, fifa24 (or leave blank)"
              className="input input-sm input-bordered bg-gray-800 border-gray-700 text-gray-200 focus:border-teal-500 flex-grow"
            />
            <button onClick={applyGameFilter} className="btn btn-sm bg-teal-500 hover:bg-teal-600 text-black">Apply Filter</button>
          </div>

          {isLoading && <div className="text-center py-10 text-gray-400">Loading leaderboard...</div>}
          {error && <div className="text-center py-10 text-red-400">Error: {error}</div>}
          
          {/* CORRECTED CONDITIONAL RENDERING */}
          {!isLoading && !error && leaderboardData && Array.isArray(leaderboardData.leaderboard) && leaderboardData.leaderboard.length > 0 && (
            <>
              <div className="overflow-x-auto bg-gray-950 border border-teal-500/30 rounded-lg shadow-lg">
                <table className="min-w-full divide-y divide-gray-700">
                  <thead className="bg-gray-800">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-teal-300 uppercase tracking-wider">Rank</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-teal-300 uppercase tracking-wider">Player</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-teal-300 uppercase tracking-wider">Score</th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-700/50">
                    {leaderboardData.leaderboard.map((entry: LeaderboardEntry) => (
                      <tr key={entry.userId} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-teal-400">{entry.rank}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                          {entry.userName || `User ${entry.userId.substring(0,8)}...`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{entry.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-between items-center text-sm">
                <button 
                  onClick={handlePreviousPage} 
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-400">
                  Page {leaderboardData.page} of {leaderboardData.totalPlayers > 0 ? Math.ceil(leaderboardData.totalPlayers / PAGE_SIZE) : 1} (Total: {leaderboardData.totalPlayers} players)
                </span>
                <button 
                  onClick={handleNextPage} 
                  disabled={!leaderboardData || !Array.isArray(leaderboardData.leaderboard) || currentPage * PAGE_SIZE >= leaderboardData.totalPlayers || isLoading}
                  className="btn btn-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
          {/* CORRECTED CONDITIONAL RENDERING for "No players" */}
          {!isLoading && !error && (!leaderboardData || !Array.isArray(leaderboardData.leaderboard) || leaderboardData.leaderboard.length === 0) && (
            <div className="text-center py-10 text-gray-500">No players found on the leaderboard for this game, or data is unavailable.</div>
          )}
        </div>
      </div>
    // </ProtectedRoute>
  );
}