import axios, { AxiosError } from 'axios';
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
    id: string;
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
   */
  async sendTemplateMessage(
    phoneNumber: string,
    templateName: string = 'hello_world',
    languageCode: string = 'en_US',
    parameters?: Array<{ type: string; text: string }>
  ): Promise<{
    success: boolean;
    messageId?: string;
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

      const messageId = response.data.messages[0]?.id;

      logger.info('WhatsApp template message sent successfully', {
        phoneNumber: cleanPhone,
        messageId,
        templateName,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return this.handleWhatsAppError(error, phoneNumber);
    }
  }

  /**
   * Send a text message (ONLY works in test mode with approved recipients)
   * For production, use sendTemplateMessage instead
   */
  async sendTextMessage(
    phoneNumber: string,
    message: string
  ): Promise<{
    success: boolean;
    messageId?: string;
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

      const messageId = response.data.messages[0]?.id;

      logger.info('WhatsApp text message sent successfully', {
        phoneNumber: cleanPhone,
        messageId,
      });

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      return this.handleWhatsAppError(error, phoneNumber);
    }
  }

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

  async verifyCredentials(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.apiUrl}/${this.phoneNumberId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        params: {
          fields: 'id,verified_name,display_phone_number',
        },
        timeout: 5000,
      });

      logger.info('WhatsApp API credentials verified', {
        phoneNumberId: this.phoneNumberId,
        verifiedName: response.data.verified_name,
      });

      return true;
    } catch (error) {
      logger.error('Failed to verify WhatsApp credentials', { error });
      return false;
    }
  }
}

export default new WhatsAppService();
