import crypto from 'crypto';
import axios from 'axios';
import logger from './logger';

const MARKETING_PLATFORM_URL = process.env.MARKETING_PLATFORM_URL ||
  'http://marketing-backend.elites-marketing-dev.svc.cluster.local:3006/internal';
const INTERNAL_SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://cloudmastershub.com';

type TemplateKey = 'EMAIL_VERIFY' | 'RESET_PASSWORD' | 'INVITE_USER';

interface TransactionalEmailOptions {
  to: string;
  toName?: string;
  templateKey: TemplateKey;
  variables: Record<string, string>;
}

export async function sendTransactionalEmail(options: TransactionalEmailOptions): Promise<void> {
  const { to, toName, templateKey, variables } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Service-Name': 'cloudmastershub',
  };

  if (INTERNAL_SERVICE_SECRET) {
    headers['X-Internal-Token'] = INTERNAL_SERVICE_SECRET;
  }

  try {
    await axios.post(
      `${MARKETING_PLATFORM_URL}/transactional/send-template`,
      { to, toName, templateKey, variables },
      { headers, timeout: 10000 }
    );
    logger.info('Transactional email sent', { to, templateKey });
  } catch (error: any) {
    logger.error('Failed to send transactional email', {
      to,
      templateKey,
      error: error.message,
      status: error.response?.status,
    });
    throw error;
  }
}

interface UserForVerification {
  _id: { toString(): string };
  email: string;
  firstName?: string;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  save(): Promise<any>;
}

export async function sendVerificationEmail(user: UserForVerification): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  await user.save();

  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${rawToken}`;

  await sendTransactionalEmail({
    to: user.email,
    toName: user.firstName,
    templateKey: 'EMAIL_VERIFY',
    variables: {
      firstName: user.firstName || 'there',
      verifyUrl,
    },
  });

  logger.info('Verification email sent', {
    userId: user._id.toString(),
    email: user.email,
  });
}
