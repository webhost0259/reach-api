import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import messageService from '../services/messageService';
import { getAuthUser } from '../utils/helpers';

export const sendMessage = asyncHandler(async (req: Request, res: Response) => {
  const { phone_number, content, template_id } = req.body;
  const user = getAuthUser(req);

  const result = await messageService.sendMessage(user.userId, phone_number, content, template_id);

  res.status(200).json({
    success: true,
    message: 'Message queued successfully',
    data: result,
  });
});

export const sendBulkMessages = asyncHandler(async (req: Request, res: Response) => {
  const { messages } = req.body;
  const user = getAuthUser(req);

  const result = await messageService.sendBulkMessages(user.userId, messages);

  res.status(200).json({
    success: true,
    message: 'Bulk messages queued successfully',
    data: result,
  });
});

export const getMessageById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = getAuthUser(req);

  const message = await messageService.getMessageById(id, user.userId);

  res.status(200).json({
    success: true,
    data: message,
  });
});

export const getMessages = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const status = req.query.status as string;
  const from = req.query.from as string;
  const to = req.query.to as string;

  const result = await messageService.getMessages(user.userId, page, limit, status, from, to);

  res.status(200).json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

export const scheduleMessage = asyncHandler(async (req: Request, res: Response) => {
  const { phone_number, content, scheduled_at, template_id } = req.body;
  const user = getAuthUser(req);

  const scheduledDate = new Date(scheduled_at);

  const result = await messageService.scheduleMessage(
    user.userId,
    phone_number,
    content,
    scheduledDate,
    template_id
  );

  res.status(200).json({
    success: true,
    message: 'Message scheduled successfully',
    data: result,
  });
});
