import { query, queryOne, getConnection } from '../config/database';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import messageQueue from '../config/queue';

export interface Campaign {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  description?: string;
  template_id: string;
  template_name?: string;
  template_code?: string;
  status: string;
  total_recipients: number;
  pending_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
  scheduled_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  send_rate: number;
  retry_failed: boolean;
  max_retries: number;
  retry_delay_minutes: number;
  created_at: Date;
  updated_at: Date;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  phone_number: string;
  customer_id?: string;
  variables: Record<string, any>;
  status: string;
  message_id?: string;
  whatsapp_message_id?: string;
  error_message?: string;
  retry_count: number;
  sent_at?: Date;
  delivered_at?: Date;
  read_at?: Date;
  failed_at?: Date;
}

export class CampaignService {
  // Create campaign with recipients
  async createCampaign(data: {
    tenant_id: string;
    user_id?: string;
    name: string;
    description?: string;
    template_id: string;
    recipients: Array<{
      phone_number: string;
      customer_id?: string;
      variables?: Record<string, any>;
    }>;
    scheduled_at?: Date;
    send_rate?: number;
    retry_failed?: boolean;
    max_retries?: number;
  }): Promise<Campaign> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Verify template exists and is approved
      const template = await queryOne<any>(
        `SELECT id, status, name, template_code FROM message_templates 
         WHERE id = ? AND tenant_id = ? AND status = 'approved'`,
        [data.template_id, data.tenant_id]
      );

      if (!template) {
        throw new Error('Template not found or not approved');
      }

      // Create campaign
      const campaignId = uuidv4();
      const status = data.scheduled_at ? 'scheduled' : 'draft';

      await connection.query(
        `INSERT INTO campaigns (
          id, tenant_id, user_id, name, description, template_id,
          status, scheduled_at, send_rate, retry_failed, max_retries,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          campaignId,
          data.tenant_id,
          data.user_id || null,
          data.name,
          data.description || null,
          data.template_id,
          status,
          data.scheduled_at || null,
          data.send_rate || 10,
          data.retry_failed !== false ? 1 : 0,
          data.max_retries || 3,
        ]
      );

      // Add recipients in batch
      if (data.recipients.length > 0) {
        const recipientValues = data.recipients.map(() => '(?, ?, ?, ?, ?)').join(', ');
        const recipientParams = data.recipients.flatMap((r) => [
          uuidv4(),
          campaignId,
          r.phone_number,
          r.customer_id || null,
          JSON.stringify(r.variables || {}),
        ]);

        await connection.query(
          `INSERT INTO campaign_recipients (id, campaign_id, phone_number, customer_id, variables)
           VALUES ${recipientValues}`,
          recipientParams
        );

        // Update campaign counts
        await connection.query(
          `UPDATE campaigns 
           SET total_recipients = ?, pending_count = ?
           WHERE id = ?`,
          [data.recipients.length, data.recipients.length, campaignId]
        );
      }

      // Log creation
      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'created', ?, ?, NOW())`,
        [
          uuidv4(),
          campaignId,
          `Campaign created with ${data.recipients.length} recipients`,
          data.user_id,
        ]
      );

      await connection.commit();

      logger.info('Campaign created', {
        campaignId,
        recipientCount: data.recipients.length,
        tenantId: data.tenant_id,
      });

      // Fetch and return the created campaign
      const campaign = await queryOne<Campaign>(
        `SELECT c.*, t.name as template_name, t.template_code
         FROM campaigns c
         LEFT JOIN message_templates t ON c.template_id = t.id
         WHERE c.id = ?`,
        [campaignId]
      );

      return campaign!;
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to create campaign', { error, data });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get campaigns with pagination
  async getCampaigns(
    tenant_id: string,
    filters?: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ campaigns: Campaign[]; total: number; page: number; limit: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT c.*, t.name as template_name, t.template_code
      FROM campaigns c
      LEFT JOIN message_templates t ON c.template_id = t.id
      WHERE c.tenant_id = ?
    `;
    const params: any[] = [tenant_id];

    if (filters?.status) {
      sql += ` AND c.status = ?`;
      params.push(filters.status);
    }

    sql += ` ORDER BY c.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const campaigns = await query<Campaign[]>(sql, params);

    const countSql = `
      SELECT COUNT(*) as total FROM campaigns 
      WHERE tenant_id = ?${filters?.status ? ' AND status = ?' : ''}
    `;
    const countParams = filters?.status ? [tenant_id, filters.status] : [tenant_id];
    const countResult = await query<any[]>(countSql, countParams);

    return {
      campaigns: campaigns || [],
      total: countResult[0]?.total || 0,
      page,
      limit,
    };
  }

