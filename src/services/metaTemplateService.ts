import axios from 'axios';
import logger from '../utils/logger';
import whatsAppConfigService from './whatsAppConfigService';

interface MetaTemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
  }>;
}

interface SubmitTemplateData {
  name: string;
  language: string;
  category: string;
  header_type?: string;
  header_content?: string;
  body_text: string;
  footer_text?: string;
  buttons?: any[];
  example_values?: string[];
}

export class MetaTemplateService {
  private baseUrl = 'https://graph.facebook.com/v21.0';

  /**
   * Submit template to Meta for approval
   */
  async submitTemplate(
    userId: string,
    templateData: SubmitTemplateData
  ): Promise<{ id: string; status: string }> {
    try {
      logger.info('Starting template submission to Meta', { 
        userId, 
        templateName: templateData.name 
      });

      // Get WhatsApp config
      let config;
      try {
        config = await whatsAppConfigService.getActiveConfig(userId);
      } catch (configError: any) {
        logger.error('Failed to get WhatsApp config', { 
          userId, 
          error: configError.message 
        });
        throw new Error(
          'WhatsApp configuration not found or incomplete. Please configure your WhatsApp Business API credentials first.'
        );
      }

      const { businessAccountId, accessToken } = config;

      logger.info('WhatsApp config loaded', { 
        userId, 
        businessAccountId,
        hasAccessToken: !!accessToken 
      });

      // Build components
      const components: MetaTemplateComponent[] = [];

      // Header
      if (
        templateData.header_type && 
        templateData.header_type !== 'none' && 
        templateData.header_content
      ) {
        const headerComponent: MetaTemplateComponent = {
          type: 'HEADER',
          format: templateData.header_type.toUpperCase() as any,
        };

        if (templateData.header_type === 'text') {
          headerComponent.text = templateData.header_content;
          
          // Add example for header if it has variables
          const headerVarCount = (templateData.header_content.match(/\{\{\d+\}\}/g) || []).length;
          if (headerVarCount > 0 && templateData.example_values && templateData.example_values.length > 0) {
            headerComponent.example = {
              header_text: [templateData.example_values[0]],
            };
          }
        }

        components.push(headerComponent);
      }

      // Body (required)
      const bodyComponent: MetaTemplateComponent = {
        type: 'BODY',
        text: templateData.body_text,
      };

      // Add example values for body placeholders
      const bodyVarCount = (templateData.body_text.match(/\{\{\d+\}\}/g) || []).length;
      if (bodyVarCount > 0 && templateData.example_values && templateData.example_values.length > 0) {
        bodyComponent.example = {
          body_text: [templateData.example_values],
        };
      }

      components.push(bodyComponent);

      // Footer
      if (templateData.footer_text) {
        components.push({
          type: 'FOOTER',
          text: templateData.footer_text,
        });
      }

      // Buttons
      if (templateData.buttons && templateData.buttons.length > 0) {
        components.push({
          type: 'BUTTONS',
          buttons: templateData.buttons,
        });
      }

      // Submit to Meta
      const payload = {
        name: templateData.name,
        language: templateData.language,
        category: templateData.category.toUpperCase(),
        components,
      };

      logger.info('Submitting template to Meta API', { 
        userId, 
        url: `${this.baseUrl}/${businessAccountId}/message_templates`,
        payload: JSON.stringify(payload, null, 2)
      });

      const response = await axios.post(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout
        }
      );

      logger.info('Template submitted to Meta successfully', {
        userId,
        templateName: templateData.name,
        metaTemplateId: response.data.id,
        status: response.data.status,
      });

      return {
        id: response.data.id,
        status: response.data.status || 'PENDING',
      };
    } catch (error: any) {
      // Enhanced error logging
      if (error.response) {
        // Meta API returned an error
        logger.error('Meta API error response', {
          userId,
          templateName: templateData.name,
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2),
          headers: error.response.headers,
        });

        // Extract detailed error message
        const metaError = error.response.data?.error;
        let errorMessage = 'Failed to submit template to Meta';

        if (metaError) {
          if (metaError.message) {
            errorMessage = metaError.message;
          } else if (metaError.error_user_msg) {
            errorMessage = metaError.error_user_msg;
          } else if (metaError.error_user_title) {
            errorMessage = metaError.error_user_title;
          }

          // Add error subcode if available
          if (metaError.error_subcode) {
            errorMessage += ` (Error code: ${metaError.error_subcode})`;
          }

          // Add field-specific errors
          if (metaError.error_data?.details) {
            errorMessage += `. Details: ${metaError.error_data.details}`;
          }
        }

        throw new Error(errorMessage);
      } else if (error.request) {
        // Request was made but no response received
        logger.error('No response from Meta API', {
          userId,
          templateName: templateData.name,
          error: error.message,
        });
        throw new Error('No response from Meta API. Please check your internet connection and try again.');
      } else {
        // Something else went wrong
        logger.error('Unexpected error submitting to Meta', {
          userId,
          templateName: templateData.name,
          error: error.message,
          stack: error.stack,
        });
        throw new Error(error.message || 'Unexpected error occurred while submitting template');
      }
    }
  }

  /**
   * Get template status from Meta
   */
  async getTemplateStatus(
    tenantId: string,  // ✅ Should be tenantId, not userId
    metaTemplateId: string
  ): Promise<{
    status: string;
    rejection_reason?: string;
  }> {
    try {
      console.log('🔍 Getting template status from Meta:', { tenantId, metaTemplateId });
      
      const { accessToken } = await whatsAppConfigService.getActiveConfig(tenantId);

      const response = await axios.get(
        `${this.baseUrl}/${metaTemplateId}`,
        {
          params: {
            fields: 'name,status,rejected_reason',
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      console.log('✅ Template status from Meta:', response.data);

      return {
        status: response.data.status,
        rejection_reason: response.data.rejected_reason,
      };
    } catch (error: any) {
      logger.error('Failed to get template status from Meta', {
        error: error.response?.data || error.message,
        tenantId,  // ✅ Changed from userId
        metaTemplateId,
      });
      throw error;
    }
  }

  /**
   * Get all templates from Meta
   */
  async listMetaTemplates(userId: string): Promise<any[]> {
    try {
      const { businessAccountId, accessToken } = 
        await whatsAppConfigService.getActiveConfig(userId);

      const response = await axios.get(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        {
          params: {
            fields: 'name,status,language,category,components,rejected_reason',
            limit: 100,
          },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.data.data || [];
    } catch (error: any) {
      logger.error('Failed to list templates from Meta', {
        error: error.response?.data || error.message,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete template from Meta
   */
  async deleteMetaTemplate(
    userId: string,
    templateName: string
  ): Promise<boolean> {
    try {
      const { businessAccountId, accessToken } = 
        await whatsAppConfigService.getActiveConfig(userId);

      await axios.delete(
        `${this.baseUrl}/${businessAccountId}/message_templates`,
        {
          params: { name: templateName },
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      logger.info('Template deleted from Meta', { userId, templateName });
      return true;
    } catch (error: any) {
      logger.error('Failed to delete template from Meta', {
        error: error.response?.data || error.message,
        userId,
        templateName,
      });
      return false;
    }
  }
}

export default new MetaTemplateService();
