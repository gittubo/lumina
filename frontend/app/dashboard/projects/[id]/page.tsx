'use client';

import { useEffect, useState, useCallback, useRef, FormEvent } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/authStore';
import ModelViewer from '@/components/ModelViewer';
import {
  getProjectById,
  listGenerationsByProject,
  generateImage,
  generateVideo,
  generateModel,
  generateAudio,
  getGenerationStatus,
  getApiErrorMessage,
} from '@/lib/api';
import type { Project, Generation, GenerationType } from '@/types';

const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const STYLES = ['photorealistic', 'anime', 'digital-art', 'cinematic', 'fantasy-art', 'low-poly'];
const VIDEO_RATIOS = ['1280:720', '720:1280', '1920:1080'];
const VIDEO_DURATIONS = [5, 10];
const MODEL_TOPOLOGIES: Array<'triangle' | 'quad'> = ['triangle', 'quad'];
// A few of ElevenLabs' standard premade voices
const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
];

const ACTIVE_STATUSES: Generation['status'][] = ['pending', 'processing'];

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { token, isHydrated } = useAuthStore();

  const [project, setProject] = useState<Project | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [genType, setGenType] = useState<GenerationType>('image');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [style, setStyle] = useState(STYLES[0]);
  const [aspectRatio, setAspectRatio] = useState(ASPECT_RATIOS[0]);
  const [videoRatio, setVideoRatio] = useState(VIDEO_RATIOS[0]);
  const [videoDuration, setVideoDuration] = useState(VIDEO_DURATIONS[0]);
  const [modelTopology, setModelTopology] = useState<'triangle' | 'quad'>(MODEL_TOPOLOGIES[0]);
  const [modelEnablePbr, setModelEnablePbr] = useState(false);
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeModel, setActiveModel] = useState<{ url: string; prompt: string } | null>(null);

  const pollingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (isHydrated && !token) {
      router.push('/login');
    }
  }, [isHydrated, token, router]);

  const loadData = useCallback(async () => {
    if (!token || !projectId) return;
    try {
      const [projectData, generationsData] = await Promise.all([
        getProjectById(projectId),
        listGenerationsByProject(projectId),
      ]);
      setProject(projectData);
      setGenerations(generationsData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll any pending/processing generations every 3s until they resolve
  useEffect(() => {
    const active = generations.filter((g) => ACTIVE_STATUSES.includes(g.status));
    if (active.length === 0) return;

    const interval = setInterval(async () => {
      for (const gen of active) {
        if (pollingIds.current.has(gen.id)) continue;
        pollingIds.current.add(gen.id);
        try {
          const updated = await getGenerationStatus(gen.id);
          setGenerations((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
        } catch {
          // transient poll failure, will retry next tick
        } finally {
          pollingIds.current.delete(gen.id);
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [generations]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || !projectId) return;

    setIsSubmitting(true);
    setError(null);
    try {
      let generation: Generation;

      if (genType === 'image') {
        generation = await generateImage({
          prompt: prompt.trim(),
          projectId,
          style,
          aspectRatio,
          negativePrompt: negativePrompt.trim() || undefined,
        });
      } else if (genType === 'video') {
        generation = await generateVideo({
          prompt: prompt.trim(),
          projectId,
          ratio: videoRatio,
          duration: videoDuration,
        });
      } else if (genType === '3d') {
        generation = await generateModel({
          prompt: prompt.trim(),
          projectId,
          topology: modelTopology,
          enablePbr: modelEnablePbr,
        });
      } else {
        generation = await generateAudio({
          prompt: prompt.trim(),
          projectId,
          voiceId,
        });
      }

      setGenerations((prev) => [generation, ...prev]);
      setPrompt('');
      setNegativePrompt('');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isHydrated || !token || isLoading) {
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
            <Link href="/dashboard" className="text-slate-300 hover:text-white text-sm">
              ← All Projects
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">{project?.title}</h2>
          {project?.description && <p className="text-slate-400 mt-1">{project.description}</p>}
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          {(['image', 'video', '3d', 'audio'] as GenerationType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setGenType(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                genType === t
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                  : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <form
          onSubmit={handleSubmit}
          className="mb-10 bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 space-y-4"
        >
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-slate-300 mb-1.5">
              {genType === 'audio' ? 'Text to speak' : 'Prompt'}
            </label>
            <textarea
              id="prompt"
              required
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all resize-none"
              placeholder={
                genType === 'image'
                  ? 'A bioluminescent forest at night, ultra detailed, cinematic lighting…'
                  : genType === 'video'
                    ? 'A timelapse over a mountain range at sunrise, mist rolling through the valleys…'
                    : genType === '3d'
                      ? 'A weathered leather messenger bag with brass buckles…'
                      : 'The text you want narrated…'
              }
            />
          </div>

          {genType === 'image' ? (
            <>
              <div>
                <label htmlFor="negativePrompt" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Negative prompt <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="negativePrompt"
                  type="text"
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  placeholder="blurry, low quality, watermark…"
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="style" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Style
                  </label>
                  <select
                    id="style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    {STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="aspectRatio" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Aspect ratio
                  </label>
                  <select
                    id="aspectRatio"
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    {ASPECT_RATIOS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          ) : genType === 'video' ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="videoRatio" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Aspect ratio
                </label>
                <select
                  id="videoRatio"
                  value={videoRatio}
                  onChange={(e) => setVideoRatio(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {VIDEO_RATIOS.map((ratio) => (
                    <option key={ratio} value={ratio}>
                      {ratio}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="videoDuration" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Duration (seconds)
                </label>
                <select
                  id="videoDuration"
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                >
                  {VIDEO_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}s
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : genType === '3d' ? (
            <div className="space-y-4">
              <p className="text-slate-500 text-xs -mt-2">
                3D generation takes several minutes — a mesh preview is generated first, then textured.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="modelTopology" className="block text-sm font-medium text-slate-300 mb-1.5">
                    Topology
                  </label>
                  <select
                    id="modelTopology"
                    value={modelTopology}
                    onChange={(e) => setModelTopology(e.target.value as 'triangle' | 'quad')}
                    className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  >
                    {MODEL_TOPOLOGIES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end pb-2.5">
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={modelEnablePbr}
                      onChange={(e) => setModelEnablePbr(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900/50 text-purple-600 focus:ring-purple-500"
                    />
                    Enable PBR maps
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="voiceId" className="block text-sm font-medium text-slate-300 mb-1.5">
                Voice
              </label>
              <select
                id="voiceId"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              >
                {VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
          >
            {isSubmitting ? 'Queuing…' : 'Generate'}
          </button>
        </form>

        <h3 className="text-xl font-bold text-white mb-4">Generations</h3>

        {generations.length === 0 ? (
          <div className="text-center py-24 bg-slate-800/30 border border-slate-700/50 rounded-xl">
            <p className="text-slate-400">No generations yet — try a prompt above</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <div className={gen.type === 'video' ? 'aspect-video' : gen.type === 'audio' ? '' : 'aspect-square'}>
                  <div className={`w-full h-full bg-slate-900/50 flex items-center justify-center ${gen.type === 'audio' ? 'p-6' : ''}`}>
                    {gen.status === 'completed' && gen.outputUrl ? (
                      gen.type === 'video' ? (
                        <video
                          src={gen.outputUrl}
                          controls
                          className="w-full h-full object-cover"
                        />
                      ) : gen.type === 'audio' ? (
                        <audio src={gen.outputUrl} controls className="w-full" />
                      ) : gen.type === '3d' ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center gap-3 p-4">
                          {typeof gen.metadata?.thumbnailUrl === 'string' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={gen.metadata.thumbnailUrl}
                              alt={gen.prompt}
                              className="w-full h-full object-cover absolute inset-0"
                            />
                          ) : (
                            <p className="text-slate-500 text-sm text-center">3D model ready</p>
                          )}
                          <div className="relative z-10 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setActiveModel({ url: gen.outputUrl!, prompt: gen.prompt })}
                              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-sm rounded-lg font-medium"
                            >
                              View in 3D
                            </button>
                            <a
                              href={gen.outputUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-slate-800/90 hover:bg-slate-800 text-white text-sm rounded-lg font-medium backdrop-blur-sm"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={gen.outputUrl} alt={gen.prompt} className="w-full h-full object-cover" />
                      )
                    ) : gen.status === 'failed' ? (
                      <div className="text-center px-4">
                        <p className="text-red-400 text-sm font-medium">Generation failed</p>
                        {gen.error && <p className="text-slate-500 text-xs mt-1">{gen.error}</p>}
                      </div>
                    ) : (
                      <div className="text-center px-4">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-slate-400 text-sm capitalize">{gen.status}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-slate-300 text-sm line-clamp-2">{gen.prompt}</p>
                  <p className="text-slate-500 text-xs mt-2">
                    {new Date(gen.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {activeModel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveModel(null)}
        >
          <div
            className="relative w-full max-w-3xl aspect-square bg-slate-900 border border-slate-700 rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveModel(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-slate-800/90 hover:bg-slate-700 text-white rounded-full text-lg leading-none"
              aria-label="Close 3D viewer"
            >
              ×
            </button>
            <ModelViewer url={activeModel.url} />
            <p className="absolute bottom-3 left-3 right-3 text-slate-400 text-xs bg-slate-900/70 backdrop-blur-sm px-3 py-1.5 rounded-lg line-clamp-1">
              {activeModel.prompt} · drag to rotate, scroll to zoom
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
