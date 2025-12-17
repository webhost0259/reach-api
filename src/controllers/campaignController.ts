import { Request, Response } from 'express';
import campaignService from '../services/campaignService';
import logger from '../utils/logger';

class CampaignController {
  // Create campaign
  async createCampaign(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { 
        name, 
        description, 
        template_id, 
        template_variables,  // ✅ ADD THIS
        recipients, 
        scheduled_at, 
        send_rate, 
        retry_failed, 
        max_retries 
      } = req.body;

      const campaign = await campaignService.createCampaign({
        tenant_id,
        user_id,
        name,
        description,
        template_id,
        template_variables,  // ✅ ADD THIS
        recipients,
        scheduled_at: scheduled_at ? new Date(scheduled_at) : undefined,
        send_rate,
        retry_failed,
        max_retries,
      });

      return res.status(201).json({
        success: true,
        message: 'Campaign created successfully',
        data: campaign,
      });
    } catch (error: any) {
      logger.error('Error creating campaign', { error: error.message, body: req.body });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create campaign',
      });
    }
  }

  // Get all campaigns
  async getCampaigns(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { status, page, limit } = req.query;

      const result = await campaignService.getCampaigns(tenant_id, {
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json({
        success: true,
        data: result.campaigns,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error: any) {
      logger.error('Error getting campaigns', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaigns',
      });
    }
  }

  // Get campaign stats
  async getCampaignStats(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;

      const stats = await campaignService.getCampaignStats(tenant_id);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting campaign stats', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaign stats',
      });
    }
  }

  // Get campaign by ID
  async getCampaignById(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;

      const campaign = await campaignService.getCampaignById(id, tenant_id);

      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
      }

      return res.json({  // ✅ Added return
        success: true,
        data: campaign,
      });
    } catch (error: any) {
      logger.error('Error getting campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaign',
      });
    }
  }

  // Start campaign
  async startCampaign(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { id } = req.params;

      await campaignService.startCampaign(id, tenant_id, user_id);

      return res.json({
        success: true,
        message: 'Campaign started successfully and queued for processing',
      });
    } catch (error: any) {
      logger.error('Error starting campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to start campaign',
      });
    }
  }

  // Pause campaign
  async pauseCampaign(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { id } = req.params;

      await campaignService.pauseCampaign(id, tenant_id, user_id);

      return res.json({
        success: true,
        message: 'Campaign paused successfully',
      });
    } catch (error: any) {
      logger.error('Error pausing campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to pause campaign',
      });
    }
  }

  // Resume campaign
  async resumeCampaign(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { id } = req.params;

      await campaignService.resumeCampaign(id, tenant_id, user_id);

      return res.json({
        success: true,
        message: 'Campaign resumed successfully',
      });
    } catch (error: any) {
      logger.error('Error resuming campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to resume campaign',
      });
    }
  }

  // Cancel campaign
  async cancelCampaign(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { id } = req.params;

      await campaignService.cancelCampaign(id, tenant_id, user_id);

      return res.json({
        success: true,
        message: 'Campaign cancelled successfully',
      });
    } catch (error: any) {
      logger.error('Error cancelling campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to cancel campaign',
      });
    }
  }

  // Delete campaign
  async deleteCampaign(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;

      await campaignService.deleteCampaign(id, tenant_id);

      return res.json({
        success: true,
        message: 'Campaign deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting campaign', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete campaign',
      });
    }
  }

  // Get campaign recipients
  async getCampaignRecipients(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;
      const { status, page, limit } = req.query;

      const result = await campaignService.getCampaignRecipients(id, tenant_id, {
        status: status as string,
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      return res.json({
        success: true,
        data: result.recipients,
        total: result.total,
      });
    } catch (error: any) {
      logger.error('Error getting campaign recipients', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaign recipients',
      });
    }
  }

  // Add recipients to campaign
  async addRecipients(req: Request, res: Response) {
    try {
      const { tenant_id, user_id } = (req as any).user;
      const { id } = req.params;
      const { recipients } = req.body;

      await campaignService.addRecipients(id, tenant_id, user_id, recipients);

      return res.json({
        success: true,
        message: `${recipients.length} recipients added successfully`,
      });
    } catch (error: any) {
      logger.error('Error adding recipients', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to add recipients',
      });
    }
  }

  // Get campaign analytics
  async getCampaignAnalytics(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;

      const analytics = await campaignService.getCampaignAnalytics(id, tenant_id);

      return res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      logger.error('Error getting campaign analytics', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaign analytics',
      });
    }
  }

  // Get campaign logs
  async getCampaignLogs(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;
      const { limit } = req.query;

      const logs = await campaignService.getCampaignLogs(
        id,
        tenant_id,
        limit ? parseInt(limit as string) : 50
      );

      return res.json({
        success: true,
        data: logs,
      });
    } catch (error: any) {
      logger.error('Error getting campaign logs', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get campaign logs',
      });
    }
  }

  // Create analytics snapshot (manual trigger)
  async createSnapshot(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const { id } = req.params;

      // Verify campaign belongs to tenant
      const campaign = await campaignService.getCampaignById(id, tenant_id);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          message: 'Campaign not found',
        });
      }

      await campaignService.createAnalyticsSnapshot(id);

      return res.json({  // ✅ Added return
        success: true,
        message: 'Analytics snapshot created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating snapshot', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create analytics snapshot',
      });
    }
  }
}

export default new CampaignController();
