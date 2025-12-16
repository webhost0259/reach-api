import { Request, Response } from 'express';
import customerService from '../services/customerService';
import { CustomerFilters } from '../types/customer.types';
import CSVParser from '../utils/csvParser';
import logger from '../utils/logger';

class CustomerController {
  /**
   * Create customer
   */
  async createCustomer(req: Request, res: Response) {
    try {
      const { tenant_id, id: user_id } = (req as any).user;
      const customer = await customerService.createCustomer(
        tenant_id,
        user_id,
        req.body
      );

      return res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer,
      });
    } catch (error: any) {
      logger.error('Error creating customer', { error: error.message, body: req.body });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to create customer',
      });
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const customer = await customerService.getCustomerById(
        tenant_id,
        req.params.id
      );

      return res.json({
        success: true,
        data: customer,
      });
    } catch (error: any) {
      logger.error('Error getting customer', { error: error.message, id: req.params.id });
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Failed to get customer',
      });
    }
  }

  /**
   * Get all customers with filters
   */
  async getCustomers(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const filters: CustomerFilters = {
        search: req.query.search as string,
        opt_in_status: req.query.opt_in_status as string,
        status: req.query.status as string,
        country_code: req.query.country_code as string,
        created_from: req.query.created_from as string,
        created_to: req.query.created_to as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await customerService.getCustomers(tenant_id, filters);

      return res.json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logger.error('Error getting customers', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customers',
      });
    }
  }

  /**
   * Update customer
   */
  async updateCustomer(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const customer = await customerService.updateCustomer(
        tenant_id,
        req.params.id,
        req.body
      );

      return res.json({
        success: true,
        message: 'Customer updated successfully',
        data: customer,
      });
    } catch (error: any) {
      logger.error('Error updating customer', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to update customer',
      });
    }
  }

  /**
   * Delete customer
   */
  async deleteCustomer(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      await customerService.deleteCustomer(tenant_id, req.params.id);

      return res.json({
        success: true,
        message: 'Customer deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting customer', { error: error.message, id: req.params.id });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete customer',
      });
    }
  }

  /**
   * Bulk import customers
   */
  async bulkImport(req: Request, res: Response) {
    try {
      const { tenant_id, id: user_id } = (req as any).user;
      const result = await customerService.bulkImport(
        tenant_id,
        user_id,
        req.body.customers
      );

      return res.json({
        success: true,
        message: `Import completed. Success: ${result.success}, Failed: ${result.failed}`,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error importing customers', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to import customers',
      });
    }
  }

  /**
   * Get customer statistics
   */
  async getStats(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      const stats = await customerService.getStats(tenant_id);

      return res.json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting customer stats', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to get customer statistics',
      });
    }
  }

  /**
   * Upload CSV and import customers
   */
  async uploadCSV(req: Request, res: Response) {
    try {
      const { tenant_id, id: user_id } = (req as any).user;
      
      if (!req.body.csv_content) {
        return res.status(400).json({
          success: false,
          message: 'CSV content is required',
        });
      }

      // Parse CSV
      const customers = CSVParser.parseCustomersCSV(req.body.csv_content);

      if (customers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid customers found in CSV',
        });
      }

      if (customers.length > 1000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 1000 customers per CSV upload',
        });
      }

      // Import customers
      const result = await customerService.bulkImport(tenant_id, user_id, customers);

      return res.json({
        success: true,
        message: `Import completed. Success: ${result.success}, Failed: ${result.failed}`,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error uploading CSV', { error: error.message });
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload CSV',
      });
    }
  }

  /**
   * Download CSV template
   */
  async downloadTemplate(_req: Request, res: Response) {
    try {
      const template = CSVParser.generateTemplate();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_import_template.csv');
      return res.send(template);
    } catch (error: any) {
      logger.error('Error downloading template', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to generate template',
      });
    }
  }

  /**
   * Export customers to CSV
   */
  async exportCSV(req: Request, res: Response) {
    try {
      const { tenant_id } = (req as any).user;
      
      const filters: CustomerFilters = {
        opt_in_status: req.query.opt_in_status as string,
        status: req.query.status as string,
        country_code: req.query.country_code as string,
        limit: 10000, // Max export limit
      };

      const result = await customerService.getCustomers(tenant_id, filters);
      const csv = CSVParser.exportCustomersToCSV(result.data);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers_export.csv');
      return res.send(csv);
    } catch (error: any) {
      logger.error('Error exporting CSV', { error: error.message });
      return res.status(500).json({
        success: false,
        message: 'Failed to export customers',
      });
    }
  }
}

export default new CustomerController();
