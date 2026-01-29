import { Router } from 'express';
import {
  verifyCertificate,
  getUserCertificates,
  getCertificateById,
  generateCourseCertificate,
  generatePathCertificate,
  getLinkedInShareUrl
} from '../controllers/certificateController';
import { authenticate } from '@cloudmastershub/middleware';

const router = Router();

// PUBLIC: Verify a certificate by verification code (no auth required)
router.get('/verify/:code', verifyCertificate);

// Get all certificates for the authenticated user
router.get('/', authenticate, getUserCertificates);

// Get a specific certificate by ID
router.get('/:certificateId', getCertificateById);

// Generate certificate for completed course
router.post('/courses/:courseId/generate', authenticate, generateCourseCertificate);

// Generate certificate for completed learning path
router.post('/paths/:pathId/generate', authenticate, generatePathCertificate);

// Get LinkedIn share URL for a certificate
router.get('/:certificateId/linkedin', authenticate, getLinkedInShareUrl);

export default router;
