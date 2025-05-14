// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaTrophy, FaGamepad, FaUsers, FaMedal, FaChevronRight } from 'react-icons/fa';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { tournamentApi } from '@/lib/api/tournament';
import { TournamentResponse as FetchedTournament, UserActivity as FetchedActivity, TournamentStatus } from '@/types/tournament'; // Assuming TournamentStatus is exported from types

const TEAL_COLOR_HEX = "#2DD4BF"; // You can use this for direct color props on icons if needed

const formatTournamentStatusForDisplay = (
    status: FetchedTournament['status'] | undefined, // Allow undefined for safety
    registrationDeadline?: string | null,
    startTime?: string | null // Optional: for more nuanced status like "Upcoming"
): string => {
    if (status === undefined || status === null) return 'Status Unknown';

    switch (status) {
        case 'REGISTRATION':
            if (registrationDeadline) {
                try {
                    const deadline = new Date(registrationDeadline);
                    if (deadline > new Date()) return 'Registrations Open';
                    return 'Registration Closed';
                } catch (e) { return 'Registrations Open (check deadline)';}
            }
            return 'Registrations Open';
        case 'IN_PROGRESS':
            return 'In Progress';
        case 'COMPLETED':
            return 'Completed';
        case 'DRAFT':
            return 'Draft';
        case 'CANCELLED':
            return 'Cancelled';
        default:
            // Fallback for any other string status values that might not be in your enum
            // but could come from a less strict backend or future additions
            return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
};

// REFINED Helper to format prize pool for display
const formatPrize = (prizePoolInput: any): string => {
    // console.log('[formatPrize] Input:', prizePoolInput, '| Type:', typeof prizePoolInput);

    if (prizePoolInput === null || prizePoolInput === undefined) {
        // console.log('[formatPrize] -> N/A (null or undefined)');
        return 'N/A';
    }

    let prizeData = prizePoolInput;

    // If the input is a string, it could be simple text, JSON representation of text, or JSON object.
    if (typeof prizeData === 'string') {
        if (prizeData.toLowerCase() === 'null') {
            // console.log('[formatPrize] -> N/A (string "null")');
            return 'N/A';
        }
        if (prizeData.trim() === '') {
            // console.log('[formatPrize] -> N/A (empty string)');
            return 'N/A';
        }
        try {
            const parsed = JSON.parse(prizeData);
            // Successfully parsed - now prizeData is what the JSON represented.
            // It could be an object, a string (e.g., JSON.parse('"Simple Text"')), a number, etc.
            prizeData = parsed;
            // console.log('[formatPrize] Parsed string to:', prizeData, typeof prizeData);
        } catch (e) {
            // Parsing failed: means prizeData is a simple string like "Bragging Rights" or "$100 Cash".
            // console.log('[formatPrize] -> Not JSON, returning original string:', prizeData);
            return prizeData; // Return the original string as is.
        }
    }

    // At this point, prizeData is either the originally parsed object,
    // or what the string was parsed into (which could be another string, number, or object).
    if (typeof prizeData === 'object' && prizeData !== null) {
        if (prizeData.currency && prizeData.amount !== undefined && prizeData.amount !== null) {
            const result = `${prizeData.currency} ${Number(prizeData.amount).toLocaleString()}`;
            // console.log('[formatPrize] -> Object with currency/amount:', result);
            return result;
        }
        if (prizeData.details && typeof prizeData.details === 'string') {
            // console.log('[formatPrize] -> Object with details:', prizeData.details);
            return prizeData.details;
        }
        // Handle cases like: {"1st Prize": "1000 USD", "2nd Prize": "500 USD"}
        const entries = Object.entries(prizeData);
        if (entries.length > 0) {
            // Just show the first entry for brevity on the dashboard, or join them.
            // For dashboard, maybe just "Prizes Available" or first one.
            const firstPrize = entries[0];
            if (firstPrize && typeof firstPrize[1] === 'string') {
                 const result = `${firstPrize[0]}: ${firstPrize[1]}`;
                 // console.log('[formatPrize] -> First entry of object:', result);
                 return result;
            }
            // Fallback if object structure is not as expected for prize details
            // console.log('[formatPrize] -> Complex object, returning "Multiple Prizes"');
            return 'Multiple Prizes';
        }

        // console.log('[formatPrize] -> Object, but no recognized prize structure, returning "View Details"');
        return 'View Details'; // If it's an object but doesn't match known prize structures.
    }

    // If prizeData is now a simple string (from JSON.parse('"text"')) or a number.
    if (prizeData !== null && prizeData !== undefined) {
        const result = String(prizeData);
        // console.log('[formatPrize] -> Fallback to String():', result);
        return result;
    }
    
    // console.log('[formatPrize] -> Fallback to N/A (end of function)');
    return 'N/A';
};


const formatDateForActivity = (isoString: string): string => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch (e) { return 'Invalid Date'; }
};

