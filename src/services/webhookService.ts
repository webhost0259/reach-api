import { pool } from '../config/database';
import logger from '../utils/logger';
import { WhatsAppMessageStatus, WhatsAppInboundMessage } from '../types/webhook';
import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';

export class WebhookService {
  /**
   * Verify webhook signature from Meta
   */
  static verifySignature(payload: string, signature: string): boolean {
    if (!process.env.WHATSAPP_APP_SECRET) {
      logger.warn('WHATSAPP_APP_SECRET not set, skipping signature verification');
      return true;
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(providedSignature)
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Process message status update from WhatsApp
   */
  static async processStatusUpdate(status: WhatsAppMessageStatus): Promise<void> {
    const connection = await pool.getConnection();

    try {
      const [messages] = await connection.execute<RowDataPacket[]>(
        'SELECT id, status, user_id FROM messages WHERE external_message_id = ? LIMIT 1',
        [status.id]
      );

      if (!messages || messages.length === 0) {
        logger.warn(`Message not found for WhatsApp ID: ${status.id}`);
        return;
      }

      const message = messages[0];
      const updateFields: string[] = ['status = ?'];
      const updateValues: any[] = [status.status];

      switch (status.status) {
        case 'sent':
          logger.info(`Message ${message.id} sent successfully`);
          break;

        case 'delivered':
          updateFields.push('delivered_at = ?');
          updateValues.push(new Date(parseInt(status.timestamp) * 1000));
          logger.info(`Message ${message.id} delivered to ${status.recipient_id}`);
          break;

        case 'read':
          updateFields.push('read_at = ?');
          updateValues.push(new Date(parseInt(status.timestamp) * 1000));
          
          // CRITICAL FIX: Update delivered_at if not already set
          // WhatsApp sometimes sends 'read' before 'delivered'
          if (!message.delivered_at) {
            updateFields.push('delivered_at = ?');
            updateValues.push(new Date(parseInt(status.timestamp) * 1000));
          }
          
          logger.info(`Message ${message.id} read by ${status.recipient_id}`);
          break;

        case 'failed':
          updateFields.push('failed_at = ?');
          updateValues.push(new Date(parseInt(status.timestamp) * 1000));
          
          if (status.errors && status.errors.length > 0) {
            const errorDetails = status.errors[0];
            updateFields.push('error_code = ?', 'error_message = ?');
            updateValues.push(
              errorDetails.code.toString(),
              `${errorDetails.title}: ${errorDetails.message}`
            );
            logger.error(`Message ${message.id} failed:`, {
              code: errorDetails.code,
              message: errorDetails.message,
            });
          }
          break;
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(message.id);

      await connection.execute(
        `UPDATE messages SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      logger.info(`Message ${message.id} status updated to '${status.status}'`);
    } catch (error) {
      logger.error('Error processing status update:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Process inbound message from customer
   */
  static async processInboundMessage(message: WhatsAppInboundMessage): Promise<void> {
    logger.info('Inbound message received:', {
      from: message.from,
      type: message.type,
      timestamp: message.timestamp,
    });

    if (message.type === 'text' && message.text) {
      logger.info(`Text message from ${message.from}: ${message.text.body}`);
    }
  }
}

export default WebhookService;
