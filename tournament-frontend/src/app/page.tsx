// src/app/page.tsx (HomePage)
'use client';

import React from 'react';
import Link from 'next/link';
import { FaGamepad, FaUsers, FaComments, FaTrophy, FaShieldAlt, FaChartLine } from 'react-icons/fa';
import SignupForm from '@/components/auth/SignupForm'; // Import the new SignupForm
import { useRouter } from 'next/navigation';


const FeatureCard = ({ icon, title, description, actionText, onActionClick }: { icon: JSX.Element, title: string, description: string, actionText?: string, onActionClick?: () => void }) => (
  <div className="bg-black/40 rounded-xl border border-gray-800/70 overflow-hidden shadow-lg hover:shadow-teal-500/20 transition-all duration-300 group flex flex-col h-full">
    <div className="relative overflow-hidden p-6 flex-grow">
      <div className="absolute top-0 left-0 h-1.5 bg-teal-500 w-full opacity-75 group-hover:w-3/4 transition-all duration-500"></div>
      <div className="text-teal-400 mb-5 group-hover:scale-110 transition-transform duration-300 inline-block">{icon}</div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
    </div>
    {actionText && onActionClick && (
      <div className="px-6 py-4 bg-black/60 border-t border-gray-800/50">
        <button 
          onClick={onActionClick}
          className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
        >
          {actionText} →
        </button>
      </div>
    )}
  </div>
);


