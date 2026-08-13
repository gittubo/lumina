'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import { listProjects, createProject, deleteProject, getApiErrorMessage } from '@/lib/api';
import type { Project } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, isHydrated, logout } = useAuthStore();

  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Redirect to login once we know hydration finished and there's no session
  useEffect(() => {
    if (isHydrated && !token) {
      router.push('/login');
    }
  }, [isHydrated, token, router]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    setIsLoadingProjects(true);
    listProjects()
      .then((data) => {
        if (!cancelled) setProjects(data);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProjects(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const project = await createProject(title.trim(), description.trim() || undefined);
      setProjects((prev) => [project, ...prev]);
      setTitle('');
      setDescription('');
      setShowCreate(false);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = projects;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      await deleteProject(id);
    } catch (err) {
      setProjects(previous);
      setError(getApiErrorMessage(err));
    }
  }

  if (!isHydrated || !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <p className="text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-slate-700/50 backdrop-blur-md bg-slate-900/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">L</span>
              </div>
              <h1 className="text-2xl font-bold text-white">LUMINA</h1>
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-slate-300 text-sm hidden sm:inline">{user?.email}</span>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:border-slate-600 rounded-lg transition-colors"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Your Projects</h2>
            <p className="text-slate-400 mt-1">
              {user?.name ? `Welcome back, ${user.name}` : 'Welcome back'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate((v) => !v)}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-lg font-medium transition-all"
          >
            {showCreate ? 'Cancel' : '+ New Project'}
          </button>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={handleCreate}
            className="mb-8 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4"
          >
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-slate-300 mb-1.5">
                Title
              </label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="My new project"
              />
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-slate-300 mb-1.5">
                Description <span className="text-slate-500">(optional)</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
                placeholder="What are you creating?"
              />
            </div>
            <button
              type="submit"
              disabled={isCreating}
              className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
            >
              {isCreating ? 'Creating…' : 'Create project'}
            </button>
          </form>
        )}

        {isLoadingProjects ? (
          <p className="text-slate-400">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-24 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <p className="text-slate-400 mb-2">No projects yet</p>
            <p className="text-slate-500 text-sm">Create your first project to start generating</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10 group"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link href={`/dashboard/projects/${project.id}`}>
                    <h4 className="text-lg font-bold text-white hover:text-purple-300 transition-colors">
                      {project.title}
                    </h4>
                  </Link>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
                    aria-label={`Delete ${project.title}`}
                  >
                    Delete
                  </button>
                </div>
                {project.description && (
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">{project.description}</p>
                )}
                <p className="text-slate-500 text-xs">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
