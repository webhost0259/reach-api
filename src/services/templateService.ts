import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import { AppError } from '../middleware/errorMiddleware';
import logger from '../utils/logger';
import {
  MessageTemplate,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '../types';

class TemplateService {
  /**
   * Create a new message template
   */
  async createTemplate(
    userId: string,
    data: CreateTemplateRequest
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

      await query(
        `INSERT INTO message_templates (
          id, user_id, name, template_code, language, category,
          header_type, header_content, body_text, footer_text,
          buttons, example_values, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
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
        ]
      );

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
      status?: 'pending' | 'approved' | 'rejected';
      category?: 'marketing' | 'utility' | 'authentication';
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
      pagination: { // Parameter 't' implicitly has an 'any' type.
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
    const template = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM message_templates WHERE id = ?',
      [templateId]
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized to update this template', 403);
    }

    // Build update query
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.status) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (data.rejection_reason) {
      updates.push('rejection_reason = ?');
      params.push(data.rejection_reason);
    }

    if (data.meta_template_id) {
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

    logger.info('Template updated', { templateId, userId });

    return updated;
  }

  /**
   * Delete template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    // Verify ownership
    const template = await queryOne<{ user_id: string }>(
      'SELECT user_id FROM message_templates WHERE id = ?',
      [templateId]
    );

    if (!template) {
      throw new AppError('Template not found', 404);
    }

    if (template.user_id !== userId) {
      throw new AppError('Not authorized to delete this template', 403);
    }

    await query('DELETE FROM message_templates WHERE id = ?', [templateId]);

    logger.info('Template deleted', { templateId, userId });
  }

  /**
   * Get template statistics
   */
  async getTemplateStats(userId: string): Promise<{
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    byCategory: Record<string, number>;
  }> {
    const stats = await query<any>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected,
        category,
        COUNT(*) as category_count
       FROM message_templates
       WHERE user_id = ?
       GROUP BY category`,
      [userId]
    );

    const result = stats[0] || { total: 0, pending: 0, approved: 0, rejected: 0 };
    const byCategory: Record<string, number> = {};

    stats.forEach((row: any) => {
      if (row.category) {
        byCategory[row.category] = row.category_count;
      }
    });

    return {
      total: Number(result.total) || 0,
      pending: Number(result.pending) || 0,
      approved: Number(result.approved) || 0,
      rejected: Number(result.rejected) || 0,
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
