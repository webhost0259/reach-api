import dotenv from 'dotenv';
dotenv.config();

import { Job } from 'bull';
import messageQueue from '../config/queue';
import logger from '../utils/logger';
import { query, queryOne } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

interface CampaignJobData {
  campaign_id: string;
  tenant_id: string;
  type: 'campaign';
}

interface CampaignRecipientJobData {
  recipient_id: string;
  campaign_id: string;
  tenant_id: string;
  customer_id?: string;
  phone_number: string;
  variables: Record<string, any>;
  template_code: string;
  body_text: string;
  phone_number_id: string;
  access_token: string;
  max_retries: number;
  type: 'campaign-recipient';
}

class CampaignWorker {
  private concurrency: number;

  constructor() {
    this.concurrency = parseInt(process.env.CAMPAIGN_CONCURRENCY || '3', 10);
  }

  async start(): Promise<void> {
    logger.info('🚀 Starting campaign worker...', {
      concurrency: this.concurrency,
      nodeEnv: process.env.NODE_ENV,
    });

    // Process campaign jobs (queues recipients)
    messageQueue.process('process-campaign', this.concurrency, async (job: Job<CampaignJobData>) => {
      return await this.processCampaign(job);
    });

    // Process individual recipient messages
    messageQueue.process('send-campaign-message', 10, async (job: Job<CampaignRecipientJobData>) => {
      return await this.sendCampaignMessage(job);
    });

    // Event listeners
    messageQueue.on('completed', (job: Job, result: any) => {
      if (job.name === 'process-campaign') {
        logger.info(`✅ Campaign job ${job.id} completed`, {
          campaign_id: job.data.campaign_id,
          recipientsQueued: result.recipientsQueued,
        });
      } else if (job.name === 'send-campaign-message') {
        logger.info(`✅ Campaign message ${job.id} sent`, {
          recipient_id: job.data.recipient_id,
          phone_number: job.data.phone_number,
        });
      }
    });

    messageQueue.on('failed', (job: Job, err: Error) => {
      if (job.name === 'process-campaign') {
        logger.error(`❌ Campaign job ${job.id} failed`, {
          campaign_id: job.data.campaign_id,
          error: err.message,
        });
      } else if (job.name === 'send-campaign-message') {
        logger.error(`❌ Campaign message ${job.id} failed`, {
          recipient_id: job.data.recipient_id,
          error: err.message,
          attempts: job.attemptsMade,
        });
      }
    });

    logger.info('✅ Campaign worker is now processing jobs');
  }

  /**
   * Process campaign - queues all pending recipients
   */
  private async processCampaign(job: Job<CampaignJobData>): Promise<any> {
    const { campaign_id, tenant_id } = job.data;

    logger.info(`📊 Processing campaign ${campaign_id}`, { tenant_id });

    try {
      // Get campaign details with template
      const campaign = await queryOne<any>(
        `SELECT c.*, t.template_code, t.body_text, t.header_type, t.header_content, t.footer_text
         FROM campaigns c
         JOIN message_templates t ON c.template_id = t.id
         WHERE c.id = ? AND c.tenant_id = ?`,
        [campaign_id, tenant_id]
      );

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Check if campaign should continue
      if (!['queued', 'sending'].includes(campaign.status)) {
        logger.info('Campaign not in active status', { campaign_id, status: campaign.status });
        return { success: false, reason: 'Campaign not active' };
      }

      // Update status to sending
      await query(
        `UPDATE campaigns SET status = 'sending', updated_at = NOW() WHERE id = ?`,
        [campaign_id]
      );

      // Get WhatsApp config
      const config = await queryOne<any>(
        `SELECT test_phone_number_id, test_access_token, prod_phone_number_id, prod_access_token, environment
         FROM whatsapp_configs 
         WHERE tenant_id = ? AND is_active = 1`,
        [tenant_id]
      );

      if (!config) {
        throw new Error('WhatsApp not configured');
      }

      const isProduction = config.environment === 'production';
      const phoneNumberId = isProduction ? config.prod_phone_number_id : config.test_phone_number_id;
      const accessToken = isProduction ? config.prod_access_token : config.test_access_token;

      // Get next batch of recipients
      const batchSize = campaign.send_rate || 10;
      const recipientResults = await query<any[]>(
        'CALL sp_get_next_recipient_batch(?, ?)',
        [campaign_id, batchSize]
      );

      const recipients = recipientResults[0] || [];

      if (recipients.length === 0) {
        // Check if campaign is complete
        await query('CALL sp_check_campaign_completion(?)', [campaign_id]);
        logger.info('Campaign has no pending recipients', { campaign_id });
        return { success: true, recipientsQueued: 0, completed: true };
      }

      // Queue each recipient as separate job
      const jobPromises = recipients.map((recipient: any) => {
        const variables = typeof recipient.variables === 'string' 
          ? JSON.parse(recipient.variables) 
          : recipient.variables || {};

        return messageQueue.add(
          'send-campaign-message',
          {
            recipient_id: recipient.id,
            campaign_id,
            tenant_id,
            customer_id: recipient.customer_id,
            phone_number: recipient.phone_number,
            variables,
            template_code: campaign.template_code,
            body_text: campaign.body_text,
            phone_number_id: phoneNumberId,
            access_token: accessToken,
            max_retries: campaign.max_retries || 3,
            type: 'campaign-recipient',
          } as CampaignRecipientJobData,
          {
            attempts: campaign.max_retries || 3,
            backoff: {
              type: 'exponential',
              delay: (campaign.retry_delay_minutes || 5) * 60 * 1000,
            },
            removeOnComplete: true,
          }
        );
      });

      await Promise.all(jobPromises);

      logger.info('Queued recipient batch', {
        campaign_id,
        batchSize: recipients.length,
      });

      // If there are more recipients, re-queue the campaign job
      if (recipients.length === batchSize) {
        await messageQueue.add(
          'process-campaign',
          {
            campaign_id,
            tenant_id,
            type: 'campaign',
          } as CampaignJobData,
          {
            delay: 1000, // Wait 1 second before processing next batch
            priority: 2,
            removeOnComplete: true,
          }
        );
      } else {
        // Last batch, check completion
        await query('CALL sp_check_campaign_completion(?)', [campaign_id]);
      }

      return { success: true, recipientsQueued: recipients.length };

    } catch (error) {
      logger.error('Campaign processing failed', { error, campaign_id });

      await query(
        `UPDATE campaigns SET status = 'failed', updated_at = NOW() WHERE id = ?`,
        [campaign_id]
      );

      throw error;
    }
  }

