import { Request, Response } from 'express';
import customerGroupService from '../services/customerGroupService';
import logger from '../utils/logger';

class CustomerGroupController {
  /**
   * Create group
   */
  async createGroup(req: Request, res: Response) {
    try {
      const { tenant_id, id: user_id } = (req as any).user;
      const group = await customerGroupService.createGroup(
        tenant_id,
        user_id,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: 'Customer group created successfully',
        data: group,
      });
    } catch (error: any) {
      logger.error('Error creating customer group', { error: error.message, body: req.body });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create customer group',
      });
    }
  }

  /**
   * Get group by ID
   */
  async getGroup(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const group = await customerGroupService.getGroupById(
        tenant_id,
        req.params.id
      );

      return res.json({
        success: true,
        data: group,
      });
    } catch (error: any) {
      logger.error('Error getting customer group', { error: error.message, id: req.params.id });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get customer group',
      });
    }
  }

  /**
   * Get all groups
   */
  async getGroups(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await customerGroupService.getGroups(tenant_id, page, limit);

      return res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error getting customer groups', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customer groups',
      });
    }
  }

  /**
   * Get customers in group
   */
  async getGroupCustomers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await customerGroupService.getGroupCustomers(
        req.params.id,
        page,
        limit
      );

      return res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error getting group customers', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get group customers',
      });
    }
  }

  /**
   * Add customers to group
   */
  async addCustomers(req: Request, res: Response) {
    try {
      await customerGroupService.addCustomersToGroup(
        req.params.id,
        req.body.customer_ids
      );

      return res.json({
        success: true,
        message: 'Customers added to group successfully',
      });
    } catch (error: any) {
      logger.error('Error adding customers to group', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to add customers to group',
      });
    }
  }

  /**
   * Remove customers from group
   */
  async removeCustomers(req: Request, res: Response) {
    try {
      await customerGroupService.removeCustomersFromGroup(
        req.params.id,
        req.body.customer_ids
      );

      return res.json({
        success: true,
        message: 'Customers removed from group successfully',
      });
    } catch (error: any) {
      logger.error('Error removing customers from group', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove customers from group',
      });
    }
  }

  /**
   * Delete group
   */
  async deleteGroup(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      await customerGroupService.deleteGroup(tenant_id, req.params.id);

      return res.json({
        success: true,
        message: 'Customer group deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting customer group', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete customer group',
      });
    }
  }
}

export default new CustomerGroupController();
