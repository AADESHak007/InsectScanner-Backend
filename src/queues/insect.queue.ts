import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.config';

export interface InsectIdentificationJobData {
  imageBuffer: Buffer;
  imageMimetype: string;
  imageOriginalName: string;
  userId?: string;
}

// Create the queue
export const insectIdentificationQueue = new Queue<InsectIdentificationJobData>(
  'insect-identification',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100, // Keep last 100 completed jobs
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  }
);

// Helper function to add job to queue
export async function addInsectIdentificationJob(
  data: InsectIdentificationJobData
): Promise<string> {
  const job = await insectIdentificationQueue.add('identify-insect', data, {
    jobId: `insect-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  });

  return job.id!;
}

// Helper function to get job status
export async function getJobStatus(jobId: string) {
  const job = await insectIdentificationQueue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  return {
    id: job.id,
    state,
    progress,
    result,
    failedReason,
    createdAt: new Date(job.timestamp),
    processedAt: job.processedOn ? new Date(job.processedOn) : null,
    finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
  };
}

