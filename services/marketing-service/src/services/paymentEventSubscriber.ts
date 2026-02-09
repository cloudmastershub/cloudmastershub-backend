import { createClient } from 'redis';
import Queue from 'bull';
import http from 'http';
import emailService from './emailService';
import logger from '../utils/logger';
import { getTenantId, runWithTenant, DEFAULT_TENANT } from '../utils/tenantContext';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service:3001';

/**
 * Channels the payment service publishes to.
 * We subscribe to all of them, but gracefully skip events missing user_id.
 */
const PAYMENT_CHANNELS = [
  'trial.started',
  'trial.ending_soon',
  'subscription.created',
  'subscription.cancelled',
  'subscription.paused',
  'subscription.resumed',
  'payment.failed',
  'payment.succeeded',
  'bootcamp.enrolled',
] as const;

type PaymentChannel = typeof PAYMENT_CHANNELS[number];

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionPlan: string | null;
}

/**
 * Plan ID → human-readable name mapping.
 * Falls back to the raw plan ID if not found.
 */
function planDisplayName(planId?: string): string {
  if (!planId) return 'your plan';
  const names: Record<string, string> = {
    free: 'Free',
    premium: 'Premium',
    enterprise: 'Enterprise',
  };
  return names[planId.toLowerCase()] || planId;
}

/**
 * Fetch user data from user-service internal endpoint.
 * Uses Node built-in http (internal K8s traffic, no TLS needed).
 */
function fetchUser(userId: string, tenantId?: string): Promise<UserData | null> {
  return new Promise((resolve) => {
    const url = `${USER_SERVICE_URL}/internal/users/${encodeURIComponent(userId)}`;
    const headers: Record<string, string> = { 'x-internal-service': 'marketing-service' };
    if (tenantId) headers['x-tenant-id'] = tenantId;

    const req = http.get(url, { headers, timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        logger.warn('User lookup returned non-200', { userId, status: res.statusCode });
        res.resume(); // drain response
        return resolve(null);
      }

      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body) as UserData);
        } catch {
          logger.error('Failed to parse user lookup response', { userId, body });
          resolve(null);
        }
      });
    });

    req.on('error', (err) => {
      logger.error('User lookup request failed', { userId, error: err.message });
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      logger.warn('User lookup timed out', { userId });
      resolve(null);
    });
  });
}

/**
 * PaymentEventSubscriber
 *
 * Listens to Redis pub/sub channels published by the payment service,
 * enqueues jobs into a Bull queue with deterministic IDs (dedup across pods),
 * then processes them: fetches user data from user-service and sends the
 * appropriate email via emailService.
 */
class PaymentEventSubscriber {
  private subscriber: ReturnType<typeof createClient> | null = null;
  private queue: Queue.Queue | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create a dedicated Redis client for subscribing (redis v4 requires this)
    this.subscriber = createClient({ url: REDIS_URL });

    this.subscriber.on('error', (err) => {
      logger.error('Payment event subscriber Redis error', { error: err.message });
    });

    await this.subscriber.connect();

