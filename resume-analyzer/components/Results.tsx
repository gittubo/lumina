'use client';

import { useState } from 'react';
import type { AtsIssue, ResumeAnalysis } from '@/lib/schema';
import ScoreRing, { scoreBarColor } from './ScoreRing';

type Tab = 'feedback' | 'match' | 'ats' | 'rewrites';

const SEVERITY_STYLES: Record<AtsIssue['severity'], string> = {
  high: 'bg-rose-100 text-rose-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${scoreBarColor(score)}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function BulletList({ items, marker, markerClass }: { items: string[]; marker: string; markerClass: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className={`mt-0.5 font-bold ${markerClass}`} aria-hidden="true">
            {marker}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Chips({ items, className }: { items: string[]; className: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-500">None</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full px-3 py-1 text-xs font-medium ${className}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can be unavailable (e.g. insecure context); the text stays selectable.
        }
      }}
      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function Results({ analysis, onReset }: { analysis: ResumeAnalysis; onReset: () => void }) {
  const [tab, setTab] = useState<Tab>('feedback');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'feedback', label: 'Feedback' },
    ...(analysis.jobMatch ? [{ id: 'match' as const, label: 'Job match' }] : []),
    { id: 'ats', label: `ATS check (${analysis.ats.issues.length})` },
    { id: 'rewrites', label: `Rewrites (${analysis.rewrites.length})` },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 md:flex-row md:items-center">
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
            <ScoreRing score={analysis.overallScore} label="Overall" />
            <ScoreRing score={analysis.ats.score} label="ATS" size={96} />
            {analysis.jobMatch && <ScoreRing score={analysis.jobMatch.matchScore} label="Job match" size={96} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {analysis.candidateName ? `${analysis.candidateName} · ` : ''}
              {analysis.targetRole}
            </p>
            <p className="mt-2 text-slate-700">{analysis.summary}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <ScoreBar label="Impact" score={analysis.categoryScores.impact} />
          <ScoreBar label="Clarity" score={analysis.categoryScores.clarity} />
          <ScoreBar label="Structure" score={analysis.categoryScores.structure} />
          <ScoreBar label="Skills" score={analysis.categoryScores.skills} />
        </div>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              tab === t.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'feedback' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-semibold text-emerald-700">Strengths</h3>
              <BulletList items={analysis.strengths} marker="+" markerClass="text-emerald-600" />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 font-semibold text-rose-700">Weaknesses</h3>
              <BulletList items={analysis.weaknesses} marker="−" markerClass="text-rose-600" />
            </section>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold">Section by section</h3>
            <div className="divide-y divide-slate-100">
              {analysis.sections.map((s) => (
                <div key={s.name} className="py-4 first:pt-0 last:pb-0">
                  <ScoreBar label={s.name} score={s.score} />
                  <p className="mt-2 text-sm text-slate-600">{s.feedback}</p>
                  {s.suggestions.length > 0 && (
                    <div className="mt-2">
                      <BulletList items={s.suggestions} marker="→" markerClass="text-indigo-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === 'match' && analysis.jobMatch && (
        <section className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-slate-700">{analysis.jobMatch.verdict}</p>
          <div>
            <h3 className="mb-2 font-semibold">Matched keywords</h3>
            <Chips items={analysis.jobMatch.matchedKeywords} className="bg-emerald-100 text-emerald-800" />
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Missing keywords</h3>
            <Chips items={analysis.jobMatch.missingKeywords} className="bg-rose-100 text-rose-800" />
          </div>
          <div>
            <h3 className="mb-2 font-semibold">How to tailor your resume</h3>
            <BulletList items={analysis.jobMatch.tailoringTips} marker="→" markerClass="text-indigo-500" />
          </div>
        </section>
      )}

      {tab === 'ats' && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {analysis.ats.issues.length === 0 ? (
            <p className="text-sm text-slate-600">No ATS issues found. Your resume should parse cleanly.</p>
          ) : (
            <ul className="space-y-4">
              {analysis.ats.issues.map((issue, i) => (
                <li key={i} className="flex gap-3">
                  <span className={`h-fit rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${SEVERITY_STYLES[issue.severity]}`}>
                    {issue.severity}
                  </span>
                  <div className="text-sm">
                    <p className="font-medium text-slate-900">{issue.issue}</p>
                    <p className="mt-1 text-slate-600">{issue.fix}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'rewrites' && (
        <section className="space-y-4">
          {analysis.rewrites.map((r, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Before</p>
              <p className="mt-1 text-sm text-slate-500 line-through decoration-slate-300">{r.original}</p>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">After</p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{r.improved}</p>
                </div>
                <CopyButton text={r.improved} />
              </div>
              <p className="mt-3 text-xs text-slate-500">{r.reason}</p>
            </div>
          ))}
        </section>
      )}

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
      >
        Analyze another resume
      </button>
    </div>
  );
}
