// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Keep if you add router.push actions for 'View All'
import { FaTrophy, FaGamepad, FaUsers, FaMedal, FaChevronRight } from 'react-icons/fa';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
// Make sure the path to your API functions is correct
import { tournamentApi } from '@/lib/api/tournament';
// Import the specific types that your API functions will return
import { TournamentResponse as FetchedTournament, UserActivity as FetchedActivity } from '@/types/tournament';

const TEAL_COLOR_HEX = "#2DD4BF";

// Helper to format tournament status for display
const formatTournamentStatusForDisplay = (
    status: FetchedTournament['status'],
    registrationDeadline?: string | null,
    startTime?: string | null // You might use startTime to determine if 'upcoming' vs 'active'
): string => {
    switch (status) {
        case 'REGISTRATION':
            if (registrationDeadline) {
                const deadline = new Date(registrationDeadline);
                if (deadline > new Date()) return 'Registrations Open';
                return 'Registration Closed';
            }
            return 'Registrations Open';
        case 'IN_PROGRESS':
            return 'In Progress';
        case 'COMPLETED':
            return 'Completed';
        case 'DRAFT':
            return 'Draft (Not Started)';
        case 'CANCELLED':
            return 'Cancelled';
        default:
            return 'Unknown Status (' + String(status) + ')'; // Return the status if it's weird
    }
};

// Helper to format prize pool for display
const formatPrize = (prizePool: any): string => {
    if (!prizePool) return 'N/A';
    // If prizePool is already a simple string (e.g., "Bragging Rights")
    if (typeof prizePool === 'string' && !prizePool.startsWith('{')) return prizePool;

    try {
        // Backend sends json.RawMessage, which is a string that needs parsing if it's complex JSON
        const parsed = typeof prizePool === 'string' ? JSON.parse(prizePool) : prizePool;

        if (typeof parsed === 'object' && parsed !== null) {
            if (parsed.currency && parsed.amount) {
                return `${parsed.currency} ${Number(parsed.amount).toLocaleString()}`;
            }
            if (parsed.details) { // If it's an object with a 'details' field
                return parsed.details;
            }
            // Fallback if it's an object but not in expected format
            return 'View Details';
        }
        // If it's a simple string after parsing (or was already a simple string not representing JSON)
        return String(parsed);
    } catch (e) {
        // If JSON.parse fails on a string that wasn't JSON, just return the string
        if (typeof prizePool === 'string') return prizePool;
        console.warn("Could not parse prizePool:", prizePool, e);
        return 'Error Reading Prize';
    }
};

// Helper to format date for display
const formatDateForActivity = (isoString: string) => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch (e) {
        return 'Invalid Date';
    }
};


