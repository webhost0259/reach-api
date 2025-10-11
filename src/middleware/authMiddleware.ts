import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorMiddleware';

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new AppError('No token provided', 401);
  }

  // TODO: Implement JWT verification
  next();
};
