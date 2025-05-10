'use client'; // Keep if client-side interactions or hooks like useState/useEffect are needed later

import React from 'react';
import Link from 'next/link';
import { FaGamepad, FaUsers, FaComments, FaTrophy, FaShieldAlt, FaChartLine } from 'react-icons/fa';

// Helper component for feature cards (optional, could be inline)
const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all duration-300 transform hover:-translate-y-1 flex flex-col items-center text-center">
    <div className="text-indigo-400 mb-4">{icon}</div>
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 text-sm">{description}</p>
  </div>
);

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      {/* Hero Section */}
      <section 
        className="relative py-20 md:py-32 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/hero-background.jpg')" }} // Placeholder - replace with actual image or use a gradient
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm"></div> {/* Overlay for readability */}
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-6">
            Welcome to <span className="text-indigo-400">Gamer World</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-8">
            Your ultimate hub for competitive gaming, community, and esports excellence.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/dashboard" // Or /signup if you prefer direct signup
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg shadow-indigo-600/30 hover:shadow-indigo-500/40 transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 text-lg"
            >
              Join the Arena
            </Link>
            <Link
              href="#features" // Link to features section
              className="bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-75 text-lg"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Key Features Section */}
      <section id="features" className="py-16 md:py-24 bg-gray-800/30">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white">The Ultimate Esports Hub</h2>
            <p className="text-gray-400 mt-2 text-md md:text-lg">Everything you need to connect, compete, and conquer.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<FaTrophy size={40}/>}
              title="Compete & Conquer"
              description="Join tournaments, track your ELO/Glicko rating, and climb comprehensive leaderboards."
            />
            <FeatureCard 
              icon={<FaUsers size={40}/>}
              title="Connect & Socialize"
              description="Rich player profiles, clans/crews, advanced friend system, and interactive forums."
            />
            <FeatureCard 
              icon={<FaComments size={40}/>} 
              title="Strategize & Share"
              description="Squad builders, custom tactics sharing hub, FIFA/FC news, and clip sharing contests."
            /> 
            <FeatureCard 
              icon={<FaGamepad size={40}/>}
              title="Personalized Dashboard"
              description="Your central command for stats, active tournaments, and recent activity at a glance."
            />
            <FeatureCard 
              icon={<FaShieldAlt size={40}/>}
              title="Intuitive Experience"
              description="A sleek, modern interface designed by gamers, for gamers. Easy to navigate and use."
            />
            <FeatureCard 
              icon={<FaChartLine size={40}/>}
              title="Progress & Achievements"
              description="Earn badges, complete challenges, and watch your skills grow with our achievement system."
            />
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="py-16 md:py-24 bg-gray-900">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Elevate Your Game?
          </h2>
          <p className="text-gray-400 mb-8 text-md md:text-lg">
            Join Gamer World today and become part of the premier online destination for esports enthusiasts. Create your profile, find your crew, and start your journey to the top.
          </p>
          <Link
            href="/dashboard" // Or /signup
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-10 rounded-lg shadow-xl hover:shadow-indigo-500/50 transition-all duration-300 transform hover:scale-105 text-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75"
          >
            Get Started Now
          </Link>
        </div>
      </section>

      {/* Footer (Simplified) */}
      <footer className="py-8 border-t border-gray-700/50 bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Gamer World. All rights reserved. The ultimate destination for esports.
          </p>
        </div>
      </footer>
    </div>
  );
}