export default function Dashboard() {
  const router = useRouter();
  const { token, user: authUser } = useAuth();
  
  // --- User Data (mix of auth context and placeholders for now) ---
  const dashboardUser = {
    username: authUser?.username || "ProGamer123",
    rank: authUser?.rank || "Diamond Elite",      // Placeholder - needs backend data
    level: authUser?.level || 42,                 // Placeholder - needs backend data
    avatar: authUser?.profile_picture_url || "/avatar.png", // Ensure this path is correct
    stats: { // These still need dedicated backend APIs to be dynamic
      winRate: "68%",
      totalGames: 156,
      tournaments: 12,
      currentRank: 124
    }
  };

  // --- State for Fetched Data ---
  const [activeTournaments, setActiveTournaments] = useState<FetchedTournament[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const [recentActivities, setRecentActivities] = useState<FetchedActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);


  useEffect(() => {
    if (token) {
      // Fetch Active Tournaments
      const fetchActiveTournaments = async () => {
        setIsLoadingTournaments(true);
        setTournamentsError(null);
        try {
          const response = await tournamentApi.getActiveTournaments(token, 1, 3);
          setActiveTournaments(response.tournaments); // API returns { tournaments: [], ... }
        } catch (err) {
          console.error("Failed to fetch active tournaments:", err);
          setTournamentsError(err instanceof Error ? err.message : "Could not load active tournaments.");
        } finally {
          setIsLoadingTournaments(false);
        }
      };

      // Fetch Recent Activities
      const fetchRecentActivities = async () => {
        setIsLoadingActivities(true);
        setActivitiesError(null);
        try {
          const response = await tournamentApi.getRecentActivities(token, 1, 4);
          setRecentActivities(response.activities); // API returns { activities: [], ... }
        } catch (err) {
          console.error("Failed to fetch recent activities:", err);
          setActivitiesError(err instanceof Error ? err.message : "Could not load recent activities.");
        } finally {
          setIsLoadingActivities(false);
        }
      };

      fetchActiveTournaments();
      fetchRecentActivities();
    } else {
      // Handle case where token is not yet available or user is not logged in
      // (ProtectedRoute should handle redirection if not logged in)
      setIsLoadingTournaments(false);
      setIsLoadingActivities(false);
    }
  }, [token]);

  // Determine dot color based on activity type string from backend
  const getActivityDotColor = (activityType: string) => {
    if (activityType.includes('WIN') || activityType.includes('WON')) return 'bg-green-400';
    if (activityType.includes('JOIN') || activityType.includes('CREATE')) return 'bg-teal-400';
    if (activityType.includes('BADGE') || activityType.includes('ACHIEVEMENT')) return 'bg-yellow-400';
    if (activityType.includes('POST')) return 'bg-blue-400';
    return 'bg-gray-500'; // Default for other types
  };


  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-gray-100 py-8 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Section */}
          <div className="mb-10 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10 flex flex-col md:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 rounded-full border-4 border-teal-400 shadow-lg shadow-teal-400/40 overflow-hidden">
                <Image
                  src={dashboardUser.avatar} // Make sure /avatar.png exists in public folder
                  alt="User Avatar"
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                LVL {dashboardUser.level}
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-1">
                Welcome back, <span className="text-teal-400">{dashboardUser.username}</span>!
              </h1>
              <p className="text-gray-400 text-lg">Current Rank: <span className="text-teal-400 font-semibold">{dashboardUser.rank}</span></p>
            </div>
          </div>

          {/* Stats Grid (remains placeholder until stats APIs are ready) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { icon: FaTrophy, label: "Win Rate", value: dashboardUser.stats.winRate },
              { icon: FaGamepad, label: "Total Games", value: dashboardUser.stats.totalGames },
              { icon: FaUsers, label: "Tournaments Played", value: dashboardUser.stats.tournaments },
              { icon: FaMedal, label: "Global Rank", value: `#${dashboardUser.stats.currentRank}` },
            ].map((stat, index) => (
              <div key={index} className="bg-gray-950 rounded-xl p-5 border border-teal-500/20 shadow-md hover:border-teal-500/50 hover:shadow-teal-500/20 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center text-teal-400 flex-shrink-0">
                  <stat.icon size={26} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{String(stat.value)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Tournaments */}
            <div className="lg:col-span-2 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaTrophy className="text-teal-400" size={24} />
                  Active Tournaments
                </h2>
                <Link href="/tournaments?filter=active" className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </Link>
              </div>
              <div className="space-y-4">
                {isLoadingTournaments && <p className="text-gray-400 text-center py-4">Loading active tournaments...</p>}
                {tournamentsError && <p className="text-red-400 text-center py-4">Error: {tournamentsError}</p>}
                {!isLoadingTournaments && !tournamentsError && activeTournaments.length > 0 && activeTournaments.map((tournament) => (
                  <Link href={`/tournaments/${tournament.id}`} key={tournament.id} className="block bg-gray-950 rounded-lg p-4 border border-gray-800 hover:border-teal-500/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{tournament.name}</h3>
                      <span className="text-sm font-bold text-teal-400">{formatPrize(tournament.prizePool)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{tournament.currentParticipants} Participants</span>
                      <span className={`font-medium ${
                        tournament.status === 'REGISTRATION' || tournament.status === 'IN_PROGRESS' ? 'text-green-400' : 
                        tournament.status === 'COMPLETED' || tournament.status === 'CANCELLED' ? 'text-gray-500' : // Consider grey for completed/cancelled
                        'text-yellow-400' // For DRAFT or other intermediate states
                        }`}>
                        {formatTournamentStatusForDisplay(tournament.status, tournament.registrationDeadline, tournament.startTime)}
                      </span>
                    </div>
                  </Link>
                ))}
                {!isLoadingTournaments && !tournamentsError && activeTournaments.length === 0 && <p className="text-gray-500 text-center py-4">No active tournaments right now.</p>}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaUsers className="text-teal-400" size={24} />
                  Recent Activity
                </h2>
                {/* You might link this to a full activity page later */}
                <button onClick={() => alert("View all activity - not yet implemented")} className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                 {isLoadingActivities && <p className="text-gray-400 text-center py-4">Loading recent activity...</p>}
                 {activitiesError && <p className="text-red-400 text-center py-4">Error: {activitiesError}</p>}
                {!isLoadingActivities && !activitiesError && recentActivities.length > 0 && recentActivities.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 bg-gray-950 p-3 rounded-lg border border-gray-800">
                    <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${getActivityDotColor(item.type)}`} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{item.detail}</p>
                      <p className="text-xs text-gray-500">{formatDateForActivity(item.date)}</p>
                    </div>
                  </div>
                ))}
                {!isLoadingActivities && !activitiesError && recentActivities.length === 0 && <p className="text-gray-500 text-center py-4">No recent activity to display.</p>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/tournaments" passHref legacyBehavior>
                <a className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg shadow-teal-500/30 hover:shadow-teal-600/40 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75">
                  Find a Tournament
                </a>
            </Link> 
            <Link href="/tournaments/create" passHref legacyBehavior>
              <a className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 text-center inline-block">
                Create New Tournament
              </a>
            </Link>
            <button 
              onClick={() => alert("Leaderboards page - not yet implemented")}
              className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75"
            >
              View Leaderboards
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}