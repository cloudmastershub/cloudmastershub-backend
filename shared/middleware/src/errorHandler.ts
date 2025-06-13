import { Request, Response, NextFunction } from 'express';
import { AppError, createLogger } from '@cloudmastershub/utils';

const logger = createLogger('error-handler');

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let isOperational = false;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    isOperational = err.isOperational;
  }

  logger.error({
    error: err.message,
    stack: err.stack,
    statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });

  res.status(statusCode).json({
    success: false,
    error: {
      message:
        process.env.NODE_ENV === 'production' && !isOperational ? 'Internal Server Error' : message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
  });
};
