import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import templateService from '../services/templateService';
import { getAuthUser } from '../utils/helpers';

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const template = await templateService.createTemplate(user.userId, req.body);

  res.status(201).json({
    success: true,
    message: 'Template created successfully. Awaiting Meta approval.',
    data: template,
  });
});

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { status, category, page, limit } = req.query;

  const result = await templateService.listTemplates(user.userId, {
    status: status as any,
    category: category as any,
    page: page ? parseInt(page as string) : undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json({
    success: true,
    data: result.templates,
    pagination: result.pagination,
  });
});

export const getTemplate = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { templateId } = req.params;
  const template = await templateService.getTemplateById(templateId);

  if (!template) {
    res.status(404).json({
      success: false,
      error: 'Template not found',
    });
    return; // Explicit return to satisfy TypeScript
  }

  res.json({
    success: true,
    data: template,
  });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { templateId } = req.params;

  const template = await templateService.updateTemplate(user.userId, templateId, req.body);

  res.json({
    success: true,
    message: 'Template updated successfully',
    data: template,
  });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { templateId } = req.params;

  await templateService.deleteTemplate(user.userId, templateId);

  res.json({
    success: true,
    message: 'Template deleted successfully',
  });
});

export const getTemplateStats = asyncHandler(async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const stats = await templateService.getTemplateStats(user.userId);

  res.json({
    success: true,
    data: stats,
  });
});
