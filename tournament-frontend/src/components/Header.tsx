// src/components/Header.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation'; // Use next/navigation
import { useAuth } from '@/contexts/AuthContext';
import { FaGamepad, FaSignOutAlt, FaUserCircle, FaBars, FaTimes, FaTrophy, FaChartBar, FaUsers } from 'react-icons/fa'; // Added more icons

export default function Header() {
  const { user, token, logout } = useAuth(); // Get user object as well
  const currentPathname = usePathname() || '';
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isDashboardPage = currentPathname === '/dashboard';
  const isTournamentDetailPage = currentPathname.startsWith('/tournaments/') && currentPathname.split('/').length === 3; // e.g. /tournaments/some-id
  const isLoginPage = currentPathname === '/login';
  const isSignupPage = currentPathname === '/signup';
  const isAuthPage = isLoginPage || isSignupPage;


  const navLinks = [
    { name: 'Tournaments', href: '/tournaments', icon: <FaTrophy className="mr-1.5" /> },
    { name: 'Leaderboards', href: '/leaderboards', icon: <FaChartBar className="mr-1.5" /> },
    { name: 'Community', href: '/community', icon: <FaUsers className="mr-1.5" /> }, // Example link
  ];

  const handleLogout = () => {
    logout();
    router.push('/'); // Redirect to home after logout
  };
  
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <nav className="bg-gradient-to-r from-slate-900 via-black to-slate-900 text-gray-200 shadow-lg sticky top-0 z-50 border-b border-teal-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center group">
              <FaGamepad className="h-8 w-8 text-teal-400 group-hover:text-teal-300 transition-colors duration-300 transform group-hover:rotate-[-12deg]" />
              <span className="ml-2 text-xl font-bold tracking-tighter text-white group-hover:text-teal-400 transition-colors">
                Gamer<span className="text-teal-400 group-hover:text-white transition-colors">World</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links (center) */}
          {!isAuthPage && (
             <div className="hidden md:flex md:items-center md:space-x-2 lg:space-x-4 absolute left-1/2 transform -translate-x-1/2">
                {navLinks.map((item) => (
                <Link
                    key={item.name}
                    href={item.href}
                    className={`px-3 py-2 rounded-md text-sm font-medium flex items-center
                                ${currentPathname.startsWith(item.href) && item.href !== '/' || (item.href === '/' && currentPathname === '/')
                                ? 'bg-teal-500/20 text-teal-300'
                                : 'text-gray-400 hover:bg-gray-800/60 hover:text-teal-400 transition-all duration-200'}`}
                >
                    {item.icon} {item.name}
                </Link>
                ))}
          </div>
          )}


          {/* Right side: Auth buttons / User Avatar + Dashboard/Logout */}
          <div className="flex items-center">
            {token && user ? (
              <div className="flex items-center space-x-3">
                {!isDashboardPage && !isTournamentDetailPage && ( // Show Dashboard link if not on Dashboard or Tournament Detail
                    <Link
                        href="/dashboard"
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-md hover:shadow-teal-500/40"
                    >
                       Dashboard
                    </Link>
                )}
                 {isTournamentDetailPage && ( // Show Dashboard link specifically on tournament detail page
                    <Link
                        href="/dashboard"
                        className="hidden md:inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-teal-300 transition-colors"
                    >
                       <FaUserCircle className="mr-1.5 h-4 w-4"/> My Dashboard
                    </Link>
                )}
                {isDashboardPage && ( // Only show Logout on Dashboard
                  <button
                    onClick={handleLogout}
                    className="flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-red-600/80 hover:bg-red-500 text-white transition-colors shadow-md"
                  >
                    <FaSignOutAlt className="mr-1.5 h-3.5 w-3.5" /> Logout
                  </button>
                )}
                <Link href="/dashboard" className="flex items-center group"> {/* User Avatar always links to dashboard */}
                  <span className="text-xs text-gray-300 mr-2 hidden sm:inline group-hover:text-teal-300 transition-colors">{user.username}</span>
                  <img 
                    className="h-8 w-8 rounded-full border-2 border-teal-500/70 group-hover:border-teal-400 transition-all" 
                    src={user.profile_picture_url || `https://ui-avatars.com/api/?name=${user.username}&background=0D8ABC&color=fff&bold=true`} 
                    alt="User" />
                </Link>
              </div>
            ) : (
              !isAuthPage && ( // Don't show Login/Signup buttons if on login/signup page
                <div className="space-x-2">
                    <Link
                        href="/login"
                        className="px-3 py-1.5 rounded-md text-xs font-semibold text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                        Sign In
                    </Link>
                    <Link
                        href="#signup-section" // Link to homepage signup section
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-teal-500 hover:bg-teal-400 text-black shadow transition-colors"
                    >
                        Sign Up Free
                    </Link>
                </div>
              )
            )}
             {/* Mobile Menu Button */}
             {!isAuthPage && (
                 <div className="ml-2 md:hidden">
                    <button
                        onClick={toggleMobileMenu}
                        className="p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                        aria-expanded={isMobileMenuOpen}
                    >
                        <span className="sr-only">Open main menu</span>
                        {isMobileMenuOpen ? <FaTimes className="h-5 w-5" /> : <FaBars className="h-5 w-5" />}
                    </button>
                </div>
             )}
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && !isAuthPage && (
        <div className="md:hidden absolute right-0 left-0 bg-slate-800/95 backdrop-blur-sm shadow-lg pb-3 z-40 border-b border-teal-500/20">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium flex items-center
                            ${currentPathname.startsWith(item.href) && item.href !== '/' || (item.href === '/' && currentPathname === '/')
                              ? 'bg-teal-600/30 text-teal-300'
                              : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
              >
                {item.icon} {item.name}
              </Link>
            ))}
            {/* Dashboard link in mobile menu if logged in */}
            {token && user && (
                 <Link
                    href="/dashboard"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block px-3 py-2 rounded-md text-base font-medium flex items-center
                                ${currentPathname === '/dashboard'
                                ? 'bg-teal-600/30 text-teal-300'
                                : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                >
                   <FaUserCircle className="mr-2 h-5 w-5" /> My Dashboard
                </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}