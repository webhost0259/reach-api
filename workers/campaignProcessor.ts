import { Job } from 'bull';
import { query, queryOne } from '../src/config/database';
import logger from '../src/utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { CampaignJobData } from '../src/types/message.types';
import whatsappConfigService from '../src/services/whatsAppConfigService';

export async function processCampaign(job: Job<CampaignJobData>): Promise<void> {
  const { campaign_id, tenant_id } = job.data;

  if (!campaign_id || !tenant_id) {
    const error = 'Missing required campaign data: campaign_id or tenant_id';
    logger.error(error, { jobData: job.data });
    throw new Error(error);
  }

  logger.info('📤 Processing campaign', { campaign_id, tenant_id });

  try {
    // 1. Get campaign details with template variables
    const campaign = await queryOne<any>(
      `SELECT c.*, t.template_code, t.language, t.body_text, t.header_type, t.header_content
       FROM campaigns c
       LEFT JOIN message_templates t ON c.template_id = t.id
       WHERE c.id = ? AND c.tenant_id = ?`,
      [campaign_id, tenant_id]
    );

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    logger.info('Campaign loaded', {
      campaign_id,
      name: campaign.name,
      status: campaign.status,
      template: campaign.template_code,
      recipients: campaign.total_recipients,
    });

    if (campaign.status !== 'queued') {
      logger.warn('Campaign not in queued status', { 
        campaign_id, 
        status: campaign.status 
      });
      return;
    }

    // 2. Get WhatsApp config
    logger.info('📡 Fetching WhatsApp configuration...', { tenant_id });
    const whatsappConfig = await whatsappConfigService.getActiveConfig(tenant_id);

    logger.info('✅ WhatsApp config loaded', { 
      environment: whatsappConfig.environment,
      phoneNumberId: whatsappConfig.phoneNumberId.substring(0, 10) + '...',
    });

    // 3. Update campaign status to sending
    await query(
      `UPDATE campaigns 
       SET status = 'sending', updated_at = NOW()
       WHERE id = ?`,
      [campaign_id]
    );

    logger.info('✅ Campaign status → sending', { campaign_id });

    // 4. Get recipients with their variables
    const recipients = await query<any[]>(
      `SELECT * FROM campaign_recipients
       WHERE campaign_id = ?
         AND status = 'pending'
       ORDER BY created_at ASC`,
      [campaign_id]
    );

    if (!recipients || recipients.length === 0) {
      logger.warn('No recipients to process', { campaign_id });
      await query(
        `UPDATE campaigns 
         SET status = 'completed', completed_at = NOW(), updated_at = NOW()
         WHERE id = ?`,
        [campaign_id]
      );
      return;
    }

    logger.info(`📦 Processing ${recipients.length} recipients`, { campaign_id });

    // ✅ Parse template_variables from campaign
    let templateVariablesConfig = null;
    try {
      if (campaign.template_variables) {
        templateVariablesConfig = typeof campaign.template_variables === 'string'
          ? JSON.parse(campaign.template_variables)
          : campaign.template_variables;
      }
    } catch (e) {
      logger.error('Failed to parse template_variables', { error: e });
    }

    const batchSize = campaign.send_rate || 10;
    const delayMs = 60000 / batchSize;

    // 5. Process each recipient
    for (const recipient of recipients) {
      try {
        await query(
          `UPDATE campaign_recipients 
           SET status = 'queued', queued_at = NOW()
           WHERE id = ?`,
          [recipient.id]
        );

        // ✅ Parse recipient variables
        let recipientVariables: Record<string, string> = {};
        try {
          recipientVariables = typeof recipient.variables === 'string'
            ? JSON.parse(recipient.variables)
            : recipient.variables || {};
        } catch (e) {
          logger.error('Failed to parse recipient variables', { 
            recipient_id: recipient.id,
            error: e 
          });
        }

        // ✅ Build template components with parameters
        const templateComponents: any[] = [];

        // Add header component if exists
        if (campaign.header_type && campaign.header_type !== 'none') {
          if (campaign.header_type === 'text' && templateVariablesConfig?.header) {
            // Header has variables
            const headerParams = templateVariablesConfig.header.map((param: any) => ({
              type: 'text',
              text: recipientVariables[param.name] || param.sample || ''
            }));
            
            templateComponents.push({
              type: 'header',
              parameters: headerParams
            });
          }
        }

        // ✅ Add body component with parameters
        if (templateVariablesConfig?.body && templateVariablesConfig.body.length > 0) {
          const bodyParams = templateVariablesConfig.body
            .sort((a: any, b: any) => a.position - b.position)
            .map((param: any) => ({
              type: 'text',
              text: recipientVariables[param.name] || param.sample || ''
            }));

          templateComponents.push({
            type: 'body',
            parameters: bodyParams
          });

          logger.info('📝 Template parameters prepared', {
            campaign_id,
            recipient: recipient.phone_number,
            params: bodyParams.map((p: { text: any; }) => p.text),
          });
        }

        // Add button component if exists
        if (templateVariablesConfig?.button && templateVariablesConfig.button.length > 0) {
          const buttonParams = templateVariablesConfig.button.map((param: any) => ({
            type: 'text',
            text: recipientVariables[param.name] || param.sample || ''
          }));
          
          templateComponents.push({
            type: 'button',
            sub_type: 'url',
            index: 0,
            parameters: buttonParams
          });
        }

        // ✅ Build WhatsApp message payload with components
        const messagePayload: any = {
          messaging_product: 'whatsapp',
          to: recipient.phone_number,
          type: 'template',
          template: {
            name: campaign.template_code,
            language: {
              code: campaign.language || 'en_US',
            },
          },
        };

        // Only add components if there are any
        if (templateComponents.length > 0) {
          messagePayload.template.components = templateComponents;
        }

        logger.info(`📤 Sending to ${recipient.phone_number}...`, {
          campaign_id,
          template: campaign.template_code,
          components: templateComponents.length,
          payload: JSON.stringify(messagePayload, null, 2),
        });

        // ✅ Send via WhatsApp API
        const response = await axios.post(
          `https://graph.facebook.com/v21.0/${whatsappConfig.phoneNumberId}/messages`,
          messagePayload,
          {
            headers: {
              'Authorization': `Bearer ${whatsappConfig.accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        const whatsappMessageId = response.data.messages[0].id;

        // Update recipient to sent
        await query(
          `UPDATE campaign_recipients 
           SET status = 'sent', 
               whatsapp_message_id = ?,
               sent_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [whatsappMessageId, recipient.id]
        );

        // Update campaign counters
        await query(
          `UPDATE campaigns 
           SET sent_count = sent_count + 1,
               pending_count = GREATEST(pending_count - 1, 0),
               messages_sent_today = messages_sent_today + 1,
               last_message_sent_at = NOW(),
               updated_at = NOW()
           WHERE id = ?`,
          [campaign_id]
        );

        logger.info('✅ Message sent successfully', {
          campaign_id,
          phone: recipient.phone_number,
          wamid: whatsappMessageId,
        });

        // Rate limiting delay
        await sleep(delayMs);

      } catch (error: any) {
        logger.error('❌ Failed to send message', {
          campaign_id,
          recipient_id: recipient.id,
          phone: recipient.phone_number,
          error: error.message,
          response: error.response?.data,
        });

        // Update recipient to failed
        await query(
          `UPDATE campaign_recipients 
           SET status = 'failed',
               error_message = ?,
               failed_at = NOW(),
               retry_count = retry_count + 1,
               updated_at = NOW()
           WHERE id = ?`,
          [error.message, recipient.id]
        );

        // Update campaign counters
        await query(
          `UPDATE campaigns 
           SET failed_count = failed_count + 1,
               pending_count = GREATEST(pending_count - 1, 0),
               updated_at = NOW()
           WHERE id = ?`,
          [campaign_id]
        );

        // Schedule retry if enabled
        if (campaign.retry_failed && recipient.retry_count < campaign.max_retries) {
          const retryDelay = campaign.retry_delay_minutes || 5;
          await query(
            `UPDATE campaign_recipients 
             SET status = 'pending',
                 next_retry_at = DATE_ADD(NOW(), INTERVAL ? MINUTE)
             WHERE id = ?`,
            [retryDelay, recipient.id]
          );
          logger.info(`🔄 Retry scheduled for recipient ${recipient.id}`, {
            retry_at: `+${retryDelay} minutes`,
          });
        }
      }
    }

    // 6. Mark campaign as completed
    await query(
      `UPDATE campaigns 
       SET status = 'completed',
           completed_at = NOW(),
           updated_at = NOW()
       WHERE id = ?`,
      [campaign_id]
    );

    // 7. Get final counts for logging
    const finalCampaign = await queryOne<any>(
      'SELECT sent_count, failed_count, total_recipients FROM campaigns WHERE id = ?',
      [campaign_id]
    );

    // 8. Create analytics snapshot
    try {
      await query('CALL sp_create_campaign_snapshot(?)', [campaign_id]);
    } catch (error) {
      logger.warn('Failed to create analytics snapshot', { error });
    }

    // 9. Log completion
    await query(
      `INSERT INTO campaign_logs (id, campaign_id, event_type, message, created_at)
       VALUES (?, ?, 'completed', ?, NOW())`,
      [
        uuidv4(), 
        campaign_id, 
        `Campaign completed. Sent: ${finalCampaign?.sent_count || 0}, Failed: ${finalCampaign?.failed_count || 0}`
      ]
    );

    logger.info('🎉 Campaign completed successfully', {
      campaign_id,
      total: finalCampaign?.total_recipients || 0,
      sent: finalCampaign?.sent_count || 0,
      failed: finalCampaign?.failed_count || 0,
    });

  } catch (error: any) {
    logger.error('💥 Campaign processing failed', {
      campaign_id,
      error: error.message,
      stack: error.stack,
    });

    // Update campaign status to failed
    await query(
      `UPDATE campaigns 
       SET status = 'failed', updated_at = NOW()
       WHERE id = ?`,
      [campaign_id]
    );

    // Log error
    await query(
      `INSERT INTO campaign_logs (id, campaign_id, event_type, message, created_at)
       VALUES (?, ?, 'failed', ?, NOW())`,
      [uuidv4(), campaign_id, error.message]
    );

    throw error;
  }
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
