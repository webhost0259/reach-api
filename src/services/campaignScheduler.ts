import { query } from '../config/database';
import logger from '../utils/logger';
import messageQueue from '../config/queue';
import { v4 as uuidv4 } from 'uuid';

class CampaignScheduler {
  private schedulerInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.schedulerInterval) {
      logger.warn('Campaign scheduler already running');
      return;
    }

    logger.info('🕐 Starting campaign scheduler');

    // Check every 30 seconds
    this.schedulerInterval = setInterval(() => {
      this.checkScheduledCampaigns();
    }, 30000);

    // Run immediately
    this.checkScheduledCampaigns();
  }

  stop() {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      logger.info('Campaign scheduler stopped');
    }
  }

  private async checkScheduledCampaigns() {
    try {
      const campaigns = await query<any[]>('CALL sp_get_scheduled_campaigns()');
      
      if (!campaigns || !campaigns[0] || campaigns[0].length === 0) {
        return;
      }

      logger.info(`Found ${campaigns[0].length} scheduled campaigns ready to start`);

      for (const campaign of campaigns[0]) {
        await this.startScheduledCampaign(campaign.id, campaign.tenant_id);
      }
    } catch (error) {
      logger.error('Error checking scheduled campaigns', { error });
    }
  }

  private async startScheduledCampaign(campaign_id: string, tenant_id: string) {
    try {
      // Update status to queued
      await query(
        `UPDATE campaigns 
         SET status = 'queued', started_at = NOW(), updated_at = NOW()
         WHERE id = ? AND status = 'scheduled'`,
        [campaign_id]
      );

      // Log event
      await query(
        `INSERT INTO campaign_logs (id, campaign_id, event_type, message, created_at)
         VALUES (?, ?, 'started', 'Campaign auto-started from schedule', NOW())`,
        [uuidv4(), campaign_id]
      );

      // Queue for processing
      await messageQueue.add(
        'process-campaign',
        {
          campaign_id,
          tenant_id,
          type: 'campaign',
        },
        {
          priority: 1,
          removeOnComplete: true,
        }
      );

      logger.info('✅ Scheduled campaign auto-started', { campaign_id, tenant_id });
    } catch (error) {
      logger.error('Failed to start scheduled campaign', { error, campaign_id });
    }
  }
}

export default new CampaignScheduler();
