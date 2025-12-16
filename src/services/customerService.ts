import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import {
  ICustomer,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFilters,
} from '../types/customer.types';
import { AppError } from '../middleware/errorMiddleware';
import logger from '../utils/logger';

class CustomerService {
  /**
   * Create a new customer
   */
  async createCustomer(
    tenantId: string,
    userId: string,
    data: CreateCustomerRequest
  ): Promise<ICustomer> {
    // Validate mobile number
    if (!this.isValidPhoneNumber(data.mobile_number)) {
      throw new AppError('Invalid mobile number format', 400);
    }

    // Check for duplicate
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM customers 
       WHERE tenant_id = ? AND mobile_number = ? AND status != 'deleted'`,
      [tenantId, data.mobile_number]
    );

    if (existing) {
      throw new AppError('Customer with this mobile number already exists', 409);
    }

    const customerId = uuidv4();
    const tags = data.tags ? JSON.stringify(data.tags) : null;
    const customFields = data.custom_fields ? JSON.stringify(data.custom_fields) : null;

    await query(
      `INSERT INTO customers (
        id, tenant_id, user_id, first_name, last_name, mobile_number, 
        email, country_code, tags, custom_fields, notes, opt_in_status,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())`,
      [
        customerId,
        tenantId,
        userId,
        data.first_name,
        data.last_name || null,
        data.mobile_number,
        data.email || null,
        data.country_code || '+91',
        tags,
        customFields,
        data.notes || null,
        data.opt_in_status || 'pending',
      ]
    );

    logger.info('Customer created', { customerId, tenantId });

    return this.getCustomerById(tenantId, customerId);
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(tenantId: string, customerId: string): Promise<ICustomer> {
    const customer = await queryOne<ICustomer>(
      `SELECT * FROM customers WHERE id = ? AND tenant_id = ? AND status != 'deleted'`,
      [customerId, tenantId]
    );

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Parse JSON fields
    if (customer.tags) {
      customer.tags = JSON.parse(customer.tags as string);
    }
    if (customer.custom_fields) {
      customer.custom_fields = JSON.parse(customer.custom_fields as string);
    }

    return customer;
  }

  /**
   * Get customers with filters and pagination
   */
  async getCustomers(
    tenantId: string,
    filters: CustomerFilters
  ): Promise<{
    data: ICustomer[];
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
    let whereClause = 'WHERE tenant_id = ? AND status != "deleted"';
    const params: any[] = [tenantId];

    if (filters.search) {
      whereClause += ` AND (first_name LIKE ? OR last_name LIKE ? OR mobile_number LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (filters.opt_in_status) {
      whereClause += ' AND opt_in_status = ?';
      params.push(filters.opt_in_status);
    }

    if (filters.status) {
      whereClause += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.country_code) {
      whereClause += ' AND country_code = ?';
      params.push(filters.country_code);
    }

    if (filters.created_from) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(filters.created_from);
    }

    if (filters.created_to) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(filters.created_to);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM customers ${whereClause}`,
      params
    );

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Get customers
    const customers = await query<ICustomer[]>(
      `SELECT * FROM customers ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // Parse JSON fields
    customers.forEach((customer) => {
      if (customer.tags) {
        customer.tags = JSON.parse(customer.tags as string);
      }
      if (customer.custom_fields) {
        customer.custom_fields = JSON.parse(customer.custom_fields as string);
      }
    });

    return {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Update customer
   */
  async updateCustomer(
    tenantId: string,
    customerId: string,
    data: UpdateCustomerRequest
  ): Promise<ICustomer> {
    // Check if customer exists
    await this.getCustomerById(tenantId, customerId);

    const updates: string[] = [];
    const params: any[] = [];

    if (data.first_name !== undefined) {
      updates.push('first_name = ?');
      params.push(data.first_name);
    }

    if (data.last_name !== undefined) {
      updates.push('last_name = ?');
      params.push(data.last_name);
    }

    if (data.mobile_number !== undefined) {
      if (!this.isValidPhoneNumber(data.mobile_number)) {
        throw new AppError('Invalid mobile number format', 400);
      }
      updates.push('mobile_number = ?');
      params.push(data.mobile_number);
    }

    if (data.email !== undefined) {
      updates.push('email = ?');
      params.push(data.email);
    }

    if (data.country_code !== undefined) {
      updates.push('country_code = ?');
      params.push(data.country_code);
    }

    if (data.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(data.tags));
    }

    if (data.custom_fields !== undefined) {
      updates.push('custom_fields = ?');
      params.push(JSON.stringify(data.custom_fields));
    }

    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes);
    }

    if (data.opt_in_status !== undefined) {
      updates.push('opt_in_status = ?');
      params.push(data.opt_in_status);

      if (data.opt_in_status === 'opted_in') {
        updates.push('opted_in_at = NOW()');
      } else if (data.opt_in_status === 'opted_out') {
        updates.push('opted_out_at = NOW()');
      }
    }

    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length === 0) {
      throw new AppError('No fields to update', 400);
    }

    updates.push('updated_at = NOW()');
    params.push(customerId, tenantId);

    await query(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
      params
    );

    logger.info('Customer updated', { customerId, tenantId });

    return this.getCustomerById(tenantId, customerId);
  }

  /**
   * Delete customer (soft delete)
   */
  async deleteCustomer(tenantId: string, customerId: string): Promise<void> {
    await query(
      `UPDATE customers SET status = 'deleted', updated_at = NOW() WHERE id = ? AND tenant_id = ?`,
      [customerId, tenantId]
    );

    logger.info('Customer deleted', { customerId, tenantId });
  }

  /**
   * Bulk import customers from CSV data
   */
  async bulkImport(
    tenantId: string,
    userId: string,
    customers: CreateCustomerRequest[]
  ): Promise<{
    success: number;
    failed: number;
    errors: Array<{ row: number; error: string }>;
  }> {
    let success = 0;
    let failed = 0;
    const errors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < customers.length; i++) {
      try {
        await this.createCustomer(tenantId, userId, customers[i]);
        success++;
      } catch (error) {
        failed++;
        errors.push({
          row: i + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk import completed', { tenantId, success, failed });

    return { success, failed, errors };
  }

  /**
   * Validate phone number (E.164 format)
   */
  private isValidPhoneNumber(phone: string): boolean {
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Get customer statistics
   */
  async getStats(tenantId: string): Promise<{
    total: number;
    opted_in: number;
    opted_out: number;
    pending: number;
    active: number;
    blocked: number;
  }> {
    const stats = await queryOne<any>(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN opt_in_status = 'opted_in' THEN 1 ELSE 0 END) as opted_in,
        SUM(CASE WHEN opt_in_status = 'opted_out' THEN 1 ELSE 0 END) as opted_out,
        SUM(CASE WHEN opt_in_status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'blocked' THEN 1 ELSE 0 END) as blocked
       FROM customers 
       WHERE tenant_id = ? AND status != 'deleted'`,
      [tenantId]
    );

    return stats || {
      total: 0,
      opted_in: 0,
      opted_out: 0,
      pending: 0,
      active: 0,
      blocked: 0,
    };
  }
}

export default new CustomerService();