  // Get campaign stats using stored procedure
  async getCampaignStats(tenant_id: string): Promise<any> {
    const result = await query<any[]>('CALL sp_get_campaign_stats(?)', [tenant_id]);
    return result[0][0]; // First result set, first row
  }

  // Get campaign by ID
  async getCampaignById(id: string, tenant_id: string): Promise<Campaign | null> {
    return await queryOne<Campaign>(
      `SELECT c.*, t.name as template_name, t.template_code
       FROM campaigns c
       LEFT JOIN message_templates t ON c.template_id = t.id
       WHERE c.id = ? AND c.tenant_id = ?`,
      [id, tenant_id]
    );
  }

  // Start campaign
  async startCampaign(campaign_id: string, tenant_id: string, user_id: string): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Get campaign
      const campaign = await queryOne<any>(
        'SELECT * FROM campaigns WHERE id = ? AND tenant_id = ?',
        [campaign_id, tenant_id]
      );

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!['draft', 'scheduled', 'paused'].includes(campaign.status)) {
        throw new Error(`Cannot start campaign with status: ${campaign.status}`);
      }

      if (campaign.pending_count === 0 && campaign.status !== 'paused') {
        throw new Error('No recipients to send to');
      }

      // Update campaign status
      await connection.query(
        `UPDATE campaigns 
         SET status = 'queued', started_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [campaign_id]
      );

      // Log event
      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'started', 'Campaign started', ?, NOW())`,
        [uuidv4(), campaign_id, user_id]
      );

      await connection.commit();

      // Queue campaign for processing
      await messageQueue.add(
        'process-campaign',
        {
          campaign_id,
          tenant_id,
          type: 'campaign',
        },
        {
          priority: 1,
          attempts: 1,
        }
      );

      logger.info('Campaign started and queued', { campaign_id, tenant_id });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to start campaign', { error, campaign_id });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Pause campaign
  async pauseCampaign(campaign_id: string, tenant_id: string, user_id: string): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [result]: any = await connection.query(
        `UPDATE campaigns 
         SET status = 'paused', paused_at = NOW(), updated_at = NOW()
         WHERE id = ? AND tenant_id = ? AND status IN ('sending', 'queued')`,
        [campaign_id, tenant_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Campaign not found or cannot be paused');
      }

      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'paused', 'Campaign paused', ?, NOW())`,
        [uuidv4(), campaign_id, user_id]
      );

      await connection.commit();

      logger.info('Campaign paused', { campaign_id, tenant_id });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to pause campaign', { error, campaign_id });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Resume campaign
  async resumeCampaign(campaign_id: string, tenant_id: string, user_id: string): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [result]: any = await connection.query(
        `UPDATE campaigns 
         SET status = 'queued', updated_at = NOW()
         WHERE id = ? AND tenant_id = ? AND status = 'paused'`,
        [campaign_id, tenant_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Campaign not found or cannot be resumed');
      }

      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'resumed', 'Campaign resumed', ?, NOW())`,
        [uuidv4(), campaign_id, user_id]
      );

      await connection.commit();

      // Re-queue campaign for processing
      await messageQueue.add(
        'process-campaign',
        {
          campaign_id,
          tenant_id,
          type: 'campaign',
        },
        {
          priority: 1,
        }
      );

      logger.info('Campaign resumed and re-queued', { campaign_id, tenant_id });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to resume campaign', { error, campaign_id });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Cancel campaign
  async cancelCampaign(campaign_id: string, tenant_id: string, user_id: string): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const [result]: any = await connection.query(
        `UPDATE campaigns 
         SET status = 'cancelled', updated_at = NOW()
         WHERE id = ? AND tenant_id = ? AND status IN ('draft', 'scheduled', 'paused')`,
        [campaign_id, tenant_id]
      );

      if (result.affectedRows === 0) {
        throw new Error('Campaign not found or cannot be cancelled');
      }

      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'cancelled', 'Campaign cancelled', ?, NOW())`,
        [uuidv4(), campaign_id, user_id]
      );

      await connection.commit();

      logger.info('Campaign cancelled', { campaign_id, tenant_id });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to cancel campaign', { error, campaign_id });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete campaign
  async deleteCampaign(campaign_id: string, tenant_id: string): Promise<void> {
    const result = await query<any>(
      `DELETE FROM campaigns 
       WHERE id = ? AND tenant_id = ? AND status IN ('draft', 'completed', 'failed', 'cancelled')`,
      [campaign_id, tenant_id]
    );

    if (result.affectedRows === 0) {
      throw new Error('Campaign not found or cannot be deleted');
    }

    logger.info('Campaign deleted', { campaign_id, tenant_id });
  }

  // Get campaign recipients
  async getCampaignRecipients(
    campaign_id: string,
    tenant_id: string,
    filters?: {
      status?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ recipients: CampaignRecipient[]; total: number }> {
    // Verify campaign belongs to tenant
    const campaign = await queryOne<any>(
      'SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?',
      [campaign_id, tenant_id]
    );

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM campaign_recipients WHERE campaign_id = ?';
    const params: any[] = [campaign_id];

    if (filters?.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const recipients = await query<CampaignRecipient[]>(sql, params);

    const countSql = `
      SELECT COUNT(*) as total FROM campaign_recipients 
      WHERE campaign_id = ?${filters?.status ? ' AND status = ?' : ''}
    `;
    const countParams = filters?.status ? [campaign_id, filters.status] : [campaign_id];
    const countResult = await query<any[]>(countSql, countParams);

    return {
      recipients: recipients || [],
      total: countResult[0]?.total || 0,
    };
  }

  // Add recipients to existing campaign
  async addRecipients(
    campaign_id: string,
    tenant_id: string,
    user_id: string,
    recipients: Array<{
      phone_number: string;
      customer_id?: string;
      variables?: Record<string, any>;
    }>
  ): Promise<void> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      // Verify campaign exists and is in draft/paused status
      const campaign = await queryOne<any>(
        `SELECT id, status FROM campaigns 
         WHERE id = ? AND tenant_id = ? AND status IN ('draft', 'paused')`,
        [campaign_id, tenant_id]
      );

      if (!campaign) {
        throw new Error('Campaign not found or cannot add recipients');
      }

      // Add recipients
      const recipientValues = recipients.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const recipientParams = recipients.flatMap((r) => [
        uuidv4(),
        campaign_id,
        r.phone_number,
        r.customer_id || null,
        JSON.stringify(r.variables || {}),
      ]);

      await connection.query(
        `INSERT INTO campaign_recipients (id, campaign_id, phone_number, customer_id, variables)
         VALUES ${recipientValues}
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        recipientParams
      );

      // Update campaign counts
      await connection.query(
        `UPDATE campaigns 
         SET 
           total_recipients = total_recipients + ?,
           pending_count = pending_count + ?,
           updated_at = NOW()
         WHERE id = ?`,
        [recipients.length, recipients.length, campaign_id]
      );

      // Log event
      await connection.query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, user_id, created_at)
         VALUES (?, ?, 'recipient_added', ?, ?, NOW())`,
        [uuidv4(), campaign_id, `Added ${recipients.length} recipients`, user_id]
      );

      await connection.commit();

      logger.info('Recipients added to campaign', {
        campaign_id,
        count: recipients.length,
      });
    } catch (error) {
      await connection.rollback();
      logger.error('Failed to add recipients', { error, campaign_id });
      throw error;
    } finally {
      connection.release();
    }
  }

  // Create analytics snapshot
  async createAnalyticsSnapshot(campaign_id: string): Promise<void> {
    await query('CALL sp_create_campaign_snapshot(?)', [campaign_id]);
    logger.info('Analytics snapshot created', { campaign_id });
  }

  // Get campaign analytics history
  async getCampaignAnalytics(campaign_id: string, tenant_id: string): Promise<any[]> {
    // Verify campaign belongs to tenant
    const campaign = await queryOne<any>(
      'SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?',
      [campaign_id, tenant_id]
    );

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return await query<any[]>(
      `SELECT * FROM campaign_analytics 
       WHERE campaign_id = ? 
       ORDER BY snapshot_at DESC 
       LIMIT 100`,
      [campaign_id]
    );
  }

  // Get campaign logs
  async getCampaignLogs(
    campaign_id: string,
    tenant_id: string,
    limit: number = 50
  ): Promise<any[]> {
    // Verify campaign belongs to tenant
    const campaign = await queryOne<any>(
      'SELECT id FROM campaigns WHERE id = ? AND tenant_id = ?',
      [campaign_id, tenant_id]
    );

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return await query<any[]>(
      `SELECT cl.*, u.email as user_email
       FROM campaign_logs cl
       LEFT JOIN users u ON cl.user_id = u.id
       WHERE cl.campaign_id = ? 
       ORDER BY cl.created_at DESC 
       LIMIT ?`,
      [campaign_id, limit]
    );
  }
}

export default new CampaignService();
