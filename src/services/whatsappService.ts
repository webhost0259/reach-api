import axios, { AxiosError } from 'axios';
import { pool } from '../config/database';
import logger from '../utils/logger';

interface WhatsAppMessagePayload {
  messaging_product: string;
  recipient_type?: string;
  to: string;
  type: string;
  text?: {
    preview_url: boolean;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: string;
      parameters: Array<{
        type: string;
        text: string;
      }>;
    }>;
  };
}

interface WhatsAppResponse {
  messaging_product: string;
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string; // This is the WAMID (WhatsApp Message ID)
  }>;
}

export class WhatsAppService {
  private readonly apiUrl: string;
  private readonly accessToken: string;
  private readonly phoneNumberId: string;

  constructor() {
    this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v22.0';
    this.accessToken = process.env.WHATSAPP_API_TOKEN || '';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

    if (!this.accessToken || !this.phoneNumberId) {
      logger.warn('WhatsApp API credentials not configured');
    }
  }

  /**
   * Send a template message via WhatsApp Business API
   * Templates are required for production - text messages not allowed
   * 
   * @param phoneNumber - Recipient phone number
   * @param templateName - Template identifier (e.g., 'hello_world')
   * @param languageCode - Template language code (e.g., 'en_US')
   * @param parameters - Template parameters for placeholders
   * @param messageId - Optional internal message ID to update in database
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string = 'hello_world',
    languageCode: string = 'en_US',
    parameters?: Array<{ type: string; text: string }>,
    messageId?: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    externalMessageId?: string;
    error?: string;
  }> {
    try {
      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

      const payload: WhatsAppMessagePayload = {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
          },
        },
      };

      // Add parameters if provided
      if (parameters && parameters.length > 0) {
        payload.template!.components = [
          {
            type: 'body',
            parameters: parameters,
          },
        ];
      }

      const response = await axios.post<WhatsAppResponse>(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      // Extract WhatsApp Message ID (WAMID) from response
      const externalMessageId = response.data.messages[0]?.id;
      const waId = response.data.contacts[0]?.wa_id;

      if (!externalMessageId) {
        logger.error('No message ID returned from WhatsApp API');
        return {
          success: false,
          error: 'No message ID returned from WhatsApp',
        };
      }

      logger.info('WhatsApp template message sent successfully', {
        phoneNumber: cleanPhone,
        waId,
        externalMessageId,
        templateName,
        messageId,
      });

      // Update database with external message ID if messageId is provided
      if (messageId) {
        await this.updateMessageWithExternalId(messageId, externalMessageId);
      }

      return {
        success: true,
        messageId,
        externalMessageId,
      };
    } catch (error) {
      return this.handleWhatsAppError(error, phoneNumber);
    }
  }

  /**
   * Send a text message (ONLY works in test mode with approved recipients)
   * For production, use sendTemplateMessage instead
   * 
   * @param phoneNumber - Recipient phone number
   * @param message - Text message content
   * @param messageId - Optional internal message ID to update in database
   */
  async sendTextMessage(
    phoneNumber: string,
    message: string,
    messageId?: string
  ): Promise<{
    success: boolean;
    messageId?: string;
    externalMessageId?: string;
    error?: string;
  }> {
    try {
      const cleanPhone = phoneNumber.replace(/[^\d]/g, '');

      const payload: WhatsAppMessagePayload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      };

      const response = await axios.post<WhatsAppResponse>(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      // Extract WhatsApp Message ID (WAMID) from response
      const externalMessageId = response.data.messages[0]?.id;
      const waId = response.data.contacts[0]?.wa_id;

      if (!externalMessageId) {
        logger.error('No message ID returned from WhatsApp API');
        return {
          success: false,
          error: 'No message ID returned from WhatsApp',
        };
      }

      logger.info('WhatsApp text message sent successfully', {
        phoneNumber: cleanPhone,
        waId,
        externalMessageId,
        messageId,
      });

      // Update database with external message ID if messageId is provided
      if (messageId) {
        await this.updateMessageWithExternalId(messageId, externalMessageId);
      }

      return {
        success: true,
        messageId,
        externalMessageId,
      };
    } catch (error) {
      return this.handleWhatsAppError(error, phoneNumber);
    }
  }

  /**
   * Update message record with external WhatsApp message ID
   * This allows webhook to match status updates to our internal messages
   * 
   * @param messageId - Internal message UUID
   * @param externalMessageId - WhatsApp Message ID (WAMID)
   */
  private async updateMessageWithExternalId(
    messageId: string,
    externalMessageId: string
  ): Promise<void> {
    const connection = await pool.getConnection();

    try {
      await connection.execute(
        `UPDATE messages 
         SET external_message_id = ?, 
             status = ?, 
             sent_at = NOW(), 
             updated_at = NOW() 
         WHERE id = ?`,
        [externalMessageId, 'sent', messageId]
      );

      logger.info('Message updated with external ID', {
        messageId,
        externalMessageId,
      });
    } catch (error) {
      logger.error('Failed to update message with external ID', {
        messageId,
        externalMessageId,
        error,
      });
      // Don't throw - message was sent successfully even if DB update fails
    } finally {
      connection.release();
    }
  }

  /**
   * Handle WhatsApp API errors with detailed logging
   */
  private handleWhatsAppError(
    error: unknown,
    phoneNumber: string
  ): { success: false; error: string } {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;

      logger.error('WhatsApp API error', {
        phoneNumber,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        message: axiosError.message,
      });

      const errorMessage =
        axiosError.response?.data?.error?.message ||
        axiosError.response?.data?.error?.error_user_msg ||
        axiosError.message ||
        'Failed to send WhatsApp message';

      return {
        success: false,
        error: errorMessage,
      };
    }

    logger.error('Unknown error sending WhatsApp message', {
      phoneNumber,
      error,
    });

    return {
      success: false,
      error: 'Unknown error occurred',
    };
  }

  /**
   * Verify WhatsApp API credentials
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/${this.phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          fields: 'id,verified_name,display_phone_number,quality_rating',
        },
        timeout: 5000,
      });

      logger.info('WhatsApp API credentials verified', {
        phoneNumberId: this.phoneNumberId,
        verifiedName: response.data.verified_name,
        displayPhoneNumber: response.data.display_phone_number,
        qualityRating: response.data.quality_rating,
      });

      return true;
    } catch (error) {
      logger.error('Failed to verify WhatsApp credentials', { error });
      return false;
    }
  }
}

export default new WhatsAppService();
