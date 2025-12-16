import { Router } from 'express';
import {
  getConfig,
  saveConfig,
  testConnection,
  switchEnvironment,
} from '../controllers/whatsappConfigController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all WhatsApp config routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     WhatsAppConfig:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Configuration ID
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         tenant_id:
 *           type: string
 *           format: uuid
 *           description: Tenant identifier (one config per tenant)
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         test_phone_number_id:
 *           type: string
 *           description: WhatsApp Phone Number ID for test environment
 *           example: "123456789012345"
 *         test_business_account_id:
 *           type: string
 *           description: WhatsApp Business Account ID for test environment
 *           example: "987654321098765"
 *         test_access_token:
 *           type: string
 *           description: Meta access token for test environment (encrypted at rest)
 *           example: "EAAxxxxxxxxxxxxx"
 *         test_verify_token:
 *           type: string
 *           description: Webhook verify token for test environment
 *           example: "test_verify_token_123"
 *         prod_phone_number_id:
 *           type: string
 *           description: WhatsApp Phone Number ID for production environment
 *           example: "123456789012345"
 *         prod_business_account_id:
 *           type: string
 *           description: WhatsApp Business Account ID for production environment
 *           example: "987654321098765"
 *         prod_access_token:
 *           type: string
 *           description: Meta access token for production environment (encrypted at rest)
 *           example: "EAAxxxxxxxxxxxxx"
 *         prod_verify_token:
 *           type: string
 *           description: Webhook verify token for production environment
 *           example: "prod_verify_token_456"
 *         webhook_url:
 *           type: string
 *           format: uri
 *           description: Webhook URL for receiving status updates
 *           example: "https://api.yourdomain.com/api/v1/webhooks/whatsapp"
 *         environment:
 *           type: string
 *           enum: [test, production]
 *           description: Currently active environment
 *           example: "test"
 *         is_active:
 *           type: boolean
 *           description: Whether configuration is active
 *           example: true
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Configuration creation timestamp
 *           example: "2025-10-11T20:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2025-10-11T20:30:15Z"
 *
 *     SaveWhatsAppConfigRequest:
 *       type: object
 *       properties:
 *         test_phone_number_id:
 *           type: string
 *           description: Test environment phone number ID
 *           example: "123456789012345"
 *         test_business_account_id:
 *           type: string
 *           description: Test environment business account ID
 *           example: "987654321098765"
 *         test_access_token:
 *           type: string
 *           description: Test environment access token
 *           example: "EAAxxxxxxxxxxxxx"
 *         test_verify_token:
 *           type: string
 *           description: Test environment webhook verify token
 *           example: "test_verify_token_123"
 *         prod_phone_number_id:
 *           type: string
 *           description: Production environment phone number ID
 *           example: "123456789012345"
 *         prod_business_account_id:
 *           type: string
 *           description: Production environment business account ID
 *           example: "987654321098765"
 *         prod_access_token:
 *           type: string
 *           description: Production environment access token
 *           example: "EAAxxxxxxxxxxxxx"
 *         prod_verify_token:
 *           type: string
 *           description: Production environment webhook verify token
 *           example: "prod_verify_token_456"
 *         webhook_url:
 *           type: string
 *           format: uri
 *           description: Webhook URL for status updates
 *           example: "https://api.yourdomain.com/api/v1/webhooks/whatsapp"
 *         environment:
 *           type: string
 *           enum: [test, production]
 *           description: Active environment
 *           example: "test"
 *         is_active:
 *           type: boolean
 *           description: Activate/deactivate configuration
 *           example: true
 *
 *     TestConnectionRequest:
 *       type: object
 *       required:
 *         - environment
 *       properties:
 *         environment:
 *           type: string
 *           enum: [test, production]
 *           description: Environment to test
 *           example: "test"
 *
 *     SwitchEnvironmentRequest:
 *       type: object
 *       required:
 *         - environment
 *       properties:
 *         environment:
 *           type: string
 *           enum: [test, production]
 *           description: Environment to switch to
 *           example: "production"
 */

