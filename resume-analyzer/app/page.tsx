'use client';

import { useState } from 'react';
import AnalyzerForm, { type AnalyzerFormValues } from '@/components/AnalyzerForm';
import Results from '@/components/Results';
import type { ResumeAnalysis } from '@/lib/schema';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);

  async function analyze(values: AnalyzerFormValues) {
    setLoading(true);
    setError(null);
    const body = new FormData();
    if (values.file) body.append('file', values.file);
    if (values.resumeText) body.append('resumeText', values.resumeText);
    if (values.jobDescription.trim()) body.append('jobDescription', values.jobDescription);

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">AI Resume Analyzer</h1>
        <p className="mt-3 text-slate-600">
          Get a score, section-by-section feedback, an ATS check and stronger bullet points, plus a match report against
          any job description.
        </p>
      </header>

      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {analysis ? (
        <Results analysis={analysis} onReset={() => setAnalysis(null)} />
      ) : (
        <>
          <AnalyzerForm loading={loading} onSubmit={analyze} />
          {loading && (
            <p className="mt-4 animate-pulse text-center text-sm text-slate-500">
              Reading your resume… this usually takes under a minute.
            </p>
          )}
        </>
      )}

      <footer className="mt-12 text-center text-xs text-slate-400">
        Your resume is sent to Anthropic&apos;s Claude API for analysis and is not stored by this app.
      </footer>
    </main>
  );
}
