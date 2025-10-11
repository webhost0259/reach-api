import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';

export const verifyWhatsAppWebhook = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

export const handleWhatsAppWebhook = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
});
