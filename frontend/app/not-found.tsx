import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-2xl font-bold text-white">LUMINA</h1>
        </Link>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 backdrop-blur-md">
          <h2 className="text-2xl font-bold text-white mb-2">Page not found</h2>
          <p className="text-slate-400 mb-6">The page you're looking for doesn't exist or has moved.</p>
          <Link
            href="/"
            className="inline-block px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
