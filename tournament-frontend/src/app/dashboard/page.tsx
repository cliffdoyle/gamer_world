'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaTrophy, FaGamepad, FaUsers, FaMedal, FaChevronRight } from 'react-icons/fa'; // Added FaChevronRight
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Teal color hex for direct use if needed, e.g., in SVG props
const TEAL_COLOR_HEX = "#2DD4BF"; // Tailwind's teal-400

export default function Dashboard() {
  const router = useRouter();
  
  // Placeholder user data
  const user = {
    username: "ProGamer123",
    rank: "Diamond Elite",
    level: 42,
    avatar: "/avatar.png", // Make sure this avatar exists in your public folder
    stats: {
      winRate: "68%",
      totalGames: 156,
      tournaments: 12,
      currentRank: 124
    }
  };

  // Placeholder activity data
  const activity = [
    { type: 'Win', detail: 'Won match in Winter Cup Finals', date: '2025-05-09' },
    { type: 'Achievement', detail: 'Unlocked "Legendary" Badge', date: '2025-05-09' },
    { type: 'Join', detail: 'Joined Vasha Showdown Tournament', date: '2025-05-08' },
    { type: 'Chat', detail: 'Posted in #general chat', date: '2025-04-30' }
  ];

  // Placeholder active tournaments
  const activeTournaments = [
    {
      name: "Kisumu Championship Series",
      prize: "$5,000",
      participants: 128,
      status: "Registrations Open"
    },
    {
      name: "Weekly Blitz Tournament",
      prize: "$250",
      participants: 32,
      status: "Round 2 Ongoing"
    },
    {
      name: "Kanairo nightly Skirmish",
      prize: "Bragging Rights",
      participants: 16,
      status: "Finals Soon"
    }
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-gray-100 py-8 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Section */}
          <div className="mb-10 bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10 flex flex-col md:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 rounded-full border-4 border-teal-400 shadow-lg shadow-teal-400/40 overflow-hidden">
                <Image
                  src={user.avatar}
                  alt="User Avatar"
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-teal-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                LVL {user.level}
              </div>
            </div>
            
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-1">
                Welcome back, <span className="text-teal-400">{user.username}</span>!
              </h1>
              <p className="text-gray-400 text-lg">Current Rank: <span className="text-teal-400 font-semibold">{user.rank}</span></p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {[
              { icon: FaTrophy, label: "Win Rate", value: user.stats.winRate },
              { icon: FaGamepad, label: "Total Games", value: user.stats.totalGames },
              { icon: FaUsers, label: "Tournaments Played", value: user.stats.tournaments },
              { icon: FaMedal, label: "Global Rank", value: `#${user.stats.currentRank}` },
            ].map((stat, index) => (
              <div key={index} className="bg-gray-950 rounded-xl p-5 border border-teal-500/20 shadow-md hover:border-teal-500/50 hover:shadow-teal-500/20 transition-all duration-300 transform hover:-translate-y-1 flex items-center gap-4">
                <div className="w-12 h-12 bg-teal-500/10 rounded-lg flex items-center justify-center text-teal-400 flex-shrink-0">
                  <stat.icon size={26} />
                </div>
                <div>
                  <p className="text-sm text-gray-400">{stat.label}</p>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
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
                <button className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-4">
                {activeTournaments.map((tournament, index) => (
                  <div key={index} className="bg-gray-950 rounded-lg p-4 border border-gray-800 hover:border-teal-500/40 transition-colors group cursor-pointer">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-white group-hover:text-teal-400 transition-colors">{tournament.name}</h3>
                      <span className="text-sm font-bold text-teal-400">{tournament.prize}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{tournament.participants} Participants</span>
                      <span className={`font-medium ${tournament.status.includes("Open") || tournament.status.includes("Ongoing") ? 'text-green-400' : 'text-yellow-400'}`}>{tournament.status}</span>
                    </div>
                  </div>
                ))}
                {activeTournaments.length === 0 && <p className="text-gray-500 text-center py-4">No active tournaments right now. Check back soon!</p>}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="bg-black border border-teal-500/30 rounded-xl p-6 shadow-lg shadow-teal-500/10">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FaUsers className="text-teal-400" size={24} />
                  Recent Activity
                </h2>
                <button className="text-sm text-teal-400 hover:text-teal-300 font-semibold transition-colors flex items-center gap-1">
                  View All <FaChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                {activity.map((item, index) => (
                  <div key={index} className="flex items-start gap-3 bg-gray-950 p-3 rounded-lg border border-gray-800">
                    <div className={`mt-1 w-3 h-3 rounded-full flex-shrink-0 ${
                      item.type === 'Win' ? 'bg-green-400' :
                      item.type === 'Join' ? 'bg-teal-400' :
                      item.type === 'Achievement' ? 'bg-yellow-400' :
                      'bg-gray-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{item.detail}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                  </div>
                ))}
                 {activity.length === 0 && <p className="text-gray-500 text-center py-4">No recent activity.</p>}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/tournaments">
            <button className="w-full sm:w-auto bg-teal-500 hover:bg-teal-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg shadow-teal-500/30 hover:shadow-teal-600/40 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75">
              Find a Tournament
            </button>
            </a> 
              {/* href="/tournaments/join"
              className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 text-center inline-block" */}
            <a 
              href="/tournaments/create"
              className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 text-center inline-block"
            >
              Create New Tournament
            </a>
            <button className="w-full sm:w-auto bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 hover:border-gray-600 font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75">
              View Leaderboards
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}