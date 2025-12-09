import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'marketing-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, service, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
          return `${timestamp} [${service}] ${level}: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transport in production (only if logs directory is writable)
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || '/app/logs';
  try {
    const fs = require('fs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    logger.add(
      new winston.transports.File({
        filename: `${logsDir}/error.log`,
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      })
    );
    logger.add(
      new winston.transports.File({
        filename: `${logsDir}/combined.log`,
        maxsize: 5242880,
        maxFiles: 5,
      })
    );
  } catch (err) {
    // If file logging fails, just use console (container environments)
    logger.warn('File logging disabled - using console only', { error: (err as Error).message });
  }
}

export default logger;