/**
 * @swagger
 * /whatsapp-config:
 *   get:
 *     tags:
 *       - WhatsApp Configuration
 *     summary: Get WhatsApp API configuration
 *     description: |
 *       Retrieve the WhatsApp Business API configuration for the authenticated user's tenant.
 *       
 *       ## Configuration Scope
 *       - Configuration is stored per tenant (not per user)
 *       - All users in a tenant share the same WhatsApp credentials
 *       - Only one configuration per tenant allowed
 *       
 *       ## Response Includes
 *       - Test environment credentials
 *       - Production environment credentials
 *       - Webhook URL
 *       - Currently active environment
 *       - Configuration status
 *       
 *       ## Security
 *       - Access tokens are decrypted before returning
 *       - Verify tokens are returned in plain text
 *       - Only accessible by authenticated users in the tenant
 *       
 *       ## Use Cases
 *       - Display current configuration in settings
 *       - Pre-fill configuration edit forms
 *       - Verify which environment is active
 *       - Check if configuration exists
 *     operationId: getWhatsAppConfig
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/WhatsAppConfig'
 *             example:
 *               success: true
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 tenant_id: "123e4567-e89b-12d3-a456-426614174000"
 *                 test_phone_number_id: "123456789012345"
 *                 test_business_account_id: "987654321098765"
 *                 test_access_token: "EAAxxxxxxxxxxxxx"
 *                 test_verify_token: "test_verify_token_123"
 *                 prod_phone_number_id: "543210987654321"
 *                 prod_business_account_id: "567890123456789"
 *                 prod_access_token: "EAAyyyyyyyyyyyyyy"
 *                 prod_verify_token: "prod_verify_token_456"
 *                 webhook_url: "https://api.yourdomain.com/api/v1/webhooks/whatsapp"
 *                 environment: "test"
 *                 is_active: true
 *                 created_at: "2025-10-11T20:30:00Z"
 *                 updated_at: "2025-12-15T23:45:00Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Configuration not found (not yet configured)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: null
 *                   example: null
 */
router.get('/', getConfig);

