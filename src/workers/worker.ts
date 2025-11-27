/**
 * Worker process entry point
 * Run this separately: npm run worker
 * 
 * This starts the BullMQ worker to process insect identification jobs
 */
import 'dotenv/config';
import './insect.worker';

// Keep the process alive
console.log('Worker process started. Press Ctrl+C to stop.');

process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received: closing worker');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT signal received: closing worker');
  process.exit(0);
});

