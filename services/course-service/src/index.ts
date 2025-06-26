import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import courseRoutes from './routes/courseRoutes';
import lessonRoutes from './routes/lessonRoutes';
import progressRoutes from './routes/progressRoutes';
import learningPathRoutes from './routes/learningPathRoutes';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'course-service', timestamp: new Date().toISOString() });
});

app.use('/courses', courseRoutes);
app.use('/courses/:courseId/lessons', lessonRoutes);
app.use('/progress', progressRoutes);
app.use('/paths', learningPathRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Course Service running on port ${PORT}`);
});