  /**
   * Send message to single campaign recipient
   */
  private async sendCampaignMessage(job: Job<CampaignRecipientJobData>): Promise<any> {
    const {
      recipient_id,
      campaign_id,
      tenant_id,
      customer_id,
      phone_number,
      variables,
      template_code,
      body_text,
      phone_number_id,
      access_token,
    } = job.data;

    logger.info(`📤 Sending campaign message`, {
      recipient_id,
      phone_number,
      template_code,
      attempt: job.attemptsMade + 1,
    });

    try {
      // Replace variables in template
      let finalBodyText = body_text;
      Object.keys(variables).forEach((key) => {
        const placeholder = `{{${key}}}`;
        finalBodyText = finalBodyText.replace(new RegExp(placeholder, 'g'), variables[key]);
      });

      // Send via WhatsApp API
      const whatsappMessageId = await this.sendWhatsAppMessage(
        phone_number_id,
        access_token,
        phone_number,
        template_code
      );

      // Create message record
      const messageId = uuidv4();
      await query(
        `INSERT INTO messages (
          id, tenant_id, customer_id, phone_number, content, template_code,
          status, external_message_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'sent', ?, NOW())`,
        [
          messageId,
          tenant_id,
          customer_id || null,
          phone_number,
          finalBodyText,
          template_code,
          whatsappMessageId,
        ]
      );

      // Update recipient status
      await query(
        'CALL sp_update_recipient_status(?, ?, ?, ?, ?)',
        [recipient_id, 'sent', messageId, whatsappMessageId, null]
      );

      logger.info('Campaign message sent successfully', {
        recipient_id,
        phone_number,
        message_id: messageId,
        whatsapp_message_id: whatsappMessageId,
      });

      return {
        success: true,
        recipient_id,
        message_id: messageId,
        whatsapp_message_id: whatsappMessageId,
      };

    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to send campaign message', {
        error: errorMessage,
        recipient_id,
        phone_number,
        attempt: job.attemptsMade + 1,
      });

      const isFinalAttempt = job.attemptsMade >= ((job.opts.attempts || 3) - 1);
      
      if (isFinalAttempt) {
        // Final failure - update as failed
        await query(
          'CALL sp_update_recipient_status(?, ?, ?, ?, ?)',
          [recipient_id, 'failed', null, null, errorMessage]
        );

        logger.error('Campaign message failed permanently', {
          recipient_id,
          totalAttempts: job.attemptsMade + 1,
          error: errorMessage,
        });
      }

      throw error; // Re-throw for Bull to handle retry
    }
  }

  /**
   * Send WhatsApp template message via API
   */
  private async sendWhatsAppMessage(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    templateName: string
  ): Promise<string> {
    try {
      const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'WhatsApp API error');
      }

      return data.messages[0].id;

    } catch (error: any) {
      logger.error('WhatsApp API error', { error: error.message, to, templateName });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping campaign worker...');
    // Queue will be closed by main worker
  }

  /**
   * Get campaign worker status
   */
  async getStatus(): Promise<{
    campaigns: { waiting: number; active: number };
    messages: { waiting: number; active: number };
  }> {
    const campaignJobs = await messageQueue.getJobs(['waiting', 'active'], 0, -1);
    const campaignWaiting = campaignJobs.filter(j => j.name === 'process-campaign' && j.getState() === 'waiting').length;
    const campaignActive = campaignJobs.filter(j => j.name === 'process-campaign' && j.getState() === 'active').length;
    
    const messageWaiting = campaignJobs.filter(j => j.name === 'send-campaign-message' && j.getState() === 'waiting').length;
    const messageActive = campaignJobs.filter(j => j.name === 'send-campaign-message' && j.getState() === 'active').length;

    return {
      campaigns: { waiting: campaignWaiting, active: campaignActive },
      messages: { waiting: messageWaiting, active: messageActive },
    };
  }
}

export default new CampaignWorker();
