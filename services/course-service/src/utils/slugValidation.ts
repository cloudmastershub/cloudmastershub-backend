import logger from './logger';

/**
 * Check if a string is a valid readable slug
 */
export function isValidSlug(slug: string): boolean {
  // Readable slugs should:
  // 1. Be lowercase
  // 2. Contain only letters, numbers, and hyphens
  // 3. Not start or end with hyphens
  // 4. Not contain consecutive hyphens
  // 5. Be between 3 and 100 characters
  const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  
  return slug.length >= 3 && 
         slug.length <= 100 && 
         slugPattern.test(slug) &&
         slug === slug.toLowerCase();
}

/**
 * Check if a string looks like a legacy ID (UUID or MongoDB ObjectId)
 */
export function isLegacyId(id: string): boolean {
  // UUID pattern (e.g., "123e4567-e89b-12d3-a456-426614174000")
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  
  // MongoDB ObjectId pattern (24 hex characters)
  const objectIdPattern = /^[0-9a-f]{24}$/i;
  
  // Random alphanumeric strings (common for mock data)
  const randomAlphanumericPattern = /^[A-Za-z0-9]{10,}$/;
  
  return uuidPattern.test(id) || 
         objectIdPattern.test(id) || 
         (randomAlphanumericPattern.test(id) && id.length > 15);
}

/**
 * Middleware to validate that course ID parameter is a valid slug
 */
export function validateSlugParam(paramName: string = 'id') {
  return (req: any, res: any, next: any) => {
    const slugValue = req.params[paramName];
    
    if (!slugValue) {
      return res.status(400).json({
        success: false,
        message: `Missing ${paramName} parameter`,
        error: {
          code: 'MISSING_PARAMETER',
          details: `The ${paramName} parameter is required`
        }
      });
    }

    if (!isValidSlug(slugValue)) {
      logger.warn('Invalid slug format detected', { 
        slug: slugValue, 
        paramName,
        isLegacy: isLegacyId(slugValue)
      });
      
      return res.status(400).json({
        success: false,
        message: 'Invalid course identifier format',
        error: {
          code: 'INVALID_SLUG_FORMAT',
          details: 'Course identifiers must be lowercase, alphanumeric with hyphens (e.g., "aws-fundamentals")',
          provided: slugValue,
          expectedFormat: 'lowercase-slug-format'
        }
      });
    }

    // If it's a legacy ID, return a specific error
    if (isLegacyId(slugValue)) {
      logger.warn('Legacy ID usage detected', { 
        legacyId: slugValue, 
        paramName 
      });
      
      return res.status(410).json({
        success: false,
        message: 'Legacy course identifiers are no longer supported',
        error: {
          code: 'LEGACY_ID_NOT_SUPPORTED',
          details: 'Please use the course slug (e.g., "aws-fundamentals") instead of legacy IDs',
          legacyId: slugValue,
          migrationRequired: true
        }
      });
    }

    next();
  };
}

/**
 * Extract slug from various ID formats for migration purposes
 */
export function extractSlugFromLegacyUrl(url: string): string | null {
  // Extract slug from URLs like /courses/legacy-id or /courses/slug
  const match = url.match(/\/courses\/([^\/\?]+)/);
  if (!match) return null;
  
  const identifier = match[1];
  
  // If it's already a valid slug, return it
  if (isValidSlug(identifier)) {
    return identifier;
  }
  
  // If it's a legacy ID, we can't extract a slug from it
  if (isLegacyId(identifier)) {
    return null;
  }
  
  // Try to convert to slug format
  return identifier
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}