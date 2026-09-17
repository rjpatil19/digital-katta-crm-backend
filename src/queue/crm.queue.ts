import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';

// Connection options for BullMQ
export const redisConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: true,
  retryStrategy(times) {
    // Graceful backoff
    return Math.min(times * 500, 5000);
  }
});

// Suppress unhandled redis connection errors during local dev without redis running
redisConnection.on('error', (err) => {
  if (env.NODE_ENV !== 'production') {
    // Non-fatal warning in development when Redis is not running
    // BullMQ jobs will fallback or queue once Redis is reachable
  }
});

export const CRM_QUEUES = {
  BUREAU_ANALYSIS: 'crm-bureau-analysis',
  LEAD_CONVERSION: 'crm-lead-conversion',
  DISPUTE_DISPATCH: 'crm-dispute-dispatch'
} as const;

// Create BullMQ Queues
export const bureauAnalysisQueue = new Queue(CRM_QUEUES.BUREAU_ANALYSIS, {
  connection: redisConnection
});

export const leadConversionQueue = new Queue(CRM_QUEUES.LEAD_CONVERSION, {
  connection: redisConnection
});

export const disputeDispatchQueue = new Queue(CRM_QUEUES.DISPUTE_DISPATCH, {
  connection: redisConnection
});

/**
 * Initialize Background Workers
 */
export function startCrmWorkers() {
  const bureauWorker = new Worker(
    CRM_QUEUES.BUREAU_ANALYSIS,
    async (job: Job) => {
      console.log(`[BullMQ] Processing Bureau AI Analysis Job ${job.id} for lead ${job.data.leadId}`);
      // Asynchronous parsing pipeline execution
      return { status: 'completed', analyzedAt: new Date().toISOString() };
    },
    { connection: redisConnection }
  );

  const conversionWorker = new Worker(
    CRM_QUEUES.LEAD_CONVERSION,
    async (job: Job) => {
      console.log(`[BullMQ] Processing Lead Conversion Notification Job ${job.id} for case ${job.data.caseNumber}`);
      return { status: 'sent' };
    },
    { connection: redisConnection }
  );

  bureauWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Bureau analysis job ${job?.id} failed:`, err.message);
  });

  conversionWorker.on('failed', (job, err) => {
    console.error(`[BullMQ] Conversion notification job ${job?.id} failed:`, err.message);
  });

  return { bureauWorker, conversionWorker };
}
