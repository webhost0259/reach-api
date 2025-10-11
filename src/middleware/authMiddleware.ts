import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorMiddleware';
import authService from '../services/authService';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    throw new AppError('No token provided', 401);
  }

  try {
    const payload = authService.verifyToken(token);
    (req as any).user = payload; // Set user on request
    next();
  } catch (error) {
    throw new AppError('Invalid or expired token', 401);
  }
};
