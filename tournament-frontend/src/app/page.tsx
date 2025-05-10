'use client';

import React from 'react';
import Link from 'next/link';
import { FaGamepad, FaUsers, FaComments, FaTrophy, FaShieldAlt, FaChartLine } from 'react-icons/fa';

const FeatureCard = ({ icon, title, description }) => (
  <div className="bg-black/30 rounded-lg overflow-hidden hover:bg-black/40 transition-all duration-300">
    <div className="p-6">
      <div className="text-teal-400 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
    <div className="px-6 py-3 text-xs text-gray-500">
      {new Date().toLocaleDateString()} - 4 min read
    </div>
  </div>
);

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black text-gray-100 font-sans">
      {/* Header/Navigation */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-white font-bold text-xl flex items-center">
            <span className="text-teal-400 mr-1">G</span>amer World
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/features" className="text-gray-400 hover:text-white text-sm transition-colors">Features</Link>
            <Link href="/capabilities" className="text-gray-400 hover:text-white text-sm transition-colors">Capabilities</Link>
            <Link href="/enterprise" className="text-gray-400 hover:text-white text-sm transition-colors">Enterprise</Link>
            <Link href="/resources" className="text-gray-400 hover:text-white text-sm transition-colors">Resources</Link>
            <Link href="/company" className="text-gray-400 hover:text-white text-sm transition-colors">Company</Link>
          </nav>
          <div>
            <Link 
              href="/dashboard"
              className="bg-teal-500 hover:bg-teal-400 text-black font-medium text-sm px-4 py-2 rounded-sm transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section - Using Windsurf style with original content */}
      <section className="py-20 md:py-32">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Welcome to <span className="text-teal-400">Gamer World</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
            Your ultimate hub for competitive gaming, community, and esports excellence.
          </p>
        </div>
      </section>

      {/* The Ultimate Esports Hub Section - Using interactive cards for future functionality */}
      <section className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">The Ultimate Esports Hub</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaTrophy size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Compete & Conquer</h3>
                  <p className="text-gray-400 text-sm">Join tournaments, track your ELO/Glicko rating, and climb comprehensive leaderboards.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Active Tournaments: 8</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">View All</button>
                </div>
              </div>
            </div>
            
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaUsers size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Connect & Socialize</h3>
                  <p className="text-gray-400 text-sm">Rich player profiles, clans/crews, advanced friend system, and interactive forums.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Online Players: 426</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">Find Players</button>
                </div>
              </div>
            </div>
            
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaComments size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Strategize & Share</h3>
                  <p className="text-gray-400 text-sm">Squad builders, custom tactics sharing hub, FIFA/FC news, and clip sharing contests.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">New Strategies: 12</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">Browse All</button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaGamepad size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Personalized Dashboard</h3>
                  <p className="text-gray-400 text-sm">Your central command for stats, active tournaments, and recent activity at a glance.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Stats Tracked: 24</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">View Dashboard</button>
                </div>
              </div>
            </div>
            
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaShieldAlt size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Intuitive Experience</h3>
                  <p className="text-gray-400 text-sm">A sleek, modern interface designed by gamers, for gamers. Easy to navigate and use.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Interface Options: 16</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">Customize</button>
                </div>
              </div>
            </div>
            
            <div className="bg-black/30 rounded-lg border border-gray-800 overflow-hidden shadow-lg hover:shadow-teal-500/10 transition-all duration-300 cursor-pointer group">
              <div className="relative overflow-hidden">
                <div className="h-2 bg-teal-500 w-full opacity-75"></div>
                <div className="p-6">
                  <div className="text-teal-400 mb-4 group-hover:scale-110 transition-all duration-300"><FaChartLine size={36}/></div>
                  <h3 className="text-xl font-semibold text-white mb-2">Progress & Achievements</h3>
                  <p className="text-gray-400 text-sm">Earn badges, complete challenges, and watch your skills grow with our achievement system.</p>
                </div>
                <div className="px-6 py-3 bg-black/50 flex justify-between items-center">
                  <span className="text-xs text-gray-500">Achievements: 42</span>
                  <button className="text-xs text-teal-400 hover:text-teal-300 font-medium">View All</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action - Styled Like Windsurf CTA with original content */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="p-12 bg-black/30 rounded-lg border border-gray-800">
            <div className="text-teal-400 mb-2 text-sm font-medium">[ let's start ]</div>
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Elevate Your Game?
            </h2>
            <p className="text-gray-400 mb-6 text-md">
              Join Gamer World today and become part of the premier online destination for esports enthusiasts. Create your profile, find your crew, and start your journey to the top.
            </p>
            <Link
              href="/dashboard"
              className="bg-teal-500 hover:bg-teal-400 text-black mt-6 font-medium px-6 py-2 inline-block rounded-sm text-sm"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer - Styled Like Windsurf */}
      <footer className="py-12 border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-1">
              <Link href="/" className="text-white font-bold text-lg flex items-center mb-4">
                <span className="text-teal-400 mr-1">G</span>amer World
              </Link>
              <p className="text-xs text-gray-500 mb-4">
                &copy; {new Date().getFullYear()} Gamer World. All rights reserved. The ultimate destination for esports.
              </p>
              
              <div className="flex space-x-3">
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                </a>
                <a href="#" className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                </a>
              </div>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Gamer World Editor</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Plugins</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Pricing</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Changelog</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Enterprise</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4">Capabilities</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Overview</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Stats</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Teams</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Tournaments</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Leaderboards</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">About Us</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Blog</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Careers</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Contact</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Sponsors</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Docs</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Community</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Help Center</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Support</Link></li>
                <li><Link href="#" className="text-xs text-gray-400 hover:text-white">Events</Link></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}