'use client';

import { useState } from 'react';
import type React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { parseFenceInfo, buildPromptHandoffUrl } from '@/lib/promptHandoff';
import type { GenerationType, Project } from '@/types';

type Segment = { kind: 'text'; value: string } | { kind: 'code'; value: string; lang: string };

// The assistant puts each ready-to-use prompt in a fenced code block, so
// those get their own box with copy / "Use this prompt" buttons. Everything
// else is shown as plain text with line breaks preserved — no Markdown
// renderer dependency. `lang` is the fence's whole info string, e.g.
// "image style=cinematic aspectRatio=16:9".
export function splitFencedCode(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```(?:([^\n`]*)\n)?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) segments.push({ kind: 'text', value: text.slice(last, match.index) });
    segments.push({ kind: 'code', lang: (match[1] ?? '').trim(), value: match[2].replace(/\n$/, '') });
    last = fence.lastIndex;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });

  return segments.filter((s) => s.kind === 'code' || s.value.trim() !== '');
}

// Claude often uses **bold** and `inline code` in prose; render just those
// two so they don't show up as literal asterisks and backticks.
export function renderInline(text: string): React.ReactNode[] {
  // split() with a capture group puts the matches at the odd indexes; only
  // those get formatted, so unmatched text that merely starts and ends with
  // the markers (e.g. a backtick pair spanning a line break) stays as typed.
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (i % 2 === 0) return part;
    if (part.startsWith('**')) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    return (
      <code key={i} className="px-1 py-0.5 rounded bg-slate-950/60 text-purple-200 text-[0.9em]">
        {part.slice(1, -1)}
      </code>
    );
  });
}

const TYPE_LABELS: Record<GenerationType, string> = {
  image: 'Image prompt',
  video: 'Video prompt',
  '3d': '3D model prompt',
  audio: 'Speech script',
};

/** Where "Use this prompt" sends the user: the chat's project, or a pick. */
export interface PromptTarget {
  projectId: string | null;
  projects: Project[];
}

function UsePromptButton({
  target,
  type,
  prompt,
  options,
}: {
  target: PromptTarget;
  type: GenerationType;
  prompt: string;
  options: Record<string, string>;
}) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const buttonClass = 'text-purple-300 hover:text-white transition-colors';

  if (target.projectId) {
    return (
      <Link href={buildPromptHandoffUrl(target.projectId, type, prompt, options)} className={buttonClass}>
        Use this prompt
      </Link>
    );
  }

  if (target.projects.length === 0) {
    return (
      <Link href="/dashboard" className={buttonClass} title="You need a project to generate in">
        Create a project to use this
      </Link>
    );
  }

  if (!picking) {
    return (
      <button onClick={() => setPicking(true)} className={buttonClass}>
        Use this prompt
      </button>
    );
  }

  return (
    <select
      autoFocus
      aria-label="Choose a project for this prompt"
      defaultValue=""
      onBlur={() => setPicking(false)}
      onChange={(e) => {
        if (e.target.value) router.push(buildPromptHandoffUrl(e.target.value, type, prompt, options));
      }}
      className="bg-slate-900 border border-slate-600 rounded text-slate-200 px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
    >
      <option value="" disabled>
        Choose a project…
      </option>
      {target.projects.map((p) => (
        <option key={p.id} value={p.id}>
          {p.title}
        </option>
      ))}
    </select>
  );
}

function CodeBlock({ value, lang, target }: { value: string; lang: string; target?: PromptTarget }) {
  const [copied, setCopied] = useState(false);
  const { type, options } = parseFenceInfo(lang);
  const label = type
    ? [TYPE_LABELS[type], ...Object.entries(options).filter(([k]) => k !== 'negativePrompt').map(([, v]) => v)].join(' · ')
    : lang || 'prompt';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be unavailable (insecure context, permissions) — the
      // text is still selectable, so there's nothing else to do.
    }
  };

  return (
    <div className="my-2 rounded-lg border border-slate-700 bg-slate-950/60 overflow-hidden">
      <div className="flex justify-between items-center gap-3 px-3 py-1.5 border-b border-slate-700/70 text-xs text-slate-400">
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-3 shrink-0">
          {type && target && value.trim() && (
            <UsePromptButton target={target} type={type} prompt={value.trim()} options={options} />
          )}
          <button onClick={copy} className="hover:text-white transition-colors">
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre className="px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap break-words">
        <code>{value}</code>
      </pre>
      {options.negativePrompt && (
        <p className="px-3 pb-2 text-xs text-slate-400">Avoid: {options.negativePrompt}</p>
      )}
    </div>
  );
}

/**
 * `target` enables "Use this prompt" on labelled prompt blocks. Leave it
 * out while a reply is still streaming, since its prompts may be incomplete.
 */
export default function ChatMessageContent({ text, target }: { text: string; target?: PromptTarget }) {
  return (
    <>
      {splitFencedCode(text).map((segment, i) =>
        segment.kind === 'code' ? (
          <CodeBlock key={i} value={segment.value} lang={segment.lang} target={target} />
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInline(segment.value.replace(/^\n+|\n+$/g, ''))}
          </p>
        )
      )}
    </>
  );
}
