import { Request, Response, NextFunction } from 'express';
import { 
  SubscriptionStatus, 
  AccessVerificationRequest, 
  AccessVerificationResponse,
  SubscriptionPlanType 
} from '@cloudmastershub/types';
import { createPaymentServiceClient } from '@cloudmastershub/utils';
import logger from '@cloudmastershub/utils/dist/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
  subscription?: SubscriptionStatus;
}

export interface SubscriptionRequirement {
  minPlan?: SubscriptionPlanType;
  resourceType?: 'course' | 'learning_path' | 'lab' | 'platform';
  resourceId?: string;
  allowTrials?: boolean;
  allowPurchases?: boolean;
  customMessage?: string;
}

const defaultRequirement: SubscriptionRequirement = {
  minPlan: SubscriptionPlanType.PREMIUM,
  resourceType: 'platform',
  allowTrials: true,
  allowPurchases: true
};

// Cache for subscription status (5 minutes TTL)
const subscriptionCache = new Map<string, { data: SubscriptionStatus; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const requireSubscription = (requirement: SubscriptionRequirement = {}) => {
  const req = { ...defaultRequirement, ...requirement };

  return async (request: AuthenticatedRequest, response: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if user is authenticated
      if (!request.user?.id) {
        logger.warn('Subscription middleware: No authenticated user');
        response.status(401).json({
          success: false,
          error: {
            message: 'Authentication required',
            code: 'AUTH_REQUIRED'
          }
        });
        return;
      }

      const userId = request.user.id;

      // Check cache first
      const cached = subscriptionCache.get(userId);
      if (cached && cached.expiry > Date.now()) {
        request.subscription = cached.data;
        
        if (await hasRequiredAccess(request.subscription, req)) {
          next();
          return;
        }
      }

      // Get subscription status from payment service
      const paymentClient = createPaymentServiceClient();
      
      try {
        const subscriptionResponse = await paymentClient.getSubscriptionStatus(userId);
        const subscriptionStatus: SubscriptionStatus = subscriptionResponse.data.data;

        // Cache the result
        subscriptionCache.set(userId, {
          data: subscriptionStatus,
          expiry: Date.now() + CACHE_TTL
        });

        // Attach to request for use in controllers
        request.subscription = subscriptionStatus;

        // Check if subscription is paused
        if (isSubscriptionPaused(subscriptionStatus)) {
          response.status(403).json({
            success: false,
            error: {
              message: 'Your subscription is currently paused. Please resume to access this content.',
              code: 'SUBSCRIPTION_PAUSED',
              details: {
                status: 'paused',
                resumeUrl: '/profile/subscription'
              }
            }
          });
          return;
        }

        // Check if user has required access
        if (await hasRequiredAccess(subscriptionStatus, req)) {
          next();
          return;
        }

        // If specific resource access needed, verify with payment service
        if (req.resourceType && req.resourceType !== 'platform') {
          const accessRequest: AccessVerificationRequest = {
            userId,
            resourceType: req.resourceType,
            resourceId: req.resourceId,
            requiredPlan: req.minPlan
          };

          const accessResponse = await paymentClient.verifyAccess(
            userId, 
            req.resourceType, 
            req.resourceId
          );
          
          const accessResult: AccessVerificationResponse = accessResponse.data.data;

          if (accessResult.hasAccess) {
            next();
            return;
          }

          // Send upgrade required response
          response.status(403).json({
            success: false,
            error: {
              message: req.customMessage || 'Subscription upgrade required',
              code: 'SUBSCRIPTION_REQUIRED',
              details: {
                currentPlan: subscriptionStatus.accessLevel,
                requiredPlan: req.minPlan,
                resourceType: req.resourceType,
                resourceId: req.resourceId,
                upgradeRequired: accessResult.upgradeRequired,
                suggestedPlan: accessResult.suggestedPlan
              }
            }
          });
          return;
        }

        // Default subscription required response
        response.status(403).json({
          success: false,
          error: {
            message: req.customMessage || 'Active subscription required',
            code: 'SUBSCRIPTION_REQUIRED',
            details: {
              currentPlan: subscriptionStatus.accessLevel,
              requiredPlan: req.minPlan,
              hasActiveSubscription: subscriptionStatus.hasActiveSubscription
            }
          }
        });

      } catch (serviceError: any) {
        logger.error('Error communicating with payment service:', serviceError);
        
        // If payment service is down, we could either:
        // 1. Deny access (fail closed) - more secure
        // 2. Allow access (fail open) - better user experience
        // We'll fail closed for security
        response.status(503).json({
          success: false,
          error: {
            message: 'Unable to verify subscription status. Please try again.',
            code: 'SERVICE_UNAVAILABLE'
          }
        });
      }

    } catch (error) {
      logger.error('Subscription middleware error:', error);
      response.status(500).json({
        success: false,
        error: {
          message: 'Internal server error',
          code: 'INTERNAL_ERROR'
        }
      });
    }
  };
};

async function hasRequiredAccess(
  subscription: SubscriptionStatus,
  requirement: SubscriptionRequirement
): Promise<boolean> {
  // If no subscription required, allow access
  if (!requirement.minPlan) {
    return true;
  }

  // Check if user has active subscription
  if (!subscription.hasActiveSubscription) {
    return false;
  }

  // Check if subscription is paused - paused subscriptions don't have access
  if (subscription.subscription?.status === 'paused') {
    return false;
  }

  // Check plan level
  const planHierarchy: Record<string, number> = {
    'free': 0,
    'basic': 1,
    'premium': 2,
    'enterprise': 3
  };

  const userPlanLevel = planHierarchy[subscription.accessLevel] || 0;
  const requiredPlanLevel = planHierarchy[requirement.minPlan] || 1;

  if (userPlanLevel >= requiredPlanLevel) {
    return true;
  }

  // If trials are allowed and user is in trial
  if (requirement.allowTrials && subscription.subscription?.status === 'trialing') {
    return true;
  }

  return false;
}

// Check if subscription is paused
function isSubscriptionPaused(subscription: SubscriptionStatus): boolean {
  return subscription.subscription?.status === 'paused';
}

// Specific subscription requirement presets
export const requirePremiumSubscription = () => 
  requireSubscription({ 
    minPlan: SubscriptionPlanType.PREMIUM,
    customMessage: 'Premium subscription required to access this content'
  });

export const requireEnterpriseSubscription = () => 
  requireSubscription({ 
    minPlan: SubscriptionPlanType.ENTERPRISE,
    customMessage: 'Enterprise subscription required to access this feature'
  });

export const requireCourseAccess = (courseId: string) => 
  requireSubscription({
    resourceType: 'course',
    resourceId: courseId,
    allowPurchases: true,
    customMessage: 'Subscription or course purchase required'
  });

export const requireLearningPathAccess = (pathId: string) => 
  requireSubscription({
    resourceType: 'learning_path',
    resourceId: pathId,
    allowPurchases: true,
    customMessage: 'Subscription or learning path purchase required'
  });

export const requireLabAccess = (labId?: string) => 
  requireSubscription({
    resourceType: 'lab',
    resourceId: labId,
    minPlan: SubscriptionPlanType.PREMIUM,
    customMessage: 'Premium subscription required for lab access'
  });

// Clear cache utility (useful for testing or when subscription changes)
export const clearSubscriptionCache = (userId?: string): void => {
  if (userId) {
    subscriptionCache.delete(userId);
  } else {
    subscriptionCache.clear();
  }
};

// Get cached subscription (useful for controllers)
export const getCachedSubscription = (userId: string): SubscriptionStatus | null => {
  const cached = subscriptionCache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  return null;
};