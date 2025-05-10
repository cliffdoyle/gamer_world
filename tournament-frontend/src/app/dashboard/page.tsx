'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { FaTrophy, FaGamepad, FaUsers, FaMedal } from 'react-icons/fa';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export default function Dashboard() {
  // Placeholder user data
  const user = {
    username: "ProGamer123",
    rank: "Diamond Elite",
    level: 42,
    avatar: "/avatar.png",
    stats: {
      winRate: "68%",
      totalGames: 156,
      tournaments: 12,
      currentRank: 124
    }
  };

  // Placeholder activity data
  const activity = [
    { type: 'Win', detail: 'Won match in Winter Cup', date: '2025-05-09' },
    { type: 'Join', detail: 'Joined Spring Showdown', date: '2025-05-08' },
    { type: 'Chat', detail: 'Chatted in Autumn Arena', date: '2025-04-30' }
  ];

  // Placeholder active tournaments
  const activeTournaments = [
    {
      name: "Summer Championship",
      prize: "$1,000",
      participants: 64,
      status: "Round of 16"
    },
    {
      name: "Weekly Blitz",
      prize: "$250",
      participants: 32,
      status: "Quarter Finals"
    }
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 text-gray-100 py-8 font-sans">
        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Section */}
          <div className="mb-8 bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 flex flex-col md:flex-row items-center gap-6">
            {/* Avatar Container */}
            <div className="relative flex-shrink-0">
              <div className="relative w-24 h-24 rounded-full border-4 border-indigo-500 shadow-lg shadow-indigo-500/50 overflow-hidden">
                <Image
                  src={user.avatar}
                  alt="Avatar"
                  width={96}
                  height={96}
                  className="object-cover w-full h-full"
                  priority
                />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                LVL {user.level}
              </div>
            </div>
            
            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-3xl font-bold text-white mb-2">
                Welcome back, <span className="text-indigo-400">{user.username}</span>
              </h1>
              <p className="text-gray-400 text-lg">Rank: <span className="text-indigo-400 font-semibold">{user.rank}</span></p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {/* Stat Card 1: Win Rate */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg flex items-center gap-4 hover:border-indigo-500/50 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center text-green-400 flex-shrink-0">
                <FaTrophy size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Win Rate</p>
                <p className="text-2xl font-bold text-white">{user.stats.winRate}</p>
              </div>
            </div>
            {/* Stat Card 2: Total Games */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg flex items-center gap-4 hover:border-indigo-500/50 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">
                <FaGamepad size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Games</p>
                <p className="text-2xl font-bold text-white">{user.stats.totalGames}</p>
              </div>
            </div>
            {/* Stat Card 3: Tournaments */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg flex items-center gap-4 hover:border-indigo-500/50 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 flex-shrink-0">
                <FaTrophy size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Tournaments</p>
                <p className="text-2xl font-bold text-white">{user.stats.tournaments}</p>
              </div>
            </div>
            {/* Stat Card 4: Current Rank */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700/50 shadow-lg flex items-center gap-4 hover:border-indigo-500/50 hover:shadow-indigo-500/20 transition-all duration-300 transform hover:-translate-y-1">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 flex-shrink-0">
                <FaMedal size={28} />
              </div>
              <div>
                <p className="text-sm text-gray-400">Current Rank</p>
                <p className="text-2xl font-bold text-white">#{user.stats.currentRank}</p>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Active Tournaments - Spans 2 columns on lg screens */}
            <div className="lg:col-span-2 bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <FaTrophy color="#818cf8" size={24} />
                  Active Tournaments
                </h2>
                <button className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {activeTournaments.map((tournament, index) => (
                  <div key={index} className="bg-gray-700/50 rounded-xl p-4 hover:bg-gray-700/80 transition-colors cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-white">{tournament.name}</h3>
                      <span className="text-green-400 font-bold">{tournament.prize}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>{tournament.participants} Participants</span>
                      <span>{tournament.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed - Spans 1 column on lg screens */}
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <FaUsers color="#818cf8" size={24} />
                  Recent Activity
                </h2>
                <button className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                  View All
                </button>
              </div>
              <div className="space-y-4">
                {activity.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 bg-gray-700/50 rounded-xl p-4">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      item.type === 'Win' ? 'bg-green-400' :
                      item.type === 'Join' ? 'bg-indigo-400' :
                      'bg-gray-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-white text-sm">{item.detail}</p>
                      <p className="text-xs text-gray-400">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
            <button className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75">
              Join Tournament
            </button>
            <button className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75">
              Create Tournament
            </button>
            <button className="w-full sm:w-auto bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75">
              View Leaderboard
            </button>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
} 