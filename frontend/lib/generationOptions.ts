// Option values offered by the project page's generate form. Shared with
// the assistant's "Use this prompt" handoff so both validate against the
// same lists.

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
export const STYLES = ['photorealistic', 'anime', 'digital-art', 'cinematic', 'fantasy-art', 'low-poly'];
export const VIDEO_RATIOS = ['1280:720', '720:1280', '1920:1080'];
export const VIDEO_DURATIONS = [5, 10];
export const MODEL_TOPOLOGIES: Array<'triangle' | 'quad'> = ['triangle', 'quad'];
// A few of ElevenLabs' standard premade voices
export const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella' },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
];
