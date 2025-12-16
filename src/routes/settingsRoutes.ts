import { Router } from 'express';
import {
  getProfile,
  updateProfile,
  changePassword,
  getAccountStats,
} from '../controllers/settingsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all settings routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     UserProfile:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique user identifier
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         tenant_id:
 *           type: string
 *           format: uuid
 *           description: Tenant identifier for multi-tenant isolation
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         email:
 *           type: string
 *           format: email
 *           description: User email address (cannot be changed)
 *           example: "john.doe@example.com"
 *         account_type:
 *           type: string
 *           enum: [individual, organization]
 *           description: Account type
 *           example: "individual"
 *         organization_name:
 *           type: string
 *           description: Organization name (only for organization accounts)
 *           example: "Acme Corporation"
 *         first_name:
 *           type: string
 *           description: User first name (only for individual accounts)
 *           example: "John"
 *         last_name:
 *           type: string
 *           description: User last name (only for individual accounts)
 *           example: "Doe"
 *         phone:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           description: Contact phone number
 *           example: "+14155552671"
 *         country:
 *           type: string
 *           description: Country of residence
 *           example: "India"
 *         company_size:
 *           type: string
 *           enum: ['1-10', '11-50', '51-200', '201-500', '500+']
 *           description: Company size (only for organization accounts)
 *           example: "11-50"
 *         industry:
 *           type: string
 *           description: Industry sector (only for organization accounts)
 *           example: "E-commerce"
 *         tier:
 *           type: string
 *           enum: [free, silver, gold, platinum]
 *           description: Current subscription tier
 *           example: "free"
 *         daily_sms_limit:
 *           type: integer
 *           description: Daily message sending limit
 *           example: 5
 *         signup_status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Account approval status
 *           example: "approved"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *           example: "2025-10-11T20:30:00Z"
 *
 *     UpdateProfileRequest:
 *       type: object
 *       properties:
 *         first_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 100
 *           description: First name (individual accounts only)
 *           example: "John"
 *         last_name:
 *           type: string
 *           maxLength: 100
 *           description: Last name (individual accounts only)
 *           example: "Doe"
 *         organization_name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: Organization name (organization accounts only)
 *           example: "Acme Corporation"
 *         phone:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           description: Contact phone number
 *           example: "+14155552671"
 *         country:
 *           type: string
 *           description: Country of residence
 *           example: "India"
 *         company_size:
 *           type: string
 *           enum: ['1-10', '11-50', '51-200', '201-500', '500+']
 *           description: Company size (organization accounts only)
 *           example: "11-50"
 *         industry:
 *           type: string
 *           maxLength: 100
 *           description: Industry sector (organization accounts only)
 *           example: "E-commerce"
 *
 *     ChangePasswordRequest:
 *       type: object
 *       required:
 *         - current_password
 *         - new_password
 *       properties:
 *         current_password:
 *           type: string
 *           description: Current password for verification
 *           example: "OldPassword123!"
 *         new_password:
 *           type: string
 *           minLength: 8
 *           description: New password (minimum 8 characters)
 *           example: "NewSecurePass456!"
 *
 *     AccountStats:
 *       type: object
 *       properties:
 *         messages:
 *           type: object
 *           properties:
 *             total_messages:
 *               type: integer
 *               description: Total messages sent all-time
 *               example: 1248
 *             delivered:
 *               type: integer
 *               description: Successfully delivered messages
 *               example: 1180
 *             failed:
 *               type: integer
 *               description: Failed messages
 *               example: 68
 *             pending:
 *               type: integer
 *               description: Messages currently pending
 *               example: 5
 *             sent_today:
 *               type: integer
 *               description: Messages sent today
 *               example: 23
 *         templates:
 *           type: object
 *           properties:
 *             total_templates:
 *               type: integer
 *               description: Total templates created
 *               example: 8
 *             approved:
 *               type: integer
 *               description: Approved templates
 *               example: 6
 *             pending:
 *               type: integer
 *               description: Templates awaiting approval
 *               example: 1
 *             rejected:
 *               type: integer
 *               description: Rejected templates
 *               example: 1
 */

