import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import { messageQueue } from '../config/queue';
import { IUser } from '../types';
import { SendMessageRequest, QueueJobData, IMessage } from '../types/message.types'; 
import { AppError } from '../middleware/errorMiddleware';
import logger from '../utils/logger';

export class MessageService {
  /**
   * Send a single message
   * 
   * @param userId - User UUID
   * @param phoneNumber - E.164 format phone number
   * @param content - Message content (deprecated for templates)
   * @param templateCode - WhatsApp template code (e.g., 'hello_world')
   * @returns Message ID, status, and queue position
   */
  async sendMessage(
    userId: string,
    phoneNumber: string,
    content: string,
    templateCode?: string  // Changed from _templateId to templateCode
  ): Promise<{ messageId: string; status: string; queuePosition: number }> {
    await this.validateUserCanSend(userId);
    this.validatePhoneNumber(phoneNumber);

    // For template messages, content is optional
    if (!templateCode) {
      this.validateContent(content);
    }

    // Get user's api_key_id
    const apiKey = await queryOne<{ id: string }>(
      'SELECT id FROM api_keys WHERE user_id = ? AND status = "active" LIMIT 1',
      [userId]
    );

    if (!apiKey) {
      throw new AppError('No active API key found', 404);
    }

    const messageId = uuidv4();
    
    // CRITICAL: Store template_code in database
    await query(
      `INSERT INTO messages (
        id, user_id, api_key_id, phone_number, content, template_code,
        status, attempts, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, NOW(), NOW())`,
      [messageId, userId, apiKey.id, phoneNumber, content || '', templateCode || null]
    );

    // CRITICAL: Pass messageId and templateCode to worker
    const jobData: QueueJobData = {
      messageId,           // Internal UUID - used to update DB with WAMID
      userId,
      apiKeyId: apiKey.id,
      phoneNumber,
      content,
      templateCode,        // Add this field
    };

    const job = await messageQueue.add(jobData, {
      priority: 3,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    logger.info('Message queued successfully', { 
      messageId, 
      jobId: job.id,
      templateCode 
    });

    const queuePosition = await this.getQueuePosition();

    return {
      messageId,
      status: 'queued',
      queuePosition,
    };
  }

  /**
   * Send bulk messages
   * 
   * @param userId - User UUID
   * @param messages - Array of message objects
   * @returns Summary of queued and failed messages
   */
  async sendBulkMessages(
    userId: string,
    messages: SendMessageRequest[]
  ): Promise<{
    total: number;
    queued: number;
    failed: number;
    messageIds: string[];
    failedMessages: Array<{ phone_number: string; error: string }>;
  }> {
    await this.validateUserCanSend(userId, messages.length);

    if (messages.length > 1000) {
      throw new AppError('Maximum 1000 messages per bulk request', 400);
    }

    // Get user's api_key_id once
    const apiKey = await queryOne<{ id: string }>(
      'SELECT id FROM api_keys WHERE user_id = ? AND status = "active" LIMIT 1',
      [userId]
    );

    if (!apiKey) {
      throw new AppError('No active API key found', 404);
    }

    const messageIds: string[] = [];
    const failedMessages: Array<{ phone_number: string; error: string }> = [];
    let queued = 0;

    for (const msg of messages) {
      try {
        this.validatePhoneNumber(msg.phone_number);

        // Validate content only if no template_code provided
        if (!msg.template_code) {
          this.validateContent(msg.content);
        }

        const messageId = uuidv4();
        
        // CRITICAL: Store template_code
        await query(
          `INSERT INTO messages (
            id, user_id, api_key_id, phone_number, content, template_code,
            status, attempts, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, NOW(), NOW())`,
          [messageId, userId, apiKey.id, msg.phone_number, msg.content || '', msg.template_code || null]
        );

        // CRITICAL: Pass messageId and templateCode to worker
        const jobData: QueueJobData = {
          messageId,           // Internal UUID
          userId,
          apiKeyId: apiKey.id,
          phoneNumber: msg.phone_number,
          content: msg.content,
          templateCode: msg.template_code,  // Add this field
        };

        await messageQueue.add(jobData, {
          priority: 3,
          attempts: 3,
        });

        messageIds.push(messageId);
        queued++;
      } catch (error) {
        logger.error('Failed to queue message', { phone: msg.phone_number, error });
        failedMessages.push({
          phone_number: msg.phone_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Bulk messages processed', {
      total: messages.length,
      queued,
      failed: failedMessages.length,
    });

    return {
      total: messages.length,
      queued,
      failed: failedMessages.length,
      messageIds,
      failedMessages,
    };
  }

  /**
   * Get message by ID with authorization check
   */
  async getMessageById(messageId: string, userId: string): Promise<IMessage> {
    const message = await queryOne<IMessage>(
      `SELECT 
        id, 
        user_id, 
        api_key_id, 
        phone_number, 
        content, 
        template_code,
        external_message_id, 
        status, 
        attempts,
        scheduled_at,
        created_at, 
        sent_at,
        delivered_at, 
        read_at, 
        failed_at,
        error_message,
        updated_at
      FROM messages 
      WHERE id = ? AND user_id = ?`,
      [messageId, userId]
    );

    if (!message) {
      throw new AppError('Message not found', 404);
    }

    return message;
  }

  /**
   * Get messages with pagination and filters
   */
  async getMessages(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
    fromDate?: string,
    toDate?: string
  ): Promise<{
    data: IMessage[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Validate pagination
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 10;

    const offset = (page - 1) * limit;

    // Build query
    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (fromDate) {
      whereClause += ' AND DATE(created_at) >= ?';
      params.push(fromDate);
    }

    if (toDate) {
      whereClause += ' AND DATE(created_at) <= ?';
      params.push(toDate);
    }

    // Get total count
    const countResult = await queryOne<{ total: number }>(
      `SELECT COUNT(*) as total FROM messages ${whereClause}`,
      params
    );

    const total = countResult?.total || 0;
    const totalPages = Math.ceil(total / limit);

    // Get messages with all relevant fields
    const messages = await query<IMessage[]>(
      `SELECT 
        id, phone_number, content, template_code,
        external_message_id, status, attempts,
        created_at, sent_at, delivered_at, read_at, failed_at,
        error_message
      FROM messages ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Schedule a message for future delivery
   */
  async scheduleMessage(
    userId: string,
    phoneNumber: string,
    content: string,
    scheduledAt: Date,
    templateCode?: string  // Changed from _templateId
  ): Promise<{ messageId: string; status: string; scheduledAt: Date }> {
    // Validate scheduled time
    const now = new Date();
    if (scheduledAt <= now) {
      throw new AppError('Scheduled time must be in the future', 400);
    }

    // Max 30 days in advance
    const maxDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    if (scheduledAt > maxDate) {
      throw new AppError('Cannot schedule more than 30 days in advance', 400);
    }

    await this.validateUserCanSend(userId);
    this.validatePhoneNumber(phoneNumber);

    if (!templateCode) {
      this.validateContent(content);
    }

    // Get user's api_key_id
    const apiKey = await queryOne<{ id: string }>(
      'SELECT id FROM api_keys WHERE user_id = ? AND status = "active" LIMIT 1',
      [userId]
    );

    if (!apiKey) {
      throw new AppError('No active API key found', 404);
    }

    const messageId = uuidv4();
    
    // CRITICAL: Store template_code
    await query(
      `INSERT INTO messages (
        id, user_id, api_key_id, phone_number, content, template_code,
        status, attempts, scheduled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'scheduled', 0, ?, NOW(), NOW())`,
      [messageId, userId, apiKey.id, phoneNumber, content || '', templateCode || null, scheduledAt]
    );

    // Add to queue with delay
    const delay = scheduledAt.getTime() - now.getTime();
    
    // CRITICAL: Pass messageId and templateCode
    const jobData: QueueJobData = {
      messageId,
      userId,
      apiKeyId: apiKey.id,
      phoneNumber,
      content,
      templateCode,
    };

    await messageQueue.add(jobData, {
      delay,
      priority: 3,
      attempts: 3,
    });

    logger.info('Message scheduled successfully', { 
      messageId, 
      scheduledAt,
      templateCode 
    });

    return {
      messageId,
      status: 'scheduled',
      scheduledAt,
    };
  }

  /**
   * Validate user can send messages
   * Checks approval status and daily limits
   */
  private async validateUserCanSend(userId: string, count: number = 1): Promise<void> {
    const user = await queryOne<IUser>('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.signup_status !== 'approved') {
      throw new AppError('Account not approved for sending messages', 403);
    }

    // Check daily limit
    const today = new Date().toISOString().split('T')[0];
    const sentToday = await queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages 
       WHERE user_id = ? 
       AND DATE(created_at) = ? 
       AND status IN ('queued', 'processing', 'sent', 'delivered')`,
      [userId, today]
    );

    const currentUsage = sentToday?.count || 0;
    const remaining = user.daily_sms_limit - currentUsage;

    if (remaining < count) {
      throw new AppError(
        `Daily message limit exceeded. Used: ${currentUsage}/${user.daily_sms_limit}. Resets at midnight.`,
        403
      );
    }
  }

  /**
   * Validate phone number format (E.164)
   */
  private validatePhoneNumber(phone: string): void {
    const e164Regex = /^\+?[1-9]\d{1,14}$/;
    if (!e164Regex.test(phone)) {
      throw new AppError(
        'Invalid phone number format. Use E.164 format: +[country code][number]',
        400
      );
    }
  }

  /**
   * Validate message content
   */
  private validateContent(content: string): void {
    if (!content || content.trim().length === 0) {
      throw new AppError('Message content cannot be empty', 400);
    }

    if (content.length > 1600) {
      throw new AppError('Message content exceeds maximum length of 1600 characters', 400);
    }
  }

  /**
   * Get approximate queue position
   */
  private async getQueuePosition(): Promise<number> {
    try {
      const waitingCount = await messageQueue.getWaitingCount();
      const activeCount = await messageQueue.getActiveCount();
      return waitingCount + activeCount;
    } catch (error) {
      logger.error('Failed to get queue position', error);
      return 0;
    }
  }

  /**
   * Update message status
   * Called by worker after processing
   */
  async updateMessageStatus(
    messageId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    await query(
      `UPDATE messages 
       SET status = ?, error_message = ?, updated_at = NOW() 
       WHERE id = ?`,
      [status, errorMessage || null, messageId]
    );

    logger.info('Message status updated', { messageId, status });
  }

  /**
   * Increment message attempt count
   * Called by worker on retry
   */
  async incrementAttempts(messageId: string): Promise<void> {
    await query(
      'UPDATE messages SET attempts = attempts + 1, updated_at = NOW() WHERE id = ?',
      [messageId]
    );
  }
}

export default new MessageService();