    // Bull queue for dedup + processing
    this.queue = new Queue('payment-event-emails', REDIS_URL, {
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60000 },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    });

    // Set up the worker
    this.setupWorker();

    // Subscribe to all payment channels
    for (const channel of PAYMENT_CHANNELS) {
      await this.subscriber.subscribe(channel, (message, ch) => {
        this.handleEvent(ch as PaymentChannel, message);
      });
    }

    this.isInitialized = true;
    logger.info('PaymentEventSubscriber initialized', { channels: PAYMENT_CHANNELS.length });
  }

  /**
   * Handle an incoming Redis pub/sub event.
   * Validates the payload, constructs a deterministic job ID, and enqueues.
   */
  private async handleEvent(channel: PaymentChannel, raw: string): Promise<void> {
    let payload: Record<string, any>;
    try {
      payload = JSON.parse(raw);
    } catch {
      logger.warn('Malformed event payload, skipping', { channel, raw: raw.substring(0, 200) });
      return;
    }

    const userId = payload.user_id;
    if (!userId) {
      logger.debug('Event missing user_id, skipping', { channel });
      return;
    }

    const timestamp = payload.timestamp || new Date().toISOString();
    const tenantId = payload.tenantId || DEFAULT_TENANT;
    const jobId = `evt:${channel}:${userId}:${timestamp}`;

    if (!payload.tenantId) {
      logger.warn('Payment event missing tenantId, using default', { channel, userId, default: DEFAULT_TENANT });
    }

    try {
      await this.queue!.add(
        { channel, payload, userId, timestamp, tenantId },
        { jobId }
      );
      logger.info('Payment event enqueued', { channel, userId, jobId });
    } catch (err: any) {
      // Bull throws if jobId already exists — that's the dedup working
      if (err.message?.includes('already exists')) {
        logger.debug('Duplicate event deduplicated', { jobId });
      } else {
        logger.error('Failed to enqueue payment event', { channel, userId, error: err.message });
      }
    }
  }

  /**
   * Bull worker: fetches user, dispatches the right email.
   */
  private setupWorker(): void {
    this.queue!.process(async (job) => {
      const { channel, payload, userId, tenantId } = job.data as {
        channel: PaymentChannel;
        payload: Record<string, any>;
        userId: string;
        timestamp: string;
        tenantId?: string;
      };

      const resolvedTenant = tenantId || DEFAULT_TENANT;
      if (!tenantId) {
        logger.warn('Payment job missing tenantId, using default', { jobId: job.id, channel, userId });
      }

      return runWithTenant(resolvedTenant, async () => {
        // Fetch user data
        const user = await fetchUser(userId, resolvedTenant);
        if (!user) {
          logger.warn('Skipping event: could not fetch user', { channel, userId, tenantId: resolvedTenant });
          return { success: false, reason: 'user_not_found' };
        }

        try {
          await this.dispatchEmail(channel, payload, user);
          logger.info('Payment event email sent', { channel, userId, email: user.email, tenantId: resolvedTenant });
          return { success: true };
        } catch (err: any) {
          logger.error('Failed to send payment event email', { channel, userId, tenantId: resolvedTenant, error: err.message });
          throw err; // let Bull retry
        }
      });
    });

    this.queue!.on('failed', (job, err) => {
      logger.error(`Payment event job failed: ${job.id}`, { error: err.message });
    });
  }

  /**
   * Route an event to the correct emailService method.
   */
  private async dispatchEmail(
    channel: PaymentChannel,
    payload: Record<string, any>,
    user: UserData
  ): Promise<void> {
    const { email, firstName } = user;
    const planName = planDisplayName(payload.plan_id || payload.plan_name || user.subscriptionPlan || undefined);

    switch (channel) {
      case 'trial.started': {
        const trialDays = payload.trial_days || 14;
        const trialEndsAt = payload.trial_ends_at ? new Date(payload.trial_ends_at) : new Date(Date.now() + trialDays * 86400000);
        await emailService.sendTrialStartedEmail(email, planName, trialDays, trialEndsAt, firstName);
        break;
      }

      case 'trial.ending_soon': {
        const daysRemaining = payload.days_remaining || 3;
        const trialEndsAt = payload.trial_ends_at ? new Date(payload.trial_ends_at) : new Date(Date.now() + daysRemaining * 86400000);
        await emailService.sendTrialReminderEmail(email, planName, daysRemaining, trialEndsAt, firstName);
        break;
      }

      case 'subscription.paused': {
        const pauseExpiresAt = payload.pause_expires_at
          ? new Date(payload.pause_expires_at)
          : new Date(Date.now() + 30 * 86400000); // default 30 days
        await emailService.sendSubscriptionPausedEmail(email, planName, pauseExpiresAt, firstName);
        break;
      }

      case 'subscription.resumed': {
        const nextBillingDate = payload.next_billing_date ? new Date(payload.next_billing_date) : null;
        await emailService.sendSubscriptionResumedEmail(email, planName, nextBillingDate, firstName);
        break;
      }

      case 'bootcamp.enrolled': {
        const bootcampName = payload.bootcamp_name || 'your bootcamp';
        await emailService.sendBootcampEnrolledEmail(email, bootcampName, firstName);
        break;
      }

      case 'payment.failed': {
        await emailService.sendPaymentFailedEmail(email, planName, firstName);
        break;
      }

      // Events we subscribe to but defer email handling (insufficient payload data)
      case 'subscription.created':
      case 'subscription.cancelled':
      case 'payment.succeeded': {
        logger.info('Event received but email deferred (not yet implemented)', { channel, userId: user.id });
        break;
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe();
      await this.subscriber.quit();
      this.subscriber = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    this.isInitialized = false;
    logger.info('PaymentEventSubscriber shutdown complete');
  }
}

export const paymentEventSubscriber = new PaymentEventSubscriber();
export default paymentEventSubscriber;
