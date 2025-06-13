import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};

export interface TokenPayload {
  userId: string;
  email: string;
  roles?: string[];
}

export const generateToken = (
  payload: TokenPayload,
  secret: string,
  expiresIn: string = '15m'
): string => {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign(payload, secret, options);
};

export const verifyToken = (token: string, secret: string): TokenPayload => {
  return jwt.verify(token, secret) as TokenPayload;
};

export const generateRefreshToken = (
  userId: string,
  secret: string,
  expiresIn: string = '30d'
): string => {
  const options: SignOptions = { expiresIn: expiresIn as any };
  return jwt.sign({ userId, type: 'refresh' }, secret, options);
};
