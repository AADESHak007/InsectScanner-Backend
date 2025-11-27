import 'dotenv/config';
import './../config/firebase.config';
import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.config';
import { InsectIdentificationJobData } from '../queues/insect.queue';
import { InsectService } from '../services/insect.service';

const insectService = new InsectService();

// Create the worker
export const insectIdentificationWorker = new Worker<InsectIdentificationJobData>(
  'insect-identification',
  async (job: Job<InsectIdentificationJobData>) => {
    const { imageBuffer, imageMimetype, imageOriginalName, userId } = job.data;

    // Update job progress
    await job.updateProgress(10);

    // FIX: Convert the serialized buffer back to a real Buffer
    // Redis stores buffers as { type: 'Buffer', data: [numbers...] }
    let actualBuffer: Buffer;
    if (imageBuffer && (imageBuffer as any).type === 'Buffer' && Array.isArray((imageBuffer as any).data)) {
      actualBuffer = Buffer.from((imageBuffer as any).data);
    } else {
      actualBuffer = Buffer.from(imageBuffer);
    }

    // Create a mock Express.Multer.File object from buffer
    const imageFile: Express.Multer.File = {
      fieldname: 'image',
      originalname: imageOriginalName,
      encoding: '7bit',
      mimetype: imageMimetype,
      buffer: actualBuffer,
      size: actualBuffer.length,
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    // Update job progress
    await job.updateProgress(30);

    // Process identification
    const result = await insectService.identifyInsect({
      image: imageFile,
      userId,
    });

    // Update job progress
    await job.updateProgress(100);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // Per second
    },
  }
);

// Worker event handlers
insectIdentificationWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

insectIdentificationWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err.message);
});

insectIdentificationWorker.on('error', (err) => {
  console.error('❌ Worker error:', err);
});

console.log('🚀 Insect identification worker started');