/**
 * @swagger
 * /whatsapp-config:
 *   post:
 *     tags:
 *       - WhatsApp Configuration
 *     summary: Save or update WhatsApp API configuration
 *     description: |
 *       Save or update WhatsApp Business API credentials for the tenant. Creates new configuration if none exists, updates existing otherwise.
 *       
 *       ## Configuration Options
 *       
 *       ### Test Environment (Recommended for Development)
 *       - Use test phone number from Meta Business
 *       - Separate access token for testing
 *       - Safe for development and staging
 *       - No impact on production messages
 *       
 *       ### Production Environment (Live Customers)
 *       - Production phone number
 *       - Production access token
 *       - Used for real customer messages
 *       - Requires approved Business Account
 *       
 *       ## Getting Credentials from Meta
 *       
 *       ### Step 1: Create WhatsApp Business App
 *       1. Go to [Meta for Developers](https://developers.facebook.com/)
 *       2. Create new app → Business → WhatsApp
 *       3. Add WhatsApp product
 *       
 *       ### Step 2: Get Phone Number ID
 *       1. WhatsApp → Getting Started
 *       2. Copy "Phone number ID" under your test/prod number
 *       
 *       ### Step 3: Get Business Account ID
 *       1. WhatsApp → Settings → Business Account
 *       2. Copy "WhatsApp Business Account ID"
 *       
 *       ### Step 4: Generate Access Token
 *       1. Create System User in Business Settings
 *       2. Assign WhatsApp Business Management permission
 *       3. Generate token (never expires recommended)
 *       
 *       ### Step 5: Configure Webhook
 *       1. Use webhook_url from response
 *       2. Set verify token (any secure string)
 *       3. Subscribe to message status updates
 *       
 *       ## Security Features
 *       - Access tokens encrypted with AES-256
 *       - Tokens stored with unique IV per record
 *       - Only tenant users can access/update config
 *       - Audit trail via updated_at timestamp
 *       
 *       ## Partial Updates
 *       - Only provided fields are updated
 *       - Existing fields remain unchanged
 *       - Use COALESCE in SQL to preserve values
 *       
 *       ## Validation
 *       - Phone number IDs validated for format
 *       - Access tokens checked for Meta format
 *       - Webhook URL must be HTTPS (production)
 *       - Verify tokens recommended 32+ chars
 *     operationId: saveWhatsAppConfig
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SaveWhatsAppConfigRequest'
 *           examples:
 *             fullConfig:
 *               summary: Complete configuration (test + production)
 *               value:
 *                 test_phone_number_id: "123456789012345"
 *                 test_business_account_id: "987654321098765"
 *                 test_access_token: "EAAtest1234567890"
 *                 test_verify_token: "test_secure_token_abc123xyz789"
 *                 prod_phone_number_id: "543210987654321"
 *                 prod_business_account_id: "567890123456789"
 *                 prod_access_token: "EAAprod0987654321"
 *                 prod_verify_token: "prod_secure_token_xyz789abc123"
 *                 webhook_url: "https://api.yourdomain.com/api/v1/webhooks/whatsapp"
 *                 environment: "test"
 *                 is_active: true
 *             testOnly:
 *               summary: Test environment only
 *               value:
 *                 test_phone_number_id: "123456789012345"
 *                 test_business_account_id: "987654321098765"
 *                 test_access_token: "EAAtest1234567890"
 *                 test_verify_token: "test_secure_token_abc123"
 *                 webhook_url: "https://api.yourdomain.com/api/v1/webhooks/whatsapp"
 *                 environment: "test"
 *             partialUpdate:
 *               summary: Update only production credentials
 *               value:
 *                 prod_phone_number_id: "543210987654321"
 *                 prod_access_token: "EAAprod0987654321"
 *     responses:
 *       200:
 *         description: Configuration saved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "WhatsApp configuration saved successfully"
 *                 data:
 *                   $ref: '#/components/schemas/WhatsAppConfig'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidPhoneId:
 *                 summary: Invalid phone number ID
 *                 value:
 *                   success: false
 *                   error: "Invalid phone number ID format"
 *               invalidWebhook:
 *                 summary: Invalid webhook URL
 *                 value:
 *                   success: false
 *                   error: "Webhook URL must use HTTPS in production"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', saveConfig);

/**
 * @swagger
 * /whatsapp-config/test:
 *   post:
 *     tags:
 *       - WhatsApp Configuration
 *     summary: Test WhatsApp API connection
 *     description: |
 *       Test the connection to WhatsApp Business API for a specific environment (test or production).
 *       
 *       ## What This Tests
 *       - Validates access token is valid
 *       - Verifies phone number ID exists
 *       - Checks API permissions
 *       - Confirms connectivity to Meta servers
 *       
 *       ## Test Process
 *       1. Retrieves stored credentials for environment
 *       2. Makes authenticated API call to Meta
 *       3. Attempts to fetch phone number details
 *       4. Returns success/failure status
 *       
 *       ## Common Failure Reasons
 *       
 *       ### Invalid Access Token
 *       - Token expired or revoked
 *       - Wrong token for environment
 *       - Insufficient permissions
 *       - System user removed
 *       
 *       ### Invalid Phone Number ID
 *       - Wrong ID copied
 *       - Phone number deleted in Meta
 *       - Not associated with Business Account
 *       
 *       ### API Errors
 *       - Rate limiting
 *       - Meta API downtime
 *       - Network connectivity issues
 *       - Firewall blocking Meta IPs
 *       
 *       ### Configuration Issues
 *       - Environment not configured yet
 *       - Missing required credentials
 *       - Credentials for wrong environment
 *       
 *       ## Best Practices
 *       - Test both environments separately
 *       - Test after updating credentials
 *       - Test before switching environments
 *       - Monitor for token expiration
 *       
 *       ## Meta API Endpoint Used
 *       ```
 *       GET https://graph.facebook.com/v22.0/{phone_number_id}
 *       Authorization: Bearer {access_token}
 *       ```
 *     operationId: testWhatsAppConnection
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TestConnectionRequest'
 *           examples:
 *             testEnv:
 *               summary: Test environment
 *               value:
 *                 environment: "test"
 *             prodEnv:
 *               summary: Production environment
 *               value:
 *                 environment: "production"
 *     responses:
 *       200:
 *         description: Test completed (check connected field for result)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     connected:
 *                       type: boolean
 *                       description: Whether connection was successful
 *                       example: true
 *                     environment:
 *                       type: string
 *                       example: "test"
 *             examples:
 *               success:
 *                 summary: Connection successful
 *                 value:
 *                   success: true
 *                   data:
 *                     connected: true
 *                     environment: "test"
 *               failure:
 *                 summary: Connection failed
 *                 value:
 *                   success: true
 *                   data:
 *                     connected: false
 *                     environment: "production"
 *       400:
 *         description: Invalid environment specified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Invalid environment. Must be 'test' or 'production'"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Configuration not found or credentials missing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "test credentials not configured"
 */