export default function Dashboard() {
  const router = useRouter();
  const { token, user: authUser } = useAuth();
  
  const dashboardUser = {
    username: authUser?.username || "Player",
    avatar: authUser?.profile_picture_url || "/avatar.png", // Make sure User type in AuthContext has profile_picture_url
    rank: authUser?.rank || "Unranked",       // Make sure User type in AuthContext has rank
    level: authUser?.level || 1,              // Make sure User type in AuthContext has level
    stats: { 
        winRate: "N/A", totalGames: 0, tournaments: 0, currentRank: 0 // These remain placeholders
    }
  };

  const [activeTournaments, setActiveTournaments] = useState<FetchedTournament[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const [recentActivities, setRecentActivities] = useState<FetchedActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      const fetchDashboardData = async () => {
        // Fetch Active Tournaments
        setIsLoadingTournaments(true);
        setTournamentsError(null);
        try {
          const tourneyResponse = await tournamentApi.getActiveTournaments(token, 1, 3);
          // console.log('Dashboard: Raw Active Tournaments Response:', JSON.stringify(tourneyResponse, null, 2));
          if (tourneyResponse.tournaments) {
             setActiveTournaments(tourneyResponse.tournaments);
             tourneyResponse.tournaments.forEach(t => {
                console.log(`Dashboard Tournament [${t.name}]: currentParticipants=${t.currentParticipants}, prizePool=${JSON.stringify(t.prizePool)}, status=${t.status}`);
             });
          } else {
            setActiveTournaments([]); // Ensure it's an array if backend sends null/undefined
          }
        } catch (err: any) {
          console.error("Dashboard: Failed to fetch active tournaments:", err);
          setTournamentsError(err.message || "Could not load active tournaments.");
        } finally {
          setIsLoadingTournaments(false);
        }

        // Fetch Recent Activities
        setIsLoadingActivities(true);
        setActivitiesError(null);
        try {
          const activityResponse = await tournamentApi.getRecentActivities(token, 1, 4);
          // console.log('Dashboard: Raw Recent Activities Response:', JSON.stringify(activityResponse, null, 2));
          if (activityResponse.activities) {
            setRecentActivities(activityResponse.activities);
          } else {
            setRecentActivities([]); // Ensure it's an array
            console.warn("Dashboard: Recent activities response did not contain an 'activities' array.");
          }
        } catch (err: any) {
          console.error("Dashboard: Failed to fetch recent activities:", err);
          setActivitiesError(err.message || "Could not load recent activities.");
        } finally {
          setIsLoadingActivities(false);
        }
      };

      fetchDashboardData();
    } else {
      setIsLoadingTournaments(false);
      setIsLoadingActivities(false);
    }
  }, [token]);

  const getActivityDotColor = (activityType: string | undefined): string => {
    const upperType = activityType?.toUpperCase() || "";
    if (upperType.includes('WIN') || upperType.includes('WON')) return 'bg-green-400';
    if (upperType.includes('JOIN') || upperType.includes('CREATE')) return 'bg-teal-400';
    if (upperType.includes('BADGE') || upperType.includes('ACHIEVEMENT')) return 'bg-yellow-400';
    if (upperType.includes('POST') || upperType.includes('CHAT')) return 'bg-blue-400';
    return 'bg-gray-500';
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-gray-100 py-8 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Section */}
          <div className="mb-10 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10 flex flex-col md:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 rounded-full border-4 border-teal-400 shadow-lg shadow-teal-400/40 overflow-hidden">
                <Image src={dashboardUser.avatar} alt="User Avatar" width={96} height={96} className="object-cover w-full h-full" priority />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                LVL {dashboardUser.level}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-1">Welcome back, <span className="text-teal-400">{dashboardUser.username}</span>!</h1>
              <p className="text-gray-400 text-lg">Current Rank: <span className="text-teal-400 font-semibold">{dashboardUser.rank}</span></p>
            </div>
          </div>

          {/* Stats Grid - placeholders for now */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { icon: FaTrophy, label: "Win Rate", value: dashboardUser.stats.winRate },
              { icon: FaGamepad, label: "Total Games", value: dashboardUser.stats.totalGames },
              { icon: FaUsers, label: "Tournaments Played", value: dashboardUser.stats.tournaments },
              { icon: FaMedal, label: "Global Rank", value: dashboardUser.stats.currentRank > 0 ? `#${dashboardUser.stats.currentRank}` : 'N/A' },
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Tournaments */}
            <div className="lg:col-span-2 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaTrophy className="text-teal-400" size={24} /> Active Tournaments
                </h2>
                <Link href="/tournaments?status=ACTIVE" className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </Link>
              </div>
              <div className="space-y-4">
                {isLoadingTournaments && <div className="text-center py-4 text-gray-400">Loading tournaments...</div>}
                {tournamentsError && <div className="text-center py-4 text-red-400">Error: {tournamentsError}</div>}
                {!isLoadingTournaments && !tournamentsError && activeTournaments.length === 0 && <div className="text-center py-4 text-gray-500">No active tournaments found.</div>}
                {!isLoadingTournaments && !tournamentsError && activeTournaments.map((tournament) => (
                  <Link href={`/tournaments/${tournament.id}`} key={tournament.id} className="block bg-gray-950 rounded-lg p-4 border border-gray-800 hover:border-teal-500/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{tournament.name}</h3>
                      <span className="text-sm font-bold text-teal-400">{formatPrize(tournament.prizePool)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      {/* Ensure currentParticipants is treated as a number */}
                      <span>{Number(tournament.currentParticipants) || 0} Participants</span>
                      <span className={`font-medium ${tournament.status === 'REGISTRATION' || tournament.status === 'IN_PROGRESS' ? 'text-green-400' : 'text-yellow-400'}`}>
                        {formatTournamentStatusForDisplay(tournament.status, tournament.registrationDeadline)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaUsers className="text-teal-400" size={24} /> Recent Activity
                </h2>
                <button onClick={() => router.push('/profile/activity')} // Or your desired activity page
                  className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                 {isLoadingActivities && <div className="text-center py-4 text-gray-400">Loading activities...</div>}
                 {activitiesError && <div className="text-center py-4 text-red-400">Error fetching activities: {activitiesError}</div>}
                 {!isLoadingActivities && !activitiesError && recentActivities.length === 0 && <div className="text-center py-4 text-gray-500">No recent activity.</div>}
                 {!isLoadingActivities && !activitiesError && recentActivities.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 bg-gray-950 p-3 rounded-lg border border-gray-800">
                    <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${getActivityDotColor(item.type)}`} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{item.detail}</p>
                      <p className="text-xs text-gray-500">{formatDateForActivity(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/tournaments" passHref legacyBehavior><a className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg shadow-teal-500/30 hover:shadow-teal-600/40 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75">Find a Tournament</a></Link> 
            <Link href="/tournaments/create" passHref legacyBehavior><a className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 text-center inline-block">Create New Tournament</a></Link>
            <button onClick={() => router.push('/leaderboards')} className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75">View Leaderboards</button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}