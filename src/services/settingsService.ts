import { query } from '../config/database';
import bcrypt from 'bcrypt';

interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  organization_name?: string;
  phone?: string;
  country?: string;
  company_size?: string;
  industry?: string;
}

interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

class SettingsService {
  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: UpdateProfileRequest) {
    const updates: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    if (data.first_name !== undefined) {
      updates.push('first_name = ?');
      values.push(data.first_name);
    }
    
    if (data.last_name !== undefined) {
      updates.push('last_name = ?');
      values.push(data.last_name);
    }
    
    if (data.organization_name !== undefined) {
      updates.push('organization_name = ?');
      values.push(data.organization_name);
    }
    
    if (data.phone !== undefined) {
      updates.push('phone = ?');
      values.push(data.phone);
    }
    
    if (data.country !== undefined) {
      updates.push('country = ?');
      values.push(data.country);
    }
    
    if (data.company_size !== undefined) {
      updates.push('company_size = ?');
      values.push(data.company_size);
    }
    
    if (data.industry !== undefined) {
      updates.push('industry = ?');
      values.push(data.industry);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    updates.push('updated_at = NOW()');
    values.push(userId);

    await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Return updated user
    const result: any = await query(
      'SELECT id, tenant_id, email, account_type, organization_name, first_name, last_name, phone, country, company_size, industry, tier, daily_sms_limit, signup_status, created_at FROM users WHERE id = ?',
      [userId]
    );

    return result[0];
  }

  /**
   * Change password
   */
  async changePassword(userId: string, data: ChangePasswordRequest) {
    // Get current user
    const userResult: any = await query(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!userResult || userResult.length === 0) {
      throw new Error('User not found');
    }

    const user = userResult[0];

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      data.current_password,
      user.password_hash
    );

    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    if (data.new_password.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(data.new_password, 10);

    // Update password
    await query(
      'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
      [newPasswordHash, userId]
    );

    return { message: 'Password changed successfully' };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const result: any = await query(
      'SELECT id, tenant_id, email, account_type, organization_name, first_name, last_name, phone, country, company_size, industry, tier, daily_sms_limit, signup_status, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!result || result.length === 0) {
      throw new Error('User not found');
    }

    return result[0];
  }

  /**
   * Get account statistics
   */
  async getAccountStats(tenantId: string) {
    // Get message statistics
    const messageStats: any = await query(
      `SELECT 
        COUNT(*) as total_messages,
        SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as sent_today
      FROM messages 
      WHERE tenant_id = ?`,
      [tenantId]
    );

    // Get template count
    const templateStats: any = await query(
      `SELECT 
        COUNT(*) as total_templates,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
      FROM message_templates 
      WHERE tenant_id = ?`,
      [tenantId]
    );

    return {
      messages: messageStats[0] || {
        total_messages: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
        sent_today: 0,
      },
      templates: templateStats[0] || {
        total_templates: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
      },
    };
  }
}

export default new SettingsService();
