import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { audioGenerationQueue, AudioGenerationJobData } from '../queues/audioGenerationQueue';

const prisma = new PrismaClient();

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_BASE_URL = process.env.ELEVEN_LABS_BASE_URL || 'https://api.elevenlabs.io';

// "Rachel" — one of ElevenLabs' standard premade voices, used as a sane
// default when the caller doesn't specify one.
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

export function startAudioGenerationWorker() {
  audioGenerationQueue.process(async (job) => {
    const { generationId, request } = job.data as AudioGenerationJobData;

    if (!ELEVEN_LABS_API_KEY) {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'failed', error: 'ELEVEN_LABS_API_KEY not configured' },
      });
      return;
    }

    try {
      await prisma.generation.update({
        where: { id: generationId },
        data: { status: 'processing' },
      });

      const voiceId = request.voiceId || DEFAULT_VOICE_ID;

      const response = await axios.post(
        `${ELEVEN_LABS_BASE_URL}/v1/text-to-speech/${voiceId}`,
        {
          text: request.prompt,
          model_id: request.modelId || DEFAULT_MODEL_ID,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        },
        {
          headers: {
            'xi-api-key': ELEVEN_LABS_API_KEY,
            'Content-Type': 'application/json',
            Accept: 'audio/mpeg',
          },
          responseType: 'arraybuffer',
        }
      );

      const base64Audio = Buffer.from(response.data).toString('base64');

      await prisma.generation.update({
        where: { id: generationId },
        data: {
          status: 'completed',
          outputUrl: `data:audio/mpeg;base64,${base64Audio}`,
          metadata: { voiceId, modelId: request.modelId || DEFAULT_MODEL_ID },
        },
      });
    } catch (error: any) {
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);

      if (isLastAttempt) {
        // ElevenLabs returns JSON error bodies, but responseType: 'arraybuffer'
        // means axios won't have parsed it — decode it for a useful message.
        let message = error.message || 'Failed to generate audio';
        if (error.response?.data) {
          try {
            const parsed = JSON.parse(Buffer.from(error.response.data).toString('utf-8'));
            message = parsed.detail?.message || parsed.message || message;
          } catch {
            // response wasn't JSON, fall back to the generic error message
          }
        }

        await prisma.generation.update({
          where: { id: generationId },
          data: { status: 'failed', error: message },
        });
      }

      throw error;
    }
  });

  console.log('🔊 Audio generation worker started');
}
