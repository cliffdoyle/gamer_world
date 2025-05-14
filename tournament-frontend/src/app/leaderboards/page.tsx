// src/app/leaderboards/page.tsx
'use client';

import { useEffect, useState }
from 'react';
import { useAuth } from '@/contexts/AuthContext'; // To get token if needed
import { rankingApi } from '@/lib/api/ranking';
import { LeaderboardEntry, PaginatedLeaderboardResponse } from '@/types/ranking';
import ProtectedRoute from '@/components/auth/ProtectedRoute'; // If leaderboard is protected
import Link from 'next/link';

export default function LeaderboardsPage() {
  const { token } = useAuth();
  const [leaderboardData, setLeaderboardData] = useState<PaginatedLeaderboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [gameIdFilter, setGameIdFilter] = useState<string>(''); // Default to global or let user select

  const PAGE_SIZE = 15; // Or make configurable

  const fetchLeaderboard = async (page: number, gameId?: string) => {
    if (!token) { // Assuming token might be needed for auth consistency, even if endpoint is public
        // setError("Authentication token not found.");
        // setIsLoading(false);
        // return;
    }
    setIsLoading(true);
    setError(null);
    try {
      // Pass token if your rankingApi.getLeaderboard expects it
      const data = await rankingApi.getLeaderboard(token || "dummy_token_if_public", gameId || undefined, page, PAGE_SIZE);
      setLeaderboardData(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch leaderboard.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(currentPage, gameIdFilter);
  }, [currentPage, gameIdFilter, token]);

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (leaderboardData && currentPage * PAGE_SIZE < leaderboardData.totalPlayers) {
      setCurrentPage(prev => prev + 1);
    }
  };
  
  // Basic game filter input
  const handleGameFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Basic implementation, you might want a dropdown of available games
    setGameIdFilter(e.target.value);
  };
  const applyGameFilter = () => {
    setCurrentPage(1); // Reset to first page on new filter
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
          
          {!isLoading && !error && leaderboardData && leaderboardData.leaderboard.length > 0 && (
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
                          {/* Link to player profile if you have one */}
                          {entry.userName || `User ${entry.userId.substring(0,8)}...`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{entry.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="mt-6 flex justify-between items-center text-sm">
                <button 
                  onClick={handlePreviousPage} 
                  disabled={currentPage === 1 || isLoading}
                  className="btn btn-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-gray-400">
                  Page {leaderboardData.page} of {Math.ceil(leaderboardData.totalPlayers / PAGE_SIZE)} (Total: {leaderboardData.totalPlayers} players)
                </span>
                <button 
                  onClick={handleNextPage} 
                  disabled={currentPage * PAGE_SIZE >= leaderboardData.totalPlayers || isLoading}
                  className="btn btn-sm bg-gray-700 hover:bg-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </>
          )}
          {!isLoading && !error && (!leaderboardData || leaderboardData.leaderboard.length === 0) && (
            <div className="text-center py-10 text-gray-500">No players found on the leaderboard for this game.</div>
          )}
        </div>
      </div>
    // </ProtectedRoute>
  );
}