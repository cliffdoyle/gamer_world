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
import { TournamentResponse as FetchedTournament, UserActivity as FetchedActivity } from '@/types/tournament';

// === HELPER FUNCTIONS (Restored from your original code) ===

const formatTournamentStatusForDisplay = (
    status: FetchedTournament['status'] | undefined,
    registrationDeadline?: string | null,
    // startTime?: string | null // Optional: for more nuanced status like "Upcoming"
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
            return String(status).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
    }
};

const formatPrize = (prizePoolInput: any): string => {
    if (prizePoolInput === null || prizePoolInput === undefined) {
        return 'N/A';
    }
    let prizeData = prizePoolInput;
    if (typeof prizeData === 'string') {
        if (prizeData.toLowerCase() === 'null' || prizeData.trim() === '') {
            return 'N/A';
        }
        try {
            prizeData = JSON.parse(prizeData);
        } catch (e) {
            return prizeData; // Is a simple string
        }
    }
    if (typeof prizeData === 'object' && prizeData !== null) {
        if (prizeData.currency && prizeData.amount !== undefined && prizeData.amount !== null) {
            return `${prizeData.currency} ${Number(prizeData.amount).toLocaleString()}`;
        }
        if (prizeData.details && typeof prizeData.details === 'string') {
            return prizeData.details;
        }
        const entries = Object.entries(prizeData);
        if (entries.length > 0) {
            const firstPrize = entries[0];
            if (firstPrize && typeof firstPrize[1] === 'string') {
                 return `${firstPrize[0]}: ${firstPrize[1]}`;
            }
            return 'Multiple Prizes';
        }
        return 'View Details';
    }
    if (prizeData !== null && prizeData !== undefined) {
        return String(prizeData);
    }
    return 'N/A';
};

const formatDateForActivity = (isoString: string | undefined): string => {
    if (!isoString) return 'N/A';
    try {
        return new Date(isoString).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    } catch (e) { return 'Invalid Date'; }
};

const getActivityDotColor = (activityType: string | undefined): string => {
    const upperType = activityType?.toUpperCase() || "";
    if (upperType.includes('WIN') || upperType.includes('WON')) return 'bg-green-400';
    if (upperType.includes('JOIN') || upperType.includes('CREATE')) return 'bg-teal-400';
    if (upperType.includes('BADGE') || upperType.includes('ACHIEVEMENT')) return 'bg-yellow-400';
    if (upperType.includes('POST') || upperType.includes('CHAT')) return 'bg-blue-400';
    return 'bg-gray-500';
};

// === END OF HELPER FUNCTIONS ===


export default function Dashboard() {
  const router = useRouter();
  const { token, user: authUser } = useAuth(); // authUser now contains enriched stats

  const [activeTournaments, setActiveTournaments] = useState<FetchedTournament[]>([]);
  const [isLoadingTournaments, setIsLoadingTournaments] = useState(true);
  const [tournamentsError, setTournamentsError] = useState<string | null>(null);

  const [recentActivities, setRecentActivities] = useState<FetchedActivity[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(true);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      const fetchOtherDashboardData = async () => {
        setIsLoadingTournaments(true);
        setTournamentsError(null);
        try {
          const tourneyResponse = await tournamentApi.getActiveTournaments(token, 1, 3);
          setActiveTournaments(tourneyResponse.tournaments || []);
        } catch (err: any) {
          setTournamentsError(err.message || "Could not load active tournaments.");
        } finally {
          setIsLoadingTournaments(false);
        }

        setIsLoadingActivities(true);
        setActivitiesError(null);
        try {
          const activityResponse = await tournamentApi.getRecentActivities(token, 1, 4);
          setRecentActivities(activityResponse.activities || []);
        } catch (err: any) {
          setActivitiesError(err.message || "Could not load recent activities.");
        } finally {
          setIsLoadingActivities(false);
        }
      };
      fetchOtherDashboardData();
    } else {
      setIsLoadingTournaments(false);
      setIsLoadingActivities(false);
    }
  }, [token]);
  
  if (!authUser) {
      return (
          <ProtectedRoute>
              <div className="min-h-screen bg-black flex justify-center items-center">
                  <div className="text-white">Loading user data...</div>
              </div>
          </ProtectedRoute>
      );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-gray-100 py-8 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Section */}
          <div className="mb-10 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10 flex flex-col md:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 rounded-full border-4 border-teal-400 shadow-lg shadow-teal-400/40 overflow-hidden">
                <Image 
                  src={authUser.profile_picture_url || "/avatar.png"} 
                  alt="User Avatar" 
                  width={96} height={96} 
                  className="object-cover w-full h-full" priority 
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                LVL {authUser.level || 1}
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-1">
                Welcome back, <span className="text-teal-400">{authUser.username || "Player"}</span>!
              </h1>
              <p className="text-gray-400 text-lg">
                Current Rank: <span className="text-teal-400 font-semibold">{authUser.rankTitle || "Unranked"}</span>
              </p>
            </div>
          </div>

          {/* Stats Grid - Now uses authUser for stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { icon: FaTrophy, label: "Win Rate", value: authUser.winRate !== undefined && authUser.winRate !== null ? `${(authUser.winRate * 100).toFixed(0)}%` : 'N/A' },
              { icon: FaGamepad, label: "Total Games", value: authUser.totalGamesPlayed !== undefined && authUser.totalGamesPlayed !== null ? authUser.totalGamesPlayed : 'N/A' },
              { icon: FaUsers, label: "Tournaments Played", value: authUser.tournamentsPlayed !== undefined && authUser.tournamentsPlayed !== null ? authUser.tournamentsPlayed : 'N/A' },
              { icon: FaMedal, label: "Global Rank", value: authUser.globalRank && authUser.globalRank > 0 ? `#${authUser.globalRank}` : (authUser.totalGamesPlayed && authUser.totalGamesPlayed > 0 ? 'Unranked' : 'N/A') },
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
                <button onClick={() => router.push('/profile/activity')}
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