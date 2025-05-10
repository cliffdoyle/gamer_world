'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Header() {
  const { token, logout } = useAuth();
  const currentPathname = usePathname() || '';

  // Updated navigation links
  const navigation = [
    { name: 'Home', href: '/' },
    // { name: 'Tournaments', href: '/tournaments' }, // Removed
    // { name: 'Bracket Test', href: '/bracket-test' }, // Removed
  ];

  const isActive = (path: string) => {
    // Special case for home, exact match
    if (path === '/') return currentPathname === '/';
    // For other paths, check if the current path starts with the link's path
    return currentPathname.startsWith(path);
  };

  return (
    <nav className="bg-gray-800 shadow-md"> {/* Dark background, subtle shadow */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl text-indigo-400 hover:text-indigo-300 transition-colors">
                Tournament Manager
              </span>
            </Link>
            <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-gray-400 hover:border-indigo-500/70 hover:text-gray-200'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {token ? (
              <button
                onClick={logout}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors"
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
          
          {/* Mobile menu button and items */}
          <div className="-mr-2 flex items-center sm:hidden">
            {/* This example doesn't include a functional mobile menu button/dropdown for brevity, 
                but you would typically have a button here to toggle the mobile menu visibility. 
                The mobile menu items are styled below assuming they are made visible by such a button.*/}
            {token ? (
                <button
                  onClick={logout}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-offset-gray-800 transition-colors"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-offset-gray-800 transition-colors"
                >
                  Login
                </Link>
              )}
          </div>
        </div>
      </div>

      {/* Mobile menu, show/hide based on menu state (not implemented here) */}
      {/* For demonstration, assuming 'navigation' is not empty, otherwise this block might not be needed if only 'Home' remains and is handled by logo link */} 
      {navigation.length > 0 && (
        <div className="sm:hidden border-t border-gray-700">
          <div className="pt-2 pb-3 space-y-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors ${
                  isActive(item.href)
                    ? 'bg-indigo-900/30 border-indigo-500 text-indigo-300'
                    : 'border-transparent text-gray-400 hover:bg-gray-700 hover:border-gray-600 hover:text-gray-200'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
} 