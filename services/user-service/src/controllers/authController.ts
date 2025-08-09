import { Request, Response, NextFunction } from 'express';
// import bcrypt from 'bcryptjs'; // TODO: Uncomment when implementing actual password hashing
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
