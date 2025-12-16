import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import templateService from '../services/templateService';
import { AppError } from '../middleware/errorMiddleware';

/**
 * Create template
 */
export const createTemplate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    console.log('📝 Creating template for user:', userId);

    const template = await templateService.createTemplate(userId, req.body);

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List templates
 */
export const listTemplates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    console.log('📋 Listing templates for user:', userId);

    const { status, category, page = 1, limit = 20 } = req.query;

    const templates = await templateService.listTemplates(userId, {
      status: status as string,
      category: category as string,
      page: Number(page),
      limit: Number(limit),
    });

    res.status(200).json({
      success: true,
      data: templates,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get template by ID
 */
export const getTemplate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { templateId } = req.params;

    const template = await templateService.getTemplateById(templateId);

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized to view this template', 403);
    }

    res.status(200).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update template
 */
export const updateTemplate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { templateId } = req.params;

    const template = await templateService.updateTemplate(userId, templateId, req.body);

    res.status(200).json({
      success: true,
      message: 'Template updated successfully',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete template
 */
export const deleteTemplate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { templateId } = req.params;

    await templateService.deleteTemplate(userId, templateId);

    res.status(200).json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit template to Meta
 */
export const submitToMeta = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { templateId } = req.params;

    console.log('🚀 Submitting template to Meta:', { userId, templateId });

    const template = await templateService.submitToMeta(userId, templateId);

    res.status(200).json({
      success: true,
      message: 'Template submitted to Meta for approval',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync template status from Meta
 */
export const syncTemplateStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    const { templateId } = req.params;

    console.log('🔄 Syncing template status:', { userId, templateId });

    const template = await templateService.syncTemplateStatus(userId, templateId);

    res.status(200).json({
      success: true,
      message: 'Template status synced from Meta',
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sync all templates
 */
export const syncAllTemplates = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    console.log('🔄 Syncing all templates for user:', userId);

    const result = await templateService.syncAllTemplates(userId);

    res.status(200).json({
      success: true,
      message: `Synced ${result.synced_count} templates`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get template stats
 */
export const getTemplateStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      throw new AppError('User not authenticated', 401);
    }

    console.log('📊 Getting template stats for user:', userId);

    const stats = await templateService.getTemplateStats(userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};
