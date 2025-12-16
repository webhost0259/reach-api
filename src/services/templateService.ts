import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorMiddleware';
import logger from '../utils/logger';
import metaTemplateService from './metaTemplateService';
import {
  MessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  TemplateStatsResponse,
} from '../types/template.types';

class TemplateService {
  /**
   * Create a new message template
   */
  async createTemplate(
    userId: string,
    data: CreateTemplateRequest & { submit_to_meta?: boolean }
  ): Promise<MessageTemplate> {
    try {
      // Validate template code uniqueness
      const existing = await queryOne<{ id: string }>(
        'SELECT id FROM message_templates WHERE template_code = ?',
        [data.template_code]
      );

      if (existing) {
        throw new AppError('Template code already exists', 409);
      }

      // Validate body text has placeholders if example values provided
      if (data.example_values && data.example_values.length > 0) {
        const placeholderCount = (data.body_text.match(/\{\{\d+\}\}/g) || []).length;
        if (placeholderCount !== data.example_values.length) {
          throw new AppError(
            `Body text has ${placeholderCount} placeholders but ${data.example_values.length} example values provided`,
            400
          );
        }
      }

      const templateId = uuidv4();
      const initialStatus = data.submit_to_meta ? 'pending' : 'draft';

      await query(
        `INSERT INTO message_templates (
          id, user_id, name, template_code, language, category,
          header_type, header_content, body_text, footer_text,
          buttons, example_values, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          templateId,
          userId,
          data.name,
          data.template_code,
          data.language || 'en_US',
          data.category || 'utility',
          data.header_type || 'none',
          data.header_content || null,
          data.body_text,
          data.footer_text || null,
          data.buttons ? JSON.stringify(data.buttons) : null,
          data.example_values ? JSON.stringify(data.example_values) : null,
          initialStatus,
        ]
      );

      // Submit to Meta if requested
      if (data.submit_to_meta) {
        try {
          const metaResult = await metaTemplateService.submitTemplate(userId, {
            name: data.template_code,
            language: data.language || 'en_US',
            category: data.category || 'utility',
            header_type: data.header_type || 'none',
            header_content: data.header_content,
            body_text: data.body_text,
            footer_text: data.footer_text,
            buttons: data.buttons,
            example_values: data.example_values,
          });

          // Update with Meta template ID
          await query(
            `UPDATE message_templates 
             SET meta_template_id = ?, submitted_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [metaResult.id, templateId]
          );

          logger.info('Template submitted to Meta', {
            templateId,
            metaTemplateId: metaResult.id,
          });
        } catch (metaError: any) {
          // Update status to draft if submission failed
          await query(
            `UPDATE message_templates 
             SET status = 'draft', rejection_reason = ?, updated_at = NOW()
             WHERE id = ?`,
            [metaError.message, templateId]
          );

          logger.error('Failed to submit to Meta', { templateId, error: metaError });
          throw metaError; // Re-throw to inform user
        }
      }

      const template = await this.getTemplateById(templateId);

      if (!template) {
        throw new AppError('Failed to create template', 500);
      }

      logger.info('Template created', { templateId, userId, templateCode: data.template_code });

