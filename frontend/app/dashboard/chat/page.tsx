'use client';

import { Suspense, useCallback, useEffect, useRef, useState, FormEvent, KeyboardEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import ChatMessageContent from '@/components/ChatMessageContent';
import {
  listConversations,
  getConversation,
  createConversation,
  deleteConversation,
  sendChatMessage,
  listProjects,
  getApiErrorMessage,
  ChatStreamError,
} from '@/lib/api';
import type { ChatMessage, Conversation, Project } from '@/types';

const STARTERS = [
  'Write an image prompt for a cozy cyberpunk ramen shop at night',
  'Give me three directions for a 10-second product video of a sneaker',
  'Describe a stylized treasure chest I can turn into a 3D model',
  'Write a 30-second warm, friendly voiceover for a podcast intro',
];

function errorMessage(err: unknown) {
  return err instanceof ChatStreamError ? err.message : getApiErrorMessage(err);
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, isHydrated } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // A new chat isn't created on the server until its first message is sent,
  // so the chosen project lives here until then.
  const [draftProjectId, setDraftProjectId] = useState<string>(searchParams.get('project') ?? '');
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<{ userText: string; reply: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSidebar, setShowSidebar] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isHydrated && !token) router.push('/login');
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (!token) return;
    Promise.all([listConversations(), listProjects()])
      .then(([conversationData, projectData]) => {
        setConversations(conversationData);
        setProjects(projectData);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setIsLoading(false));
  }, [token]);

  // Stop any in-flight reply when leaving the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pending?.reply]);

  const openConversation = useCallback(async (id: string) => {
    abortRef.current?.abort();
    setPending(null);
    setError(null);
    setActiveId(id);
    setShowSidebar(false);
    try {
      const data = await getConversation(id);
      setMessages(data.messages);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, []);

  const startNewChat = () => {
    abortRef.current?.abort();
    setPending(null);
    setError(null);
    setActiveId(null);
    setMessages([]);
    setShowSidebar(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (id === activeId) startNewChat();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;

    setError(null);
    setInput('');
    setPending({ userText: message, reply: '' });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let conversationId = activeId;
      if (!conversationId) {
        const created = await createConversation(draftProjectId || undefined);
        conversationId = created.id;
        setActiveId(created.id);
        setConversations((prev) => [created, ...prev]);
      }

      const result = await sendChatMessage(
        conversationId,
        message,
        (delta) => setPending((p) => (p ? { ...p, reply: p.reply + delta } : p)),
        controller.signal
      );

      setMessages((prev) => [...prev, result.userMessage, result.assistantMessage]);
      setConversations((prev) => {
        const current = prev.find((c) => c.id === conversationId);
        const rest = prev.filter((c) => c.id !== conversationId);
        return current ? [{ ...current, title: result.title, updatedAt: new Date().toISOString() }, ...rest] : prev;
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(errorMessage(err));
      // Nothing was saved, so put the text back to make retrying easy.
      setInput(message);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setPending(null);
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (pending) setInput(pending.userText);
    setPending(null);
  };

  const activeConversation = conversations.find((c) => c.id === activeId);
  const scopedProjectId = activeConversation ? activeConversation.projectId : draftProjectId || null;
  const scopedProject = projects.find((p) => p.id === scopedProjectId);

  if (!isHydrated || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !pending;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-slate-700/50 backdrop-blur-md bg-slate-900/50 shrink-0">
        <div className="px-4 sm:px-6 flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar((v) => !v)}
              className="md:hidden text-slate-300 hover:text-white text-sm border border-slate-700 rounded-lg px-3 py-1.5"
            >
              Chats
            </button>
            <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition-colors">
              ← Dashboard
            </Link>
          </div>
          <h1 className="text-lg font-semibold text-white">Lumina Assistant</h1>
          <button
            onClick={startNewChat}
            className="px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
          >
            New chat
          </button>
        </div>
      </nav>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`${showSidebar ? 'block' : 'hidden'} md:block w-full md:w-72 shrink-0 border-r border-slate-700/50 bg-slate-900/60 overflow-y-auto absolute md:static inset-x-0 top-16 bottom-0 z-40`}
        >
          <div className="p-3 space-y-1">
            {isLoading ? (
              <p className="text-slate-500 text-sm px-2 py-1">Loading…</p>
            ) : conversations.length === 0 ? (
              <p className="text-slate-500 text-sm px-2 py-1">No conversations yet</p>
            ) : (
              conversations.map((c) => (
                <div
                  key={c.id}
                  className={`group flex items-center rounded-lg ${
                    c.id === activeId ? 'bg-purple-600/30 text-white' : 'text-slate-300 hover:bg-slate-800/70'
                  }`}
                >
                  <button onClick={() => openConversation(c.id)} className="flex-1 text-left px-3 py-2 text-sm truncate">
                    {c.title}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="px-2 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-xs"
                    aria-label={`Delete ${c.title}`}
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="px-4 sm:px-6 py-2 border-b border-slate-700/30 text-xs text-slate-400 flex items-center gap-2 min-h-[2.5rem]">
            {activeConversation ? (
              scopedProject ? (
                <span>
                  Project context:{' '}
                  <Link href={`/dashboard/projects/${scopedProject.id}`} className="text-purple-300 hover:underline">
                    {scopedProject.title}
                  </Link>
                </span>
              ) : (
                <span>General chat</span>
              )
            ) : (
              <>
                <label htmlFor="project">Project context</label>
                <select
                  id="project"
                  value={draftProjectId}
                  onChange={(e) => setDraftProjectId(e.target.value)}
                  className="bg-slate-900/60 border border-slate-700 rounded-md text-slate-200 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
              {isEmpty ? (
                <div className="text-center pt-12">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">L</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">What are we making?</h2>
                  <p className="text-slate-400 mb-8">
                    Brainstorm ideas and get ready-to-use prompts for images, video, 3D models, and voice.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3 text-left">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="p-4 text-sm text-slate-300 bg-slate-800/50 border border-slate-700/50 rounded-xl hover:border-purple-500/50 hover:text-white transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m) => (
                    <MessageBubble key={m.id} role={m.role} text={m.text} />
                  ))}
                  {pending && (
                    <>
                      <MessageBubble role="user" text={pending.userText} />
                      {pending.reply ? (
                        <MessageBubble role="assistant" text={pending.reply} />
                      ) : (
                        <div className="text-slate-400 text-sm animate-pulse">Thinking…</div>
                      )}
                    </>
                  )}
                </>
              )}

              {error && (
                <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-700/50 bg-slate-900/50">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex gap-3 items-end">
              <textarea
                aria-label="Message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                maxLength={8000}
                placeholder="Ask for ideas or a prompt… (Shift+Enter for a new line)"
                className="flex-1 px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
              />
              {pending ? (
                <button
                  type="button"
                  onClick={stop}
                  className="px-5 py-2.5 border border-slate-600 text-slate-200 hover:text-white rounded-lg font-medium transition-colors"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                >
                  Send
                </button>
              )}
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}

function MessageBubble({ role, text }: { role: ChatMessage['role']; text: string }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-purple-600/80 text-white text-sm whitespace-pre-wrap break-words">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="text-slate-200 text-sm leading-relaxed space-y-2" data-testid="assistant-message">
      <ChatMessageContent text={text} />
    </div>
  );
}

export default function ChatPage() {
  // useSearchParams() needs a Suspense boundary for Next's static build.
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
          <p className="text-slate-400">Loading…</p>
        </div>
      }
    >
      <ChatPageInner />
    </Suspense>
  );
}
