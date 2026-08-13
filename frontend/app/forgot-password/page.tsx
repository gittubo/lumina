'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { forgotPasswordRequest, getApiErrorMessage } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await forgotPasswordRequest(email);
      // Always show success, regardless of whether the email is registered —
      // matches the backend's response, so this page can't be used to
      // enumerate accounts either.
      setSubmitted(true);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <h1 className="text-2xl font-bold text-white">LUMINA</h1>
        </Link>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8 backdrop-blur-md">
          {submitted ? (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Check your email</h2>
              <p className="text-slate-400">
                If an account exists for <span className="text-slate-300">{email}</span>, we&apos;ve sent a
                link to reset your password. It&apos;s valid for 1 hour.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-white mb-1">Reset your password</h2>
              <p className="text-slate-400 mb-6">Enter your email and we&apos;ll send you a reset link</p>

              {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
                >
                  {isLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-slate-400">
            <Link href="/login" className="text-purple-400 hover:text-purple-300 font-medium">
              Back to log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