export default function HomePage() {
  const router = useRouter(); // For programmatic navigation

  // Data for your feature cards
  const features = [
    { id: 'compete', icon: <FaTrophy size={32}/>, title: "Compete & Conquer", description: "Join diverse tournaments, track your ELO/Glicko-2 ratings, and ascend comprehensive global leaderboards. Prove your skills!" , actionText: "Find Tournaments", onActionClick: () => router.push('/tournaments') },
    { id: 'connect', icon: <FaUsers size={32}/>, title: "Connect & Socialize", description: "Build rich player profiles, form clans/crews, utilize an advanced friend system, and engage in interactive forums.", actionText: "Explore Community", onActionClick: () => router.push('/community')}, // Assuming /community route
    { id: 'share', icon: <FaComments size={32}/>, title: "Strategize & Share", description: "Utilize squad builders, access a custom tactics sharing hub, stay updated with FIFA/FC news, and join clip sharing contests.", actionText: "Discover Tactics", onActionClick: () => router.push('/strategies') }, // Assuming /strategies route
    { id: 'dashboard', icon: <FaGamepad size={32}/>, title: "Personalized Dashboard", description: "Your central command for vital stats, active tournament engagements, and a stream of your recent gaming activity.", actionText: "Go to Dashboard", onActionClick: () => router.push('/dashboard') },
    { id: 'experience', icon: <FaShieldAlt size={32}/>, title: "Intuitive Experience", description: "Navigate a sleek, modern interface designed by gamers, for gamers. Effortless and enjoyable to use across all devices.", actionText: "Learn More", onActionClick: () => router.push('/about-us')}, // Assuming /about-us route
    { id: 'progress', icon: <FaChartLine size={32}/>, title: "Progress & Achievements", description: "Earn exclusive badges, conquer unique challenges, and visually track your skill progression with our robust achievement system.", actionText: "View Achievements", onActionClick: () => router.push('/achievements') }, // Assuming /achievements route
  ];


  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black text-gray-100 font-sans">
      {/* Header/Navigation will be handled by Layout.tsx */}

      {/* Hero Section - Kept similar to your original for consistency */}
      <section className="pt-20 pb-16 md:pt-32 md:pb-24 relative overflow-hidden">
         <div className="absolute inset-0 bg-black opacity-50 z-0"></div>
         {/* Optional: Add subtle background elements like faint grid lines or particles */}
         <div className="absolute inset-0 pattern-bg opacity-5_"></div> {/* Custom class for pattern */}

        <div className="max-w-5xl mx-auto px-4 text-center relative z-10">
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extrabold text-white mb-6 !leading-tight tracking-tighter">
            Enter <span className="text-teal-400 bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-500">Gamer World</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
            Your ultimate arena for competitive gaming, vibrant community, and esports excellence.
            Forge your legacy.
          </p>
          <div className="flex justify-center gap-4">
            <Link 
              href="#signup-section" // Link to the section containing signup
              className="bg-teal-500 hover:bg-teal-400 text-black font-semibold py-3 px-8 rounded-lg shadow-lg shadow-teal-500/30 hover:shadow-teal-400/30 transition-all duration-300 transform hover:scale-105 text-base"
            >
              Join Now
            </Link>
            <Link 
              href="/tournaments"
              className="bg-gray-700/70 hover:bg-gray-600/90 text-white font-semibold py-3 px-8 rounded-lg border border-gray-600 hover:border-gray-500 shadow-lg transition-all duration-300 transform hover:scale-105 text-base"
            >
              Explore Tournaments
            </Link>
          </div>
        </div>
      </section>

      {/* Combined Features and Signup Section */}
      <section id="signup-section" className="py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-10 md:gap-16 items-start">
            {/* Left Side: Feature Cards */}
            <div className="lg:pr-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
                The Ultimate Esports Hub
              </h2>
              <p className="text-gray-400 mb-10 text-lg">
                Discover a platform built for every gamer. Here’s what makes Gamer World unique:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {features.slice(0, 4).map((feature) => ( // Show first 4 features prominently here
                  <FeatureCard
                    key={feature.id}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    actionText={feature.actionText}
                    onActionClick={feature.onActionClick}
                  />
                ))}
              </div>
            </div>

            {/* Right Side: Signup Form */}
            <div>
              <SignupForm 
                showTitle={true} // Show title within the form component
                onSignupSuccess={() => {
                  // Potentially show a success message or redirect
                  // For now, AuthContext handles redirection or you can push from here
                  router.push('/dashboard?signedup=true'); 
                }}
              />
            </div>
          </div>

           {/* Additional Features Below (Optional) */}
           {features.length > 4 && (
             <div className="mt-16">
                <h3 className="text-2xl font-semibold text-center text-white mb-10">And Even More...</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {features.slice(4).map(feature => (
                         <FeatureCard
                            key={feature.id}
                            icon={feature.icon}
                            title={feature.title}
                            description={feature.description}
                            actionText={feature.actionText}
                            onActionClick={feature.onActionClick}
                        />
                    ))}
                </div>
             </div>
           )}

        </div>
      </section>
      
      {/* Call to Action - can be kept or modified */}
      <section className="py-20 bg-black/20 mt-10">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <div className="p-10 md:p-14 bg-gray-950/50 rounded-xl border border-teal-500/20 shadow-2xl shadow-teal-500/5">
            <div className="text-teal-400 mb-2 text-sm font-medium tracking-wider">[ ELEVATE YOUR GAME ]</div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-5">
              Ready to Dominate?
            </h2>
            <p className="text-gray-300 mb-8 text-md md:text-lg">
              Join Gamer World now. Create your profile, find your crew, and conquer the leaderboards.
            </p>
            <Link
              href="#signup-section"
              className="bg-teal-500 hover:bg-teal-400 text-black font-semibold px-8 py-3 inline-block rounded-lg text-base shadow-lg shadow-teal-500/30 hover:shadow-teal-400/30 transition-all transform hover:scale-105"
            >
              Get Started Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (remains the same as your original) */}
      <footer className="py-12 border-t border-gray-800 mt-12">
        {/* ... your footer code ... */}
         <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            <div className="md:col-span-2"> {/* Made logo section wider */}
              <Link href="/" className="text-white font-bold text-lg flex items-center mb-4">
                <span className="text-teal-400 mr-1.5 text-2xl"><FaGamepad /></span> Gamer World
              </Link>
              <p className="text-sm text-gray-500 mb-4 pr-4">
                © {new Date().getFullYear()} Gamer World. All rights reserved. <br /> The ultimate destination for esports enthusiasts.
              </p>
              
              <div className="flex space-x-4">
                {/* Social Icons - Add actual links */}
                <a href="#" aria-label="Twitter" className="text-gray-400 hover:text-teal-400 transition-colors"><FaUsers size={18}/></a>
                <a href="#" aria-label="Instagram" className="text-gray-400 hover:text-teal-400 transition-colors"><FaTrophy size={18}/></a>
                <a href="#" aria-label="LinkedIn" className="text-gray-400 hover:text-teal-400 transition-colors"><FaComments size={18}/></a>
              </div>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Platform</h3>
              <ul className="space-y-2">
                <li><Link href="/tournaments" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Tournaments</Link></li>
                <li><Link href="/leaderboards" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Leaderboards</Link></li>
                <li><Link href="/community" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Community</Link></li>
                <li><Link href="/features" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Features</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Resources</h3>
              <ul className="space-y-2">
                <li><Link href="/help" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Help Center</Link></li>
                <li><Link href="/faq" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">FAQ</Link></li>
                <li><Link href="/blog" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Blog</Link></li>
                <li><Link href="/support" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Support</Link></li>
              </ul>
            </div>
            
            <div className="md:col-span-1">
              <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Legal</h3>
              <ul className="space-y-2">
                <li><Link href="/terms" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Terms of Service</Link></li>
                <li><Link href="/privacy" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/contact" className="text-xs text-gray-400 hover:text-teal-300 transition-colors">Contact Us</Link></li>
              </ul>
            </div>
          </div>
           <div className="mt-10 pt-8 border-t border-gray-800 text-center text-xs text-gray-500">
             Gamer World - Fueling Competition, Fostering Community.
           </div>
        </div>
      </footer>
       {/* Add a subtle pattern background if you like */}
       <style jsx global>{`
         .pattern-bg {
           // background-image: radial-gradient(circle, rgba(45, 212, 191, 0.03) 1px, transparent 1px);
           // background-size: 20px 20px;
         }
       `}</style>
    </div>
  );
}