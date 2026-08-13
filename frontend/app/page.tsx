'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';

export default function Home() {
  const { token, isHydrated } = useAuthStore();
  const primaryHref = isHydrated && token ? '/dashboard' : '/register';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-slate-700/50 backdrop-blur-md bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <h1 className="text-2xl font-bold text-white">LUMINA</h1>
            </div>
            <Link
              href={primaryHref}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center">
          <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
            The Future of Creative AI
          </h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
            LUMINA combines cutting-edge AI technologies to generate ultra-realistic images, cinematic videos, and immersive 3D environments.
          </p>
          <Link
            href={primaryHref}
            className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-bold text-lg transition-all hover:shadow-lg hover:shadow-purple-500/50"
          >
            Start Creating
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h3 className="text-4xl font-bold text-white mb-12 text-center">Powered By Advanced AI</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: 'Text to Image', icon: '🎨' },
            { title: 'Video Generation', icon: '🎬' },
            { title: '3D Environments', icon: '🌐' },
            { title: 'Voice Synthesis', icon: '🎤' },
          ].map((feature, idx) => (
            <div key={idx} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h4 className="text-xl font-bold text-white">{feature.title}</h4>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <p className="text-center text-slate-400">
            © 2024 LUMINA. All rights reserved. | Where creativity meets artificial intelligence.
          </p>
        </div>
      </footer>
    </div>
  );
}