      return template;
    } catch (error) {
      logger.error('Failed to create template', { error, userId, data });
      throw error;
    }
  }

  /**
   * Submit existing draft template to Meta
   */
  async submitToMeta(userId: string, templateId: string): Promise<MessageTemplate> {
    console.log('📤 Submit to Meta called:', { userId, templateId });
    
    const template = await this.getTemplateById(templateId);

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized', 403);
    }

    if (template.status !== 'draft') {
      throw new AppError('Only draft templates can be submitted', 400);
    }

    // Get tenant_id from user
    const userResult: any = await query(
      'SELECT tenant_id FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult || userResult.length === 0) {
      throw new AppError('User not found', 404);
    }

    const tenantId = userResult[0].tenant_id;
    console.log('👤 User tenant_id:', tenantId);

    try {
      logger.info('Submitting template to Meta', { 
        userId, 
        tenantId, // Log tenant_id
        templateId, 
        templateName: template.name 
      });

      const metaResult = await metaTemplateService.submitTemplate(tenantId, { // Use tenantId instead of userId
        name: template.template_code,
        language: template.language,
        category: template.category,
        header_type: template.header_type || undefined,
        header_content: template.header_content || undefined,
        body_text: template.body_text,
        footer_text: template.footer_text || undefined,
        buttons: template.buttons,
        example_values: template.example_values,
      });

      await query(
        `UPDATE message_templates 
        SET status = 'pending', meta_template_id = ?, submitted_at = NOW(), updated_at = NOW()
        WHERE id = ?`,
        [metaResult.id, templateId]
      );

      logger.info('Template submitted to Meta successfully', { 
        templateId, 
        metaTemplateId: metaResult.id 
      });

      return (await this.getTemplateById(templateId)) as MessageTemplate;
    } catch (error: any) {
      logger.error('Failed to submit template to Meta', { 
        templateId, 
        userId,
        tenantId,
        error: error.message,
        stack: error.stack 
      });
      
      throw new AppError(
        error.message || 'Failed to submit template to Meta', 
        500
      );
    }
  }

  /**
   * Sync template status from Meta
   */
  async syncTemplateStatus(userId: string, templateId: string): Promise<MessageTemplate> {
    console.log('🔄 syncTemplateStatus called:', { userId, templateId });
    
    const template = await this.getTemplateById(templateId);

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized', 403);
    }

    if (!template.meta_template_id) {
      throw new AppError('Template has not been submitted to Meta', 400);
    }

    try {
      // Get tenant_id from user
      console.log('📊 Fetching tenant_id for user:', userId);
      
      const userResult: any = await query(
        'SELECT tenant_id FROM users WHERE id = ?',
        [userId]
      );

      console.log('👤 User query result:', userResult);

      if (!userResult || userResult.length === 0) {
        throw new AppError('User not found', 404);
      }

      const tenantId = userResult[0].tenant_id;

      if (!tenantId) {
        throw new AppError('User has no tenant_id', 500);
      }

      console.log('✅ Using tenant_id for Meta sync:', tenantId);

      // Get status from Meta - PASS tenantId, NOT userId
      const metaStatus = await metaTemplateService.getTemplateStatus(
        tenantId,  // ✅ This should be tenant_id
        template.meta_template_id
      );

      // Map Meta status to our status
      const statusMap: Record<string, string> = {
        'APPROVED': 'approved',
        'PENDING': 'pending',
        'REJECTED': 'rejected',
        'PAUSED': 'paused',
        'DISABLED': 'disabled',
      };

      const newStatus = statusMap[metaStatus.status] || 'pending';

      // Update template
      const updates: string[] = ['status = ?', 'last_synced_at = NOW()'];
      const params: any[] = [newStatus];

      if (newStatus === 'approved') {
        updates.push('approved_at = NOW()');
      }

      if (newStatus === 'rejected' && metaStatus.rejection_reason) {
        updates.push('rejection_reason = ?');
        params.push(metaStatus.rejection_reason);
      }

      params.push(templateId);

      await query(
        `UPDATE message_templates SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      logger.info('Template status synced', { 
        templateId, 
        oldStatus: template.status, 
        newStatus 
      });

      return (await this.getTemplateById(templateId)) as MessageTemplate;
    } catch (error: any) {
      logger.error('Failed to sync template status', { 
        templateId, 
        error: error.message,
        stack: error.stack 
      });
      throw new AppError(
        error.message || 'Failed to sync template status', 
        500
      );
    }
  }

  /**
   * Sync all pending templates from Meta
   */
  async syncAllTemplates(userId: string): Promise<{
    synced_count: number;
    error_count: number;
    synced_ids: string[];
    failed_ids: string[];
  }> {
    try {
      // Get all pending templates for user
      const templates: any = await query(
        `SELECT id, meta_template_id 
        FROM message_templates 
        WHERE user_id = ? AND status = 'pending' AND meta_template_id IS NOT NULL`,
        [userId]
      );

      if (!templates || templates.length === 0) {
        logger.info('No pending templates to sync', { userId });
        return {
          synced_count: 0,
          error_count: 0,
          synced_ids: [],
          failed_ids: [],
        };
      }

      const syncedIds: string[] = [];
      const failedIds: string[] = [];

      // Sync each template
      for (const template of templates) {
        try {
          await this.syncTemplateStatus(userId, template.id);
          syncedIds.push(template.id);
        } catch (error: any) {
          logger.error('Failed to sync template', { 
            templateId: template.id, 
            error: error.message 
          });
          failedIds.push(template.id);
        }
      }

      logger.info('Batch sync completed', {
        userId,
        total: templates.length,
        synced: syncedIds.length,
        failed: failedIds.length,
      });

      return {
        synced_count: syncedIds.length,
        error_count: failedIds.length,
        synced_ids: syncedIds,
        failed_ids: failedIds,
      };
    } catch (error: any) {
      logger.error('Failed to sync all templates', { userId, error: error.message });
      throw new AppError('Failed to sync templates', 500);
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<MessageTemplate | null> {
    const template = await queryOne<any>(
      `SELECT * FROM message_templates WHERE id = ?`,
      [templateId]
    );

    if (!template) {
      return null;
    }

    return this.formatTemplate(template);
  }

  /**
   * Get template by code and user
   */
  async getTemplateByCode(
    userId: string,
    templateCode: string
  ): Promise<MessageTemplate | null> {
    const template = await queryOne<any>(
      `SELECT * FROM message_templates WHERE user_id = ? AND template_code = ?`,
      [userId, templateCode]
    );

    if (!template) {
      return null;
    }

    return this.formatTemplate(template);
  }

  /**
   * List user's templates with filters
   */
  async listTemplates(
    userId: string,
    filters: {
      status?: string;
      category?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    templates: MessageTemplate[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build WHERE clause
    const conditions: string[] = ['user_id = ?'];
    const params: any[] = [userId];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.category) {
      conditions.push('category = ?');
      params.push(filters.category);
    }

    const whereClause = conditions.join(' AND ');

    // Get templates
    const templates = await query<any>(
      `SELECT * FROM message_templates 
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM message_templates WHERE ${whereClause}`,
      params
    );

    const total = countResult?.total || 0;

    return {
      templates: templates.map((t: any) => this.formatTemplate(t)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
/**
 * Update template
 */
async updateTemplate(
  userId: string,
  templateId: string,
  data: UpdateTemplateRequest
): Promise<MessageTemplate> {
  // Verify ownership
  const template = await queryOne<{ user_id: string; status: string }>(
    'SELECT user_id, status FROM message_templates WHERE id = ?',
    [templateId]
  );

  if (!template) {
    throw new AppError('Template not found', 404);
  }

  if (template.user_id !== userId) {
    throw new AppError('Not authorized to update this template', 403);
  }

  // Build update query dynamically
  const updates: string[] = [];
  const params: any[] = [];

  // Fields that can always be updated
  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  // Only allow content updates for draft templates
  if (template.status === 'draft') {
    if (data.template_code !== undefined) {
      updates.push('template_code = ?');
      params.push(data.template_code);
    }

    if (data.language !== undefined) {
      updates.push('language = ?');
      params.push(data.language);
    }

    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }

    if (data.header_type !== undefined) {
      updates.push('header_type = ?');
      params.push(data.header_type);
    }

    if (data.header_content !== undefined) {
      updates.push('header_content = ?');
      params.push(data.header_content || null);
    }

    if (data.body_text !== undefined) {
      updates.push('body_text = ?');
      params.push(data.body_text);
    }

    if (data.footer_text !== undefined) {
      updates.push('footer_text = ?');
      params.push(data.footer_text || null);
    }

    if (data.buttons !== undefined) {
      updates.push('buttons = ?');
      params.push(data.buttons ? JSON.stringify(data.buttons) : null);
    }

    if (data.example_values !== undefined) {
      updates.push('example_values = ?');
      params.push(data.example_values ? JSON.stringify(data.example_values) : null);
    }
  }

  // Admin/system fields (for syncing from Meta)
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);

    // Update approved_at when status changes to approved
    if (data.status === 'approved') {
      updates.push('approved_at = NOW()');
    }
  }

  if (data.rejection_reason !== undefined) {
    updates.push('rejection_reason = ?');
    params.push(data.rejection_reason || null);
  }

  if (data.meta_template_id !== undefined) {
    updates.push('meta_template_id = ?');
    params.push(data.meta_template_id);
  }

  if (updates.length === 0) {
    throw new AppError('No updates provided', 400);
  }

  updates.push('updated_at = NOW()');
  params.push(templateId);

  await query(
    `UPDATE message_templates SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  const updated = await this.getTemplateById(templateId);

  if (!updated) {
    throw new AppError('Failed to update template', 500);
  }

  logger.info('Template updated', { templateId, userId, isDraft: template.status === 'draft' });

  return updated;
}


  /**
   * Delete template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    // Verify ownership
    const template = await queryOne<{ user_id: string; template_code: string }>(
      'SELECT user_id, template_code FROM message_templates WHERE id = ?',
      [templateId]
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized to delete this template', 403);
    }

    // Try to delete from Meta (ignore errors)
    try {
      await metaTemplateService.deleteMetaTemplate(userId, template.template_code);
    } catch (error) {
      logger.warn('Failed to delete template from Meta', { templateId, error });
    }

    await query('DELETE FROM message_templates WHERE id = ?', [templateId]);

    logger.info('Template deleted', { templateId, userId });
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(userId: string): Promise<TemplateStatsResponse> {
    const stats = await query<any>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        SUM(CASE WHEN status = 'paused' THEN 1 ELSE 0 END) as paused,
        SUM(CASE WHEN status = 'disabled' THEN 1 ELSE 0 END) as disabled,
        category,
        COUNT(*) as category_count
      FROM message_templates
      WHERE user_id = ?
      GROUP BY category`,
      [userId]
    );

    const result = stats[0] || { 
      total: 0, 
      draft: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0,
      paused: 0,
      disabled: 0
    };
    
    const byCategory: Record<string, number> = {};

    stats.forEach((row: any) => {
      if (row.category) {
        byCategory[row.category] = row.category_count;
      }
    });

    return {
      total: Number(result.total) || 0,
      draft: Number(result.draft) || 0,
      pending: Number(result.pending) || 0,
      approved: Number(result.approved) || 0,
      rejected: Number(result.rejected) || 0,
      paused: Number(result.paused) || 0,
      disabled: Number(result.disabled) || 0,
      byCategory,
    };
  }


  /**
   * Format template from database row
   */
  private formatTemplate(row: any): MessageTemplate {
    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      template_code: row.template_code,
      language: row.language,
      category: row.category,
      status: row.status,
      header_type: row.header_type,
      header_content: row.header_content,
      body_text: row.body_text,
      footer_text: row.footer_text,
      buttons: row.buttons ? JSON.parse(row.buttons) : undefined,
      example_values: row.example_values ? JSON.parse(row.example_values) : undefined,
      rejection_reason: row.rejection_reason,
      meta_template_id: row.meta_template_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export default new TemplateService();
