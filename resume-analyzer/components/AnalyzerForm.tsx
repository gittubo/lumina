'use client';

import { useRef, useState } from 'react';

export interface AnalyzerFormValues {
  file: File | null;
  resumeText: string;
  jobDescription: string;
}

const ACCEPT = '.pdf,.docx,.txt,.md';

export default function AnalyzerForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (values: AnalyzerFormValues) => void;
}) {
  const [mode, setMode] = useState<'upload' | 'paste'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasResume = mode === 'upload' ? !!file : resumeText.trim().length > 0;

  return (
    <form
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!hasResume || loading) return;
        onSubmit({
          file: mode === 'upload' ? file : null,
          resumeText: mode === 'paste' ? resumeText : '',
          jobDescription,
        });
      }}
    >
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">1. Your resume</h2>
          <div className="flex rounded-lg bg-slate-100 p-1 text-sm" role="tablist">
            {(['upload', 'paste'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-md px-3 py-1 capitalize ${mode === m ? 'bg-white font-medium shadow-sm' : 'text-slate-600'}`}
              >
                {m === 'upload' ? 'Upload file' : 'Paste text'}
              </button>
            ))}
          </div>
        </div>

        {mode === 'upload' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
              dragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              aria-label="Resume file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <>
                <p className="font-medium text-slate-900">{file.name}</p>
                <p className="mt-1 text-sm text-slate-500">{(file.size / 1024).toFixed(0)} KB · click to change</p>
              </>
            ) : (
              <>
                <p className="font-medium text-slate-900">Drop your resume here or click to browse</p>
                <p className="mt-1 text-sm text-slate-500">PDF, DOCX, TXT or MD · up to 5 MB</p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={12}
            placeholder="Paste the full text of your resume…"
            aria-label="Resume text"
            className="w-full rounded-xl border border-slate-300 p-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        )}
      </div>

      <div>
        <h2 className="mb-1 text-lg font-semibold">
          2. Job description <span className="text-sm font-normal text-slate-500">(optional)</span>
        </h2>
        <p className="mb-3 text-sm text-slate-500">Paste a job posting to get a match score, missing keywords and tailoring tips.</p>
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          rows={6}
          placeholder="Paste the job description…"
          aria-label="Job description"
          className="w-full rounded-xl border border-slate-300 p-4 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <button
        type="submit"
        disabled={!hasResume || loading}
        className="w-full rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {loading ? 'Analyzing…' : 'Analyze resume'}
      </button>
    </form>
  );
}
