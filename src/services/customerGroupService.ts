import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import {
  ICustomerGroup,
  CreateGroupRequest,
  GroupCriteria,
} from '../types/customer.types';
import { AppError } from '../middleware/errorMiddleware';
import logger from '../utils/logger';

class CustomerGroupService {
  /**
   * Create a new customer group
   */
  async createGroup(
    tenantId: string,
    userId: string,
    data: CreateGroupRequest
  ): Promise<ICustomerGroup> {
    const groupId = uuidv4();
    const criteria = data.criteria ? JSON.stringify(data.criteria) : null;

    await query(
      `INSERT INTO customer_groups (
        id, tenant_id, user_id, name, description, 
        criteria, is_dynamic, customer_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())`,
      [
        groupId,
        tenantId,
        userId,
        data.name,
        data.description || null,
        criteria,
        data.is_dynamic ? 1 : 0,
      ]
    );

    // For static groups, add customer members
    if (!data.is_dynamic && data.customer_ids && data.customer_ids.length > 0) {
      await this.addCustomersToGroup(groupId, data.customer_ids);
    }

    // For dynamic groups, calculate members based on criteria
    if (data.is_dynamic && data.criteria) {
      await this.updateDynamicGroupMembers(tenantId, groupId, data.criteria);
    }

    logger.info('Customer group created', { groupId, tenantId });

    return this.getGroupById(tenantId, groupId);
  }

  /**
   * Get group by ID
   */
  async getGroupById(tenantId: string, groupId: string): Promise<ICustomerGroup> {
    const group = await queryOne<ICustomerGroup>(
      `SELECT * FROM customer_groups WHERE id = ? AND tenant_id = ?`,
      [groupId, tenantId]
    );

    if (!group) {
      throw new AppError('Customer group not found', 404);
    }

    if (group.criteria) {
      group.criteria = JSON.parse(group.criteria as string);
    }

    return group;
  }

  /**
   * Get all groups for tenant
   */
  async getGroups(
    tenantId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: ICustomerGroup[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const offset = (page - 1) * limit;

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM customer_groups WHERE tenant_id = ?`,
      [tenantId]
    );

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const groups = await query<ICustomerGroup[]>(
      `SELECT * FROM customer_groups 
       WHERE tenant_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [tenantId, limit, offset]
    );

    groups.forEach((group) => {
      if (group.criteria) {
        group.criteria = JSON.parse(group.criteria as string);
      }
    });

    return {
      data: groups,
      pagination: { page, limit, total, totalPages },
    };
  }

  /**
   * Add customers to group (for static groups)
   */
  async addCustomersToGroup(groupId: string, customerIds: string[]): Promise<void> {
    if (customerIds.length === 0) return;

    // ✅ Build values with proper structure
    const valueSets = customerIds.map((customerId) => {
      return [uuidv4(), groupId, customerId];
    });

    // ✅ Create placeholders for all values
    const placeholders = valueSets.map(() => '(?, ?, ?, NOW())').join(', ');
    
    // ✅ Flatten all values for params
    const params = valueSets.flat();

    await query(
      `INSERT IGNORE INTO customer_group_members (id, group_id, customer_id, added_at) 
      VALUES ${placeholders}`,
      params
    );

    // Update customer count
    await query(
      `UPDATE customer_groups 
      SET customer_count = (SELECT COUNT(*) FROM customer_group_members WHERE group_id = ?),
          updated_at = NOW()
      WHERE id = ?`,
      [groupId, groupId]
    );

    logger.info('Customers added to group', { groupId, count: customerIds.length });
  }



  /**
   * Remove customers from group
   */
  async removeCustomersFromGroup(groupId: string, customerIds: string[]): Promise<void> {
    if (customerIds.length === 0) return;

    const placeholders = customerIds.map(() => '?').join(', ');

    await query(
      `DELETE FROM customer_group_members 
       WHERE group_id = ? AND customer_id IN (${placeholders})`,
      [groupId, ...customerIds]
    );

    // Update customer count
    await query(
      `UPDATE customer_groups 
       SET customer_count = (SELECT COUNT(*) FROM customer_group_members WHERE group_id = ?),
           updated_at = NOW()
       WHERE id = ?`,
      [groupId, groupId]
    );

    logger.info('Customers removed from group', { groupId, count: customerIds.length });
  }

  /**
   * Update dynamic group members based on criteria
   */
  async updateDynamicGroupMembers(
    tenantId: string,
    groupId: string,
    criteria: GroupCriteria
  ): Promise<void> {
    // Build query based on criteria
    let whereClause = 'WHERE tenant_id = ? AND status = "active"';
    const params: any[] = [tenantId];

    if (criteria.tags && criteria.tags.length > 0) {
      const tagConditions = criteria.tags.map(() => 'JSON_CONTAINS(tags, ?)').join(' OR ');
      whereClause += ` AND (${tagConditions})`;
      criteria.tags.forEach((tag) => params.push(JSON.stringify(tag)));
    }

    if (criteria.opt_in_status) {
      whereClause += ' AND opt_in_status = ?';
      params.push(criteria.opt_in_status);
    }

    if (criteria.status) {
      whereClause += ' AND status = ?';
      params.push(criteria.status);
    }

    if (criteria.country_code) {
      whereClause += ' AND country_code = ?';
      params.push(criteria.country_code);
    }

    // Get matching customers
    const customers = await query<{ id: string }[]>(
      `SELECT id FROM customers ${whereClause}`,
      params
    );

    // Clear existing members
    await query('DELETE FROM customer_group_members WHERE group_id = ?', [groupId]);

    // Add new members
    if (customers.length > 0) {
      const customerIds = customers.map((c) => c.id);
      await this.addCustomersToGroup(groupId, customerIds);
    }

    logger.info('Dynamic group updated', { groupId, memberCount: customers.length });
  }

  /**
   * Get customers in a group
   */
  async getGroupCustomers(
    groupId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const offset = (page - 1) * limit;

    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM customer_group_members WHERE group_id = ?`,
      [groupId]
    );

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const customers = await query<any[]>(
      `SELECT c.*, cgm.added_at
       FROM customers c
       INNER JOIN customer_group_members cgm ON c.id = cgm.customer_id
       WHERE cgm.group_id = ?
       ORDER BY cgm.added_at DESC
       LIMIT ? OFFSET ?`,
      [groupId, limit, offset]
    );

    return {
      data: customers,
      pagination: { page, limit, total, totalPages },
    };
  }

  /**
   * Delete group
   */
  async deleteGroup(tenantId: string, groupId: string): Promise<void> {
    // Delete group members first
    await query('DELETE FROM customer_group_members WHERE group_id = ?', [groupId]);

    // Delete group
    await query('DELETE FROM customer_groups WHERE id = ? AND tenant_id = ?', [
      groupId,
      tenantId,
    ]);

    logger.info('Customer group deleted', { groupId, tenantId });
  }
}

export default new CustomerGroupService();