router.post('/test', testConnection);

/**
 * @swagger
 * /whatsapp-config/switch:
 *   post:
 *     tags:
 *       - WhatsApp Configuration
 *     summary: Switch active environment
 *     description: |
 *       Switch between test and production environments for sending messages.
 *       
 *       ## Environment Switching
 *       
 *       ### Test Environment
 *       - **Use for**: Development, staging, testing
 *       - **Safety**: No impact on real customers
 *       - **Numbers**: Test numbers from Meta
 *       - **Billing**: Usually no cost or limited
 *       - **Approval**: May not require full business verification
 *       
 *       ### Production Environment
 *       - **Use for**: Live customer messaging
 *       - **Safety**: Messages go to real users
 *       - **Numbers**: Verified business phone numbers
 *       - **Billing**: Standard WhatsApp messaging costs
 *       - **Approval**: Requires full business verification
 *       
 *       ## When to Switch
 *       
 *       ### Switch to Test
 *       - During development
 *       - Testing new features
 *       - Debugging issues
 *       - Training team members
 *       - Before major changes
 *       
 *       ### Switch to Production
 *       - Launching to customers
 *       - After thorough testing
 *       - Business fully verified
 *       - Production credentials configured
 *       - Team trained and ready
 *       
 *       ## Impact of Switching
 *       - Immediately affects all new messages
 *       - Existing queued messages unaffected
 *       - Webhooks use environment's credentials
 *       - All tenant users affected (tenant-wide setting)
 *       
 *       ## Safety Checks
 *       - Verify environment configured before switching
 *       - Test connection first (recommended)
 *       - Confirm with team before prod switch
 *       - Monitor first messages after switch
 *       
 *       ## Best Practices
 *       1. Configure both environments fully
 *       2. Test thoroughly in test environment
 *       3. Test connection to production before switching
 *       4. Switch during low-traffic period
 *       5. Monitor closely after switching
 *       6. Have rollback plan ready
 *     operationId: switchEnvironment
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SwitchEnvironmentRequest'
 *           examples:
 *             switchToTest:
 *               summary: Switch to test environment
 *               value:
 *                 environment: "test"
 *             switchToProd:
 *               summary: Switch to production environment
 *               value:
 *                 environment: "production"
 *     responses:
 *       200:
 *         description: Environment switched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Switched to test environment"
 *             examples:
 *               toTest:
 *                 summary: Switched to test
 *                 value:
 *                   success: true
 *                   message: "Switched to test environment"
 *               toProd:
 *                 summary: Switched to production
 *                 value:
 *                   success: true
 *                   message: "Switched to production environment"
 *       400:
 *         description: Invalid environment specified
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Invalid environment. Must be 'test' or 'production'"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/switch', switchEnvironment);

export default router;
