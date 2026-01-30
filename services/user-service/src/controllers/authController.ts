import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import logger from '../utils/logger';
import { getUserEventPublisher } from '../events/userEventPublisher';
import * as userService from '../services/userService';
import { referralService } from '../services/referralService';
import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'cloudmastershub-jwt-secret-2024-production-key';
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_IN = '30d';

export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, firstName, lastName } = req.body;
    // TODO: Use password from req.body for actual user registration
    // const { password } = req.body;

    // TODO: Check if user exists in database
    // TODO: Hash password and save user to database

    // TODO: Hash password and save user to database when implementing actual user registration
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Mock user creation
    const user = {
      id: '1234',
      email,
      firstName,
      lastName,
      createdAt: new Date(),
    };

    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;
    // TODO: Use password from req.body to verify user credentials when implementing actual authentication
    // const { password } = req.body;

    // Mock user login
    const user = {
      id: '1234',
      email,
      firstName: 'John',
      lastName: 'Doe',
    };

    const accessToken = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    const refreshToken = jwt.sign({ userId: user.id, type: 'refresh' }, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    // Publish login event (non-blocking to prevent auth failures)
    const eventPublisher = getUserEventPublisher();
    eventPublisher.publishUserLogin(user.id, {
      email: user.email,
      loginMethod: 'email_password',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    }).catch(error => {
      // Log error but don't fail authentication
      logger.warn('Failed to publish login event', { 
        error: error.message, 
        userId: user.id,
        email: user.email,
        loginMethod: 'email_password'
      });
    });

    res.json({
      success: true,
      data: {
        user,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // In a real implementation, you would:
    // 1. Invalidate the refresh token in the database
    // 2. Add the JWT to a blacklist (if using stateful approach)
    // 3. Clear any session data

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Publish logout event (non-blocking)
        const eventPublisher = getUserEventPublisher();
        eventPublisher.publishUserLogout(decoded.userId, {
          email: decoded.email
        }).catch(error => {
          logger.warn('Failed to publish logout event', { 
            error: error.message, 
            userId: decoded.userId,
            email: decoded.email
          });
        });
        
        logger.info('User logged out', { userId: decoded.userId, email: decoded.email });
      } catch (tokenError) {
        // Token might be expired or invalid, but that's okay for logout
        logger.debug('Token verification failed during logout:', tokenError);
      }
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth authentication
export const googleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { googleToken, email, firstName, lastName, avatar, referralCode } = req.body;

    if (!googleToken || !email) {
      res.status(400).json({
        success: false,
        error: { message: 'Google token and email are required' },
      });
      return;
    }

    // Verify Google token (skipped in development due to network restrictions)
    // TODO: Re-enable Google token verification when network access is configured
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_GOOGLE_TOKEN_VERIFICATION === 'true') {
      try {
        const googleResponse = await axios.get(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${googleToken}`
        );

        if (googleResponse.data.email !== email) {
          res.status(401).json({
            success: false,
            error: { message: 'Google token does not match provided email' },
          });
          return;
        }
      } catch (googleError) {
        logger.error('Google token verification failed:', googleError);
        res.status(401).json({
          success: false,
          error: { message: 'Invalid Google token' },
        });
        return;
      }
    } else {
      logger.debug('Google token verification skipped (development mode or network restrictions)');
    }

    // Check if this is the admin user
    const isAdminUser = email === 'mbuaku@gmail.com';
    
    // Try to get existing user or create new one using MongoDB directly
    let user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      // Create new user with referral initialization
      logger.info('Creating new user via Google OAuth (MongoDB)', { email, firstName, lastName });
      
      user = new User({
        email: email.toLowerCase(),
        firstName: firstName || (isAdminUser ? 'Admin' : 'User'),
        lastName: lastName || (isAdminUser ? 'User' : ''),
        avatar: avatar,
        roles: isAdminUser ? ['admin', 'student'] : ['student'],
        subscription: isAdminUser ? 'enterprise' : 'free',
        emailVerified: true,
        isActive: true,
        lastLogin: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await user.save();
      
      logger.info('New user created successfully in MongoDB', { 
        userId: user._id.toString(), 
        email: user.email 
      });
      
      // Handle referral signup if referral code was provided
      if (referralCode) {
        try {
          await referralService.recordReferralSignup(user._id.toString(), referralCode);
          logger.info('Referral signup recorded for new user', { 
            userId: user._id.toString(), 
            email: user.email,
            referralCode 
          });
        } catch (referralError) {
          logger.error('Failed to record referral signup for new user', { 
            userId: user._id.toString(), 
            referralCode, 
            error: referralError 
          });
          // Don't fail authentication if referral tracking fails
        }
      }
    } else {
      // Update existing user's profile and last login
      const updates: any = { lastLogin: new Date(), updatedAt: new Date() };
      if (avatar && user.avatar !== avatar) {
        updates.avatar = avatar;
      }
      
      await User.updateOne({ _id: user._id }, updates);
      
      // Refetch user to get updated data
      const updatedUser = await User.findById(user._id);
      if (!updatedUser) {
        res.status(500).json({
          success: false,
          error: { message: 'User update failed' },
        });
        return;
      }
      user = updatedUser;
      
      logger.info('Existing user signed in via Google OAuth (MongoDB)', { 
        userId: user._id.toString(), 
        email: user.email 
      });
    }
    
    // Ensure user is not null at this point
    if (!user) {
      res.status(500).json({
        success: false,
        error: { message: 'User creation/retrieval failed' },
      });
      return;
    }
    
    logger.info(`Google OAuth user ${isAdminUser ? '(ADMIN)' : '(STUDENT)'}`, { 
      email, 
      roles: user.roles, 
      subscriptionTier: user.subscription
    });

    const userId = user._id.toString();
    const accessToken = jwt.sign(
      { 
        userId: userId, 
        email: user.email, 
        roles: user.roles,
        subscriptionTier: user.subscription || 'free',
        subscriptionStatus: 'active',
        authProvider: 'google'
      }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { userId: userId, type: 'refresh' }, 
      JWT_SECRET, 
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Publish login event (non-blocking to prevent auth failures)
    const eventPublisher = getUserEventPublisher();
    eventPublisher.publishUserLogin(userId, {
      email: user.email,
      loginMethod: 'google_oauth',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    }).catch(error => {
      // Log error but don't fail authentication
      logger.warn('Failed to publish login event', { 
        error: error.message, 
        userId: userId,
        email: user.email,
        loginMethod: 'google_oauth'
      });
    });

    logger.info('Google OAuth login successful', { 
      userId: userId, 
      email: user.email 
    });

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          avatar: user.avatar,
          roles: user.roles,
          subscriptionTier: user.subscription || 'free',
          subscriptionStatus: 'active',
          authProvider: 'google',
          emailVerified: user.emailVerified,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          lastLogin: user.lastLogin
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Google OAuth error:', error);
    next(error);
  }
};

export const refreshToken = async (
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: { message: 'Refresh token required' },
      });
      return;
    }

    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;

    if (decoded.type !== 'refresh') {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid token type' },
      });
      return;
    }

    const accessToken = jwt.sign({ userId: decoded.userId }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired refresh token' },
    });
  }
};

// Password Reset - Request reset email
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success to prevent email enumeration attacks
    if (!user) {
      logger.info('Password reset requested for non-existent email', { email });
      res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      });
      return;
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set token expiry to 1 hour
    const tokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    // Save hashed token to user document
    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = tokenExpiry;
    await user.save();

    // Build reset URL
    const frontendUrl = process.env.FRONTEND_URL || 'https://cloudmastershub.com';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Send reset email via marketing service
    try {
      const marketingServiceUrl = process.env.MARKETING_SERVICE_URL || 'http://marketing-service:3006';
      await axios.post(`${marketingServiceUrl}/internal/send`, {
        to: user.email,
        toName: user.firstName,
        subject: 'Reset Your CloudMastersHub Password',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a2e; margin-bottom: 24px;">Reset Your Password</h1>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">Hi ${user.firstName || 'there'},</p>
            <p style="color: #444; font-size: 16px; line-height: 1.6;">
              You requested to reset your password. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}"
                 style="background: linear-gradient(to right, #06b6d4, #3b82f6);
                        color: white;
                        padding: 14px 32px;
                        border-radius: 8px;
                        text-decoration: none;
                        font-weight: 600;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, copy and paste this URL into your browser:
              <br/>
              <a href="${resetUrl}" style="color: #3b82f6;">${resetUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;"/>
            <p style="color: #999; font-size: 12px;">
              &copy; ${new Date().getFullYear()} CloudMastersHub. All rights reserved.
            </p>
          </div>
        `,
        tags: ['password-reset', 'transactional'],
      }, {
        headers: { 'x-internal-service': 'true' },
        timeout: 10000,
      });

      logger.info('Password reset email sent', { userId: user._id.toString(), email: user.email });
    } catch (emailError: any) {
      logger.error('Failed to send password reset email', {
        userId: user._id.toString(),
        email: user.email,
        error: emailError.message
      });
      // Still return success to prevent email enumeration
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    next(error);
  }
};

// Password Reset - Set new password
export const resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token, password } = req.body;

    // Hash the provided token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired reset token. Please request a new password reset.' },
      });
      return;
    }

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Update user with new password and clear reset token
    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.updatedAt = new Date();
    await user.save();

    // Publish password changed event
    const eventPublisher = getUserEventPublisher();
    eventPublisher.publishEvent({
      type: 'user.password.changed',
      userId: user._id.toString(),
      data: { passwordChangedAt: new Date().toISOString() },
    }).catch(error => {
      logger.warn('Failed to publish password changed event', {
        error: error.message,
        userId: user._id.toString()
      });
    });

    logger.info('Password reset successful', { userId: user._id.toString(), email: user.email });

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    next(error);
  }
};

// Verify reset token validity
export const verifyResetToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { token } = req.params;

    // Hash the provided token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Check if a user exists with this valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid or expired reset token.' },
      });
      return;
    }

    res.json({
      success: true,
      data: { valid: true },
    });
  } catch (error) {
    logger.error('Verify reset token error:', error);
    next(error);
  }
};
