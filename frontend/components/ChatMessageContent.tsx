'use client';

import { useState } from 'react';
import type React from 'react';

type Segment = { kind: 'text'; value: string } | { kind: 'code'; value: string; lang: string };

// The assistant puts each ready-to-use prompt in a fenced code block, so
// those get their own box with a copy button. Everything else is shown as
// plain text with line breaks preserved — no Markdown renderer dependency.
export function splitFencedCode(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([\w-]*)\n?([\s\S]*?)(?:```|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) segments.push({ kind: 'text', value: text.slice(last, match.index) });
    segments.push({ kind: 'code', lang: match[1], value: match[2].replace(/\n$/, '') });
    last = fence.lastIndex;
    if (match[0].length === 0) break;
  }
  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) });

  return segments.filter((s) => s.kind === 'code' || s.value.trim() !== '');
}

// Claude often uses **bold** and `inline code` in prose; render just those
// two so they don't show up as literal asterisks and backticks.
export function renderInline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="px-1 py-0.5 rounded bg-slate-950/60 text-purple-200 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function CodeBlock({ value, lang }: { value: string; lang: string }) {
  const [copied, setCopied] = useState(false);

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
      <div className="flex justify-between items-center px-3 py-1.5 border-b border-slate-700/70 text-xs text-slate-400">
        <span>{lang || 'prompt'}</span>
        <button onClick={copy} className="hover:text-white transition-colors">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-3 py-2 text-sm text-slate-100 whitespace-pre-wrap break-words">
        <code>{value}</code>
      </pre>
    </div>
  );
}

export default function ChatMessageContent({ text }: { text: string }) {
  return (
    <>
      {splitFencedCode(text).map((segment, i) =>
        segment.kind === 'code' ? (
          <CodeBlock key={i} value={segment.value} lang={segment.lang} />
        ) : (
          <p key={i} className="whitespace-pre-wrap break-words">
            {renderInline(segment.value.replace(/^\n+|\n+$/g, ''))}
          </p>
        )
      )}
    </>
  );
}
