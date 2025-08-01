import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import logger from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
  userRoles?: string[];
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  console.log('🔐 Auth middleware - Request URL:', req.originalUrl);
  
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  console.log('🔐 Auth middleware - Authorization header:', authHeader ? 'Present' : 'Missing');

  if (!token) {
    console.log('🔐 Auth middleware - No token found');
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required' },
    });
    return;
  }

  console.log('🔐 Auth middleware - Token found, length:', token.length);

  try {
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    console.log('🔐 Auth middleware - JWT_SECRET configured:', !!process.env.JWT_SECRET);
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    console.log('🔐 Auth middleware - Decoded token:', {
      userId: decoded.userId,
      email: decoded.email,
      roles: decoded.roles,
      hasRoles: Array.isArray(decoded.roles)
    });
    
    // Extract user information from JWT
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRoles = decoded.roles || []; // Extract roles from JWT token
    
    console.log('🔐 Auth middleware - Set request properties:', {
      userId: req.userId,
      userEmail: req.userEmail,
      userRoles: req.userRoles
    });
    
    next();
  } catch (error) {
    console.log('🔐 Auth middleware - Error:', { 
      message: error instanceof Error ? error.message : 'Unknown error',
      type: error instanceof Error ? error.constructor.name : 'Unknown'
    });
    
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      error: { message: 'Invalid or expired token' },
    });
  }
};
