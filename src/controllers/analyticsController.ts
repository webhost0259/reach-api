import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';

export const getAnalyticsSummary = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: {} });
});

export const getMessageStats = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true, data: {} });
});
