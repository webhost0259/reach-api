import { randomBytes } from 'crypto';
import { Request } from 'express';
import { JwtPayload } from 'jsonwebtoken';
import { AppError } from '../middleware/errorMiddleware';

/**
 * Generate a random string of specified length
 */
export function generateRandomString(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate client ID
 */
export function generateClientId(): string {
  return `client_${generateRandomString(16)}`;
}

/**
 * Generate client secret
 */
export function generateClientSecret(): string {
  return `secret_${generateRandomString(32)}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format phone number to E.164 format
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Paginate array
 */
export function paginate<T>(
  items: T[],
  page: number = 1,
  limit: number = 10
): { data: T[]; pagination: any } {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const end = start + limit;

  return {
    data: items.slice(start, end),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get authenticated user from request
 */
export function getAuthUser(req: Request): JwtPayload {
  const user = (req as any).user;
  if (!user) {
    throw new AppError('User not authenticated', 401);
  }
  return user as JwtPayload;
}
