import {
  createAccessToken,
  createRefreshToken,
  verifyToken as libVerifyToken,
  hashPassword as libHashPassword,
  verifyPassword,
  type TokenPayload,
  type VerifiedToken,
  type TokenOptions,
} from '@elites-systems/auth';

// Re-export library types and functions for ecosystem-wide use
export {
  createAccessToken,
  createRefreshToken,
  verifyPassword,
  type TokenPayload,
  type VerifiedToken,
  type TokenOptions,
};

// Re-export with CMH naming conventions for backward compatibility
export const hashPassword = libHashPassword;
export const comparePassword = verifyPassword;

/**
 * Verify a JWT token and return the decoded payload.
 * Supports both new (sub) and legacy (userId) token formats.
 */
export const verifyToken = (token: string, secret: string): VerifiedToken & { userId?: string } => {
  const decoded = libVerifyToken(token, secret);
  // Backward compatibility: expose sub as userId for services that read it
  return { ...decoded, userId: decoded.sub };
};

/**
 * @deprecated Use createAccessToken from @elites-systems/auth instead.
 * Maintained for backward compatibility during migration.
 */
export const generateToken = (
  payload: { userId: string; email: string; roles?: string[] },
  secret: string,
  expiresIn: string = '15m'
): string => {
  const seconds = parseExpiry(expiresIn);
  return createAccessToken(
    {
      sub: payload.userId,
      email: payload.email,
      role: payload.roles?.[0] || 'student',
      iss: 'cloudmastershub',
      roles: payload.roles,
    },
    secret,
    { expiresIn: seconds }
  );
};

/**
 * @deprecated Use createRefreshToken from @elites-systems/auth instead.
 * Maintained for backward compatibility during migration.
 */
export const generateRefreshToken = (
  userId: string,
  secret: string,
  expiresIn: string = '30d'
): string => {
  const seconds = parseExpiry(expiresIn);
  return createRefreshToken(
    {
      sub: userId,
      email: '',
      role: 'user',
      iss: 'cloudmastershub',
    },
    secret,
    { expiresIn: seconds }
  );
};

/** Parse time strings like '15m', '1h', '30d' into seconds */
function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) return 3600;
  const [, value, unit] = match;
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return parseInt(value) * (multipliers[unit] || 3600);
}