/**
 * @swagger
 * /settings/profile:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get user profile
 *     description: |
 *       Retrieve the complete profile information for the authenticated user.
 *       
 *       ## Response includes
 *       - User identification (ID, tenant ID)
 *       - Account details (type, email, name)
 *       - Contact information (phone, country)
 *       - Subscription details (tier, daily limit)
 *       - Organization info (if applicable)
 *       
 *       ## Use Cases
 *       - Display user info in dashboard
 *       - Pre-fill profile edit forms
 *       - Verify account status
 *       - Check subscription limits
 *     operationId: getProfile
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *             examples:
 *               individual:
 *                 summary: Individual account
 *                 value:
 *                   success: true
 *                   data:
 *                     id: "550e8400-e29b-41d4-a716-446655440000"
 *                     tenant_id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "john.doe@example.com"
 *                     account_type: "individual"
 *                     first_name: "John"
 *                     last_name: "Doe"
 *                     phone: "+14155552671"
 *                     country: "India"
 *                     tier: "free"
 *                     daily_sms_limit: 5
 *                     signup_status: "approved"
 *                     created_at: "2025-10-11T20:30:00Z"
 *               organization:
 *                 summary: Organization account
 *                 value:
 *                   success: true
 *                   data:
 *                     id: "550e8400-e29b-41d4-a716-446655440000"
 *                     tenant_id: "123e4567-e89b-12d3-a456-426614174000"
 *                     email: "admin@acme.com"
 *                     account_type: "organization"
 *                     organization_name: "Acme Corporation"
 *                     company_size: "51-200"
 *                     industry: "E-commerce"
 *                     phone: "+14155552671"
 *                     country: "United States"
 *                     tier: "gold"
 *                     daily_sms_limit: 1000
 *                     signup_status: "approved"
 *                     created_at: "2025-10-11T20:30:00Z"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/profile', getProfile);

/**
 * @swagger
 * /settings/profile:
 *   put:
 *     tags:
 *       - Settings
 *     summary: Update user profile
 *     description: |
 *       Update profile information for the authenticated user. Only provided fields will be updated.
 *       
 *       ## Editable Fields
 *       
 *       ### For Individual Accounts
 *       - First name
 *       - Last name
 *       - Phone number
 *       - Country
 *       
 *       ### For Organization Accounts
 *       - Organization name
 *       - Company size
 *       - Industry
 *       - Phone number
 *       - Country
 *       
 *       ## Non-Editable Fields
 *       - Email address (permanent)
 *       - Account type (individual/organization)
 *       - Tenant ID
 *       - Subscription tier (upgrade via billing)
 *       - Daily limits (determined by tier)
 *       
 *       ## Validation Rules
 *       - Phone numbers must be in E.164 format
 *       - Names cannot be empty if provided
 *       - Organization name required for organization accounts
 *       
 *       ## Response
 *       Returns the complete updated profile, which should be used to update local storage/cache.
 *     operationId: updateProfile
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *           examples:
 *             updateIndividual:
 *               summary: Update individual account
 *               value:
 *                 first_name: "John"
 *                 last_name: "Smith"
 *                 phone: "+14155552671"
 *                 country: "United States"
 *             updateOrganization:
 *               summary: Update organization account
 *               value:
 *                 organization_name: "Acme Corp Inc."
 *                 company_size: "51-200"
 *                 industry: "SaaS"
 *                 phone: "+14155552672"
 *             partialUpdate:
 *               summary: Partial update (only phone)
 *               value:
 *                 phone: "+442071234567"
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                   example: "Profile updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidPhone:
 *                 summary: Invalid phone format
 *                 value:
 *                   success: false
 *                   error: "Invalid phone number format"
 *                   details:
 *                     - field: "phone"
 *                       message: "Must be in E.164 format (+1234567890)"
 *               emptyName:
 *                 summary: Empty name field
 *                 value:
 *                   success: false
 *                   error: "First name cannot be empty"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put('/profile', updateProfile);

/**
 * @swagger
 * /settings/change-password:
 *   post:
 *     tags:
 *       - Settings
 *     summary: Change user password
 *     description: |
 *       Change the password for the authenticated user. Requires current password for verification.
 *       
 *       ## Security Requirements
 *       - Must provide correct current password
 *       - New password must be at least 8 characters
 *       - New password cannot be same as current
 *       - Passwords are hashed using bcrypt
 *       
 *       ## Best Practices
 *       - Use strong passwords with mix of:
 *         - Uppercase and lowercase letters
 *         - Numbers
 *         - Special characters
 *       - Avoid common patterns
 *       - Don't reuse old passwords
 *       
 *       ## Security Features
 *       - Bcrypt hashing with salt rounds
 *       - Current password verification
 *       - No password hints stored
 *       - Automatic session invalidation (future feature)
 *       
 *       ## After Password Change
 *       - Current session remains active
 *       - User can continue using current JWT token
 *       - Consider logging out and re-authenticating
 *     operationId: changePassword
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *           example:
 *             current_password: "OldPassword123!"
 *             new_password: "NewSecurePass456!"
 *     responses:
 *       200:
 *         description: Password changed successfully
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
 *                   example: "Password changed successfully"
 *       400:
 *         description: Validation error or missing fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               missingField:
 *                 summary: Missing required field
 *                 value:
 *                   success: false
 *                   error: "Current password and new password are required"
 *               weakPassword:
 *                 summary: Weak new password
 *                 value:
 *                   success: false
 *                   error: "New password must be at least 8 characters long"
 *               incorrectCurrent:
 *                 summary: Wrong current password
 *                 value:
 *                   success: false
 *                   error: "Current password is incorrect"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/change-password', changePassword);

/**
 * @swagger
 * /settings/stats:
 *   get:
 *     tags:
 *       - Settings
 *     summary: Get account statistics
 *     description: |
 *       Retrieve comprehensive statistics for the authenticated user's account.
 *       
 *       ## Statistics Included
 *       
 *       ### Message Statistics
 *       - Total messages sent (all-time)
 *       - Successfully delivered messages
 *       - Failed message count
 *       - Currently pending messages
 *       - Messages sent today
 *       
 *       ### Template Statistics
 *       - Total templates created
 *       - Approved templates (ready to use)
 *       - Pending templates (awaiting approval)
 *       - Rejected templates
 *       
 *       ## Use Cases
 *       - Dashboard overview display
 *       - Usage monitoring
 *       - Performance tracking
 *       - Quota management
 *       - Analytics reporting
 *       
 *       ## Multi-Tenant Isolation
 *       Statistics are scoped to the user's tenant, so organization accounts see aggregated data for all users in their tenant.
 *       
 *       ## Caching
 *       Results may be cached for up to 5 minutes for performance. Use query parameter `?fresh=true` to bypass cache (future feature).
 *     operationId: getAccountStats
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AccountStats'
 *             example:
 *               success: true
 *               data:
 *                 messages:
 *                   total_messages: 1248
 *                   delivered: 1180
 *                   failed: 68
 *                   pending: 5
 *                   sent_today: 23
 *                 templates:
 *                   total_templates: 8
 *                   approved: 6
 *                   pending: 1
 *                   rejected: 1
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/stats', getAccountStats);

export default router;
