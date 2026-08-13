import app from './app';
import { startImageGenerationWorker } from './workers/imageGenerationWorker';
import { startVideoGenerationWorker } from './workers/videoGenerationWorker';
import { startModelGenerationWorker } from './workers/modelGenerationWorker';
import { startAudioGenerationWorker } from './workers/audioGenerationWorker';

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 LUMINA Backend Server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs: http://localhost:${PORT}/api/docs\n`);
});

// Process queued generation jobs in-process. For higher throughput this can
// be split into a separate worker process/container pointed at the same
// Redis instance instead of running inline here.
startImageGenerationWorker();
startVideoGenerationWorker();
startModelGenerationWorker();
startAudioGenerationWorker();
