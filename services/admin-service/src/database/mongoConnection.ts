import mongoose from 'mongoose';
import logger from '../utils/logger';

// Build MongoDB URI from environment variables
const DATABASE_URL = process.env.MONGODB_URI || process.env.DATABASE_URL || 'mongodb://mongodb.cloudmastershub-dev.svc.cluster.local:27017/cloudmastershub';
const MONGO_USERNAME = process.env.MONGO_USERNAME;
const MONGO_PASSWORD = process.env.MONGO_PASSWORD;

let MONGODB_URI: string;

if (MONGO_USERNAME && MONGO_PASSWORD) {
  // Use authentication
  const url = new URL(DATABASE_URL);
  MONGODB_URI = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${url.host}${url.pathname}?authSource=admin`;
} else {
  // No authentication
  MONGODB_URI = DATABASE_URL;
}

class MongoConnection {
  private static instance: MongoConnection;
  private isConnected: boolean = false;

  private constructor() {}

  public static getInstance(): MongoConnection {
    if (!MongoConnection.instance) {
      MongoConnection.instance = new MongoConnection();
    }
    return MongoConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.isConnected) {
      logger.info('MongoDB already connected');
      return;
    }

    try {
      // Set mongoose options
      mongoose.set('strictQuery', false);

      // Connect to MongoDB
      await mongoose.connect(MONGODB_URI, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4, // Use IPv4, skip trying IPv6
        authSource: 'admin'
      });

      this.isConnected = true;
      logger.info('MongoDB connected successfully for Admin Service', {
        database: mongoose.connection.db?.databaseName,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      });

      // Handle connection events
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        logger.info('MongoDB reconnected');
        this.isConnected = true;
      });

    } catch (error: any) {
      logger.error('Failed to connect to MongoDB:', error);
      this.isConnected = false;
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    } catch (error: any) {
      logger.error('Error disconnecting from MongoDB:', error);
      throw error;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public getConnection(): typeof mongoose {
    return mongoose;
  }
}

export default MongoConnection;
