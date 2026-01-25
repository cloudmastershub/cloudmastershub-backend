import crypto from 'crypto';

/**
 * Converts a NextAuth string user ID to a deterministic UUID format.
 *
 * NextAuth generates user IDs like "google_mbuaku_gmail_com" but our
 * PostgreSQL schema expects UUID format. This function creates a
 * deterministic UUID v5-like hash from the string ID.
 *
 * @param nextAuthUserId - The user ID from NextAuth (e.g., "google_mbuaku_gmail_com")
 * @returns A valid UUID string (e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890")
 */
export function convertToUuid(nextAuthUserId: string): string {
  // If it's already a valid UUID, return as-is
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(nextAuthUserId)) {
    return nextAuthUserId.toLowerCase();
  }

  // Namespace UUID for CloudMastersHub user IDs (randomly generated, fixed)
  const NAMESPACE = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  // Create a SHA-1 hash of namespace + userId (similar to UUID v5)
  const hash = crypto
    .createHash('sha1')
    .update(NAMESPACE + nextAuthUserId)
    .digest('hex');

  // Format as UUID (8-4-4-4-12)
  const uuid = [
    hash.substring(0, 8),
    hash.substring(8, 12),
    // Set version to 5 (name-based SHA-1)
    '5' + hash.substring(13, 16),
    // Set variant bits
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') + hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-');

  return uuid;
}

/**
 * Converts a UUID back to check if it matches a given NextAuth ID.
 * Useful for debugging and verification.
 */
export function verifyUserIdMatch(nextAuthUserId: string, uuid: string): boolean {
  return convertToUuid(nextAuthUserId) === uuid.toLowerCase();
}
