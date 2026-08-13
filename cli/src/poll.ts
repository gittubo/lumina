import ora from 'ora';
import { AxiosInstance } from 'axios';

export interface GenerationResult {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  outputUrl: string | null;
  error: string | null;
  metadata: Record<string, unknown> | null;
}

const POLL_INTERVAL_MS = 3000;
// Generous enough to cover Meshy's two-stage (preview + refine) pipeline,
// the slowest of the four generation types.
const TIMEOUT_MS = 15 * 60 * 1000;

export async function pollUntilDone(client: AxiosInstance, id: string): Promise<GenerationResult> {
  const spinner = ora('Waiting for generation to complete…').start();
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      spinner.fail('Timed out waiting for the generation to complete.');
      throw new Error('Timed out waiting for generation');
    }

    const { data } = await client.get<GenerationResult>(`/generations/${id}`);

    if (data.status === 'completed') {
      spinner.succeed('Generation complete!');
      return data;
    }
    if (data.status === 'failed') {
      spinner.fail(`Generation failed: ${data.error || 'unknown error'}`);
      throw new Error(data.error || 'Generation failed');
    }

    spinner.text = `Status: ${data.status}…`;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
