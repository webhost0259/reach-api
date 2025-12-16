import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database';
import crypto from 'crypto';

interface WhatsAppConfig {
  id?: string;
  tenant_id: string;
  
  // Test credentials
  test_phone_number_id?: string;
  test_business_account_id?: string;
  test_access_token?: string;
  test_verify_token?: string;
  
  // Production credentials
  prod_phone_number_id?: string;
  prod_business_account_id?: string;
  prod_access_token?: string;
  prod_verify_token?: string;
  
  webhook_url?: string;
  is_active?: boolean;
  environment?: 'test' | 'production';
}

class WhatsAppConfigService {
  private encryptionKey: Buffer;
  private algorithm = 'aes-256-cbc';

  constructor() {
    this.encryptionKey = this.initializeEncryptionKey();
  }

  /**
   * Initialize and validate encryption key
   */
  private initializeEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;

    if (!key) {
      throw new Error(
        '❌ ENCRYPTION_KEY is not defined in .env file.\n' +
        '   Run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Case 1: Hex string (64 characters = 32 bytes)
    if (key.length === 64 && /^[0-9a-fA-F]{64}$/.test(key)) {
      console.log('✅ Using 64-character hex ENCRYPTION_KEY (32 bytes)');
      return Buffer.from(key, 'hex');
    }

    // Case 2: Exactly 32 characters (32 bytes UTF-8)
    if (key.length === 32) {
      console.log('✅ Using 32-character UTF-8 ENCRYPTION_KEY (32 bytes)');
      return Buffer.from(key, 'utf-8');
    }

    // Case 3: Wrong length - hash it to get exactly 32 bytes
    console.warn(
      `⚠️  ENCRYPTION_KEY has invalid length (${key.length} characters).\n` +
      `   Expected: 64 hex characters OR 32 UTF-8 characters.\n` +
      `   Auto-fixing by hashing to 32 bytes...\n` +
      `   Recommended: Generate proper key with:\n` +
      `   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    );

    return crypto.createHash('sha256').update(key).digest();
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    if (!text) return '';

    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, this.encryptionKey, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error: any) {
      console.error('❌ Encryption failed:', error.message);
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(text: string): string {
    if (!text) return '';

    try {
      const parts = text.split(':');
      if (parts.length !== 2) {
        throw new Error('Invalid encrypted format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      
      const decipher = crypto.createDecipheriv(this.algorithm, this.encryptionKey, iv);
      
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error: any) {
      console.error('❌ Decryption failed:', error.message);
      return ''; // Return empty string instead of failing
    }
  }

  /**
   * Get WhatsApp config for tenant
   */
  async getConfig(tenantId: string): Promise<WhatsAppConfig | null> {
    console.log('🔍 Getting config for tenant:', tenantId);
    
    const result: any = await query(
      `SELECT * FROM whatsapp_configs WHERE tenant_id = ?`,
      [tenantId]
    );

    console.log('📋 Config query result:', {
      found: result?.length > 0,
      count: result?.length,
      tenantId,
    });

    if (!result || result.length === 0) {
      console.log('❌ No config found for tenant:', tenantId);
      return null;
    }

    const config = result[0];

    console.log('✅ Config found:', {
      id: config.id,
      tenant_id: config.tenant_id,
      environment: config.environment,
      is_active: config.is_active,
      has_test_phone: !!config.test_phone_number_id,
      has_test_business: !!config.test_business_account_id,
      has_test_token: !!config.test_access_token,
    });

    // Decrypt sensitive fields
    if (config.test_access_token) {
      config.test_access_token = this.decrypt(config.test_access_token);
    }
    
    if (config.prod_access_token) {
      config.prod_access_token = this.decrypt(config.prod_access_token);
    }

    return config;
  }

  /**
   * Get active configuration (based on environment)
   */
  async getActiveConfig(tenantId: string): Promise<{
    phoneNumberId: string;
    businessAccountId: string;
    accessToken: string;
    environment: 'test' | 'production';
  }> {
    console.log('🔍 Getting active config for tenant:', tenantId);
    
    const config = await this.getConfig(tenantId);
    
    if (!config) {
      console.log('❌ No config found for tenant:', tenantId);
      throw new Error('WhatsApp configuration not found. Please configure WhatsApp API settings.');
    }

    console.log('✅ Config loaded:', {
      environment: config.environment,
      is_active: config.is_active,
    });

    const isTest = config.environment === 'test';
    const phoneNumberId = isTest ? config.test_phone_number_id : config.prod_phone_number_id;
    const businessAccountId = isTest ? config.test_business_account_id : config.prod_business_account_id;
    const accessToken = isTest ? config.test_access_token : config.prod_access_token;

    console.log('🔧 Environment config:', {
      environment: config.environment,
      isTest,
      hasPhoneNumberId: !!phoneNumberId,
      hasBusinessAccountId: !!businessAccountId,
      hasAccessToken: !!accessToken,
      phoneNumberId: phoneNumberId?.substring(0, 5) + '...',
      businessAccountId: businessAccountId?.substring(0, 5) + '...',
    });

    if (!phoneNumberId || !businessAccountId || !accessToken) {
      console.log('❌ Incomplete credentials for environment:', config.environment);
      throw new Error(
        `${config.environment?.toUpperCase()} environment credentials are incomplete. ` +
        `Please configure all required fields in WhatsApp settings.`
      );
    }

    console.log('✅ Returning active config');

    return {
      phoneNumberId,
      businessAccountId,
      accessToken,
      environment: config.environment || 'test',
    };
  }

  /**
   * Save or update WhatsApp config for tenant
   */
  async saveConfig(tenantId: string, config: Partial<WhatsAppConfig>): Promise<WhatsAppConfig> {
    try {
      const existingConfig = await this.getConfig(tenantId);

      // Encrypt access tokens before saving
      const encryptedConfig = { ...config };
      
      if (config.test_access_token) {
        encryptedConfig.test_access_token = this.encrypt(config.test_access_token);
      }
      
      if (config.prod_access_token) {
        encryptedConfig.prod_access_token = this.encrypt(config.prod_access_token);
      }

      if (existingConfig) {
        // Update existing config
        await query(
          `UPDATE whatsapp_configs SET 
            test_phone_number_id = COALESCE(?, test_phone_number_id),
            test_business_account_id = COALESCE(?, test_business_account_id),
            test_access_token = COALESCE(?, test_access_token),
            test_verify_token = COALESCE(?, test_verify_token),
            prod_phone_number_id = COALESCE(?, prod_phone_number_id),
            prod_business_account_id = COALESCE(?, prod_business_account_id),
            prod_access_token = COALESCE(?, prod_access_token),
            prod_verify_token = COALESCE(?, prod_verify_token),
            webhook_url = COALESCE(?, webhook_url),
            environment = COALESCE(?, environment),
            is_active = COALESCE(?, is_active),
            updated_at = NOW()
          WHERE tenant_id = ?`,
          [
            encryptedConfig.test_phone_number_id,
            encryptedConfig.test_business_account_id,
            encryptedConfig.test_access_token,
            encryptedConfig.test_verify_token,
            encryptedConfig.prod_phone_number_id,
            encryptedConfig.prod_business_account_id,
            encryptedConfig.prod_access_token,
            encryptedConfig.prod_verify_token,
            encryptedConfig.webhook_url,
            encryptedConfig.environment,
            encryptedConfig.is_active,
            tenantId,
          ]
        );
      } else {
        // Create new config
        const configId = uuidv4();
        
        await query(
          `INSERT INTO whatsapp_configs (
            id, tenant_id,
            test_phone_number_id, test_business_account_id, test_access_token, test_verify_token,
            prod_phone_number_id, prod_business_account_id, prod_access_token, prod_verify_token,
            webhook_url, environment, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            configId,
            tenantId,
            encryptedConfig.test_phone_number_id || null,
            encryptedConfig.test_business_account_id || null,
            encryptedConfig.test_access_token || null,
            encryptedConfig.test_verify_token || null,
            encryptedConfig.prod_phone_number_id || null,
            encryptedConfig.prod_business_account_id || null,
            encryptedConfig.prod_access_token || null,
            encryptedConfig.prod_verify_token || null,
            encryptedConfig.webhook_url || null,
            encryptedConfig.environment || 'test',
            encryptedConfig.is_active || false,
          ]
        );
      }

      return this.getConfig(tenantId) as Promise<WhatsAppConfig>;
    } catch (error: any) {
      console.error('❌ Failed to save WhatsApp config:', error.message);
      throw new Error(`Failed to save WhatsApp configuration: ${error.message}`);
    }
  }

  /**
   * Test WhatsApp connection
   */
  async testConnection(tenantId: string, environment: 'test' | 'production'): Promise<boolean> {
    const config = await this.getConfig(tenantId);
    
    if (!config) {
      throw new Error('WhatsApp configuration not found');
    }

    const phoneNumberId = environment === 'test' 
      ? config.test_phone_number_id 
      : config.prod_phone_number_id;
    
    const accessToken = environment === 'test'
      ? config.test_access_token
      : config.prod_access_token;

    if (!phoneNumberId || !accessToken) {
      throw new Error(`${environment} credentials not configured`);
    }

    // Test API call to WhatsApp
    try {
      const axios = require('axios');
      const response = await axios.get(
        `https://graph.facebook.com/v22.0/${phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      return response.status === 200;
    } catch (error: any) {
      console.error('WhatsApp connection test failed:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Switch environment (test/production)
   */
  async switchEnvironment(tenantId: string, environment: 'test' | 'production'): Promise<void> {
    await query(
      `UPDATE whatsapp_configs SET environment = ?, updated_at = NOW() WHERE tenant_id = ?`,
      [environment, tenantId]
    );
  }
}

export default new WhatsAppConfigService();
