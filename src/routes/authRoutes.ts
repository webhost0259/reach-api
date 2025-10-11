import { Router } from 'express';
import { register, login, getToken, refreshToken } from '../controllers/authController';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique user identifier
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address
 *           example: "john@example.com"
 *         phone:
 *           type: string
 *           description: User's phone number (optional)
 *           example: "+1234567890"
 *         tier:
 *           type: string
 *           enum: [free, silver, gold, platinum]
 *           description: User's subscription tier
 *           example: "free"
 *         signup_status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           description: Account approval status
 *           example: "pending"
 *         daily_sms_limit:
 *           type: integer
 *           description: Maximum SMS messages per day
 *           example: 5
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Account creation timestamp
 *           example: "2025-10-11T20:00:00Z"
 *
 *     ApiCredentials:
 *       type: object
 *       properties:
 *         client_id:
 *           type: string
 *           description: Client ID for API authentication
 *           example: "client_abc123def456"
 *         client_secret:
 *           type: string
 *           description: Client secret (shown only once during registration)
 *           example: "secret_xyz789uvw012"
 *         environment:
 *           type: string
 *           enum: [test, prod]
 *           description: API environment
 *           example: "test"
 *
 *     AuthToken:
 *       type: object
 *       properties:
 *         token:
 *           type: string
 *           description: JWT authentication token
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         expires_in:
 *           type: string
 *           description: Token expiration duration
 *           example: "24h"
 *         user:
 *           $ref: '#/components/schemas/User'
 *
 *     Error:
 *       type: object
 *       required:
 *         - success
 *         - error
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           description: Human-readable error message
 *           example: "Invalid credentials"
 *         code:
 *           type: string
 *           description: Machine-readable error code
 *           example: "AUTH_INVALID_CREDENTIALS"
 *
 *     ValidationError:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "Validation failed"
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *                 example: "email"
 *               message:
 *                 type: string
 *                 example: "Invalid email format"
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Register a new user account
 *     description: |
 *       Create a new ReachAPI user account with API credentials.
 *       
 *       ## Process Flow
 *       1. Provide email and password
 *       2. Account is created with `pending` status
 *       3. You receive `client_id` and `client_secret` (save these securely!)
 *       4. Admin approves your account
 *       5. Use credentials to obtain JWT token
 *       
 *       ## Important Notes
 *       - `client_secret` is shown **only once** during registration
 *       - Store it securely - it cannot be retrieved later
 *       - New accounts start with `free` tier (5 SMS/day limit)
 *       - Account requires admin approval before sending messages
 *       
 *       ## Rate Limiting
 *       - Public endpoint (no authentication required)
 *       - Limited to 10 registrations per IP per hour
 *     operationId: registerUser
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Valid email address (must be unique)
 *                 example: "john.doe@company.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: Strong password (min 8 characters)
 *                 example: "SecurePass123!"
 *               phone:
 *                 type: string
 *                 pattern: '^\+?[1-9]\d{1,14}$'
 *                 description: Phone number in E.164 format (optional)
 *                 example: "+14155552671"
 *           examples:
 *             minimal:
 *               summary: Minimal registration
 *               value:
 *                 email: "minimal@example.com"
 *                 password: "password123"
 *             complete:
 *               summary: Complete registration
 *               value:
 *                 email: "complete@example.com"
 *                 password: "MySecurePass456!"
 *                 phone: "+14155552671"
 *     responses:
 *       201:
 *         description: User registered successfully
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
 *                   example: "User registered successfully. Awaiting approval."
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     api_credentials:
 *                       $ref: '#/components/schemas/ApiCredentials'
 *             examples:
 *               success:
 *                 summary: Successful registration
 *                 value:
 *                   success: true
 *                   message: "User registered successfully. Awaiting approval."
 *                   data:
 *                     user:
 *                       id: "550e8400-e29b-41d4-a716-446655440000"
 *                       email: "john@example.com"
 *                       tier: "free"
 *                       signup_status: "pending"
 *                       daily_sms_limit: 5
 *                       created_at: "2025-10-11T20:00:00Z"
 *                     api_credentials:
 *                       client_id: "client_abc123def456ghi789"
 *                       client_secret: "secret_xyz789uvw012rst345"
 *                       environment: "test"
 *       400:
 *         description: Invalid input or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               emailExists:
 *                 summary: Email already registered
 *                 value:
 *                   success: false
 *                   error: "Email already registered"
 *                   code: "AUTH_EMAIL_EXISTS"
 *               invalidEmail:
 *                 summary: Invalid email format
 *                 value:
 *                   success: false
 *                   error: "Validation failed"
 *                   details:
 *                     - field: "email"
 *                       message: "Invalid email format"
 *               weakPassword:
 *                 summary: Password too weak
 *                 value:
 *                   success: false
 *                   error: "Validation failed"
 *                   details:
 *                     - field: "password"
 *                       message: "Password must be at least 8 characters"
 *       429:
 *         description: Too many registration attempts
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error: "Too many registration attempts. Please try again later."
 *               code: "RATE_LIMIT_EXCEEDED"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Login with email and password
 *     description: |
 *       Authenticate using email and password to receive a JWT token.
 *       
 *       ## When to use this endpoint
 *       - Web dashboard access
 *       - Mobile app authentication
 *       - User-facing applications
 *       
 *       ## Token Usage
 *       After receiving the token:
 *       1. Store it securely (localStorage, secure cookies)
 *       2. Include in Authorization header: `Bearer <token>`
 *       3. Token expires after 24 hours
 *       4. Use `/auth/refresh` to get a new token
 *       
 *       ## Account Status
 *       - Account must be `approved` by admin
 *       - `pending` accounts cannot login
 *       - `rejected` accounts receive specific error
 *     operationId: loginUser
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Registered email address
 *                 example: "john@example.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Account password
 *                 example: "MySecurePass123!"
 *           examples:
 *             standard:
 *               summary: Standard login
 *               value:
 *                 email: "john@example.com"
 *                 password: "MySecurePass123!"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AuthToken'
 *             example:
 *               success: true
 *               data:
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJlbWFpbCI6ImpvaG5AZXhhbXBsZS5jb20iLCJ0aWVyIjoiZnJlZSIsImlhdCI6MTY5NzA0MDAwMCwiZXhwIjoxNjk3MTI2NDAwfQ.xyz"
 *                 expires_in: "24h"
 *                 user:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   email: "john@example.com"
 *                   tier: "free"
 *                   daily_sms_limit: 5
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidCredentials:
 *                 summary: Wrong email or password
 *                 value:
 *                   success: false
 *                   error: "Invalid credentials"
 *                   code: "AUTH_INVALID_CREDENTIALS"
 *       403:
 *         description: Account not approved or disabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               pending:
 *                 summary: Account pending approval
 *                 value:
 *                   success: false
 *                   error: "Account not approved yet"
 *                   code: "AUTH_ACCOUNT_PENDING"
 *               rejected:
 *                 summary: Account rejected
 *                 value:
 *                   success: false
 *                   error: "Account has been rejected"
 *                   code: "AUTH_ACCOUNT_REJECTED"
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/token:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Get JWT token with API credentials
 *     description: |
 *       Authenticate using `client_id` and `client_secret` to receive a JWT token.
 *       
 *       ## When to use this endpoint
 *       - Server-to-server communication
 *       - Backend integrations
 *       - Automated workflows
 *       - API-only access (no user interface)
 *       
 *       ## Credentials
 *       - `client_id` and `client_secret` obtained during registration
 *       - Store credentials as environment variables
 *       - Never expose credentials in client-side code
 *       - Rotate credentials periodically for security
 *       
 *       ## Token Lifespan
 *       - Tokens expire after 24 hours
 *       - Request new token when expired
 *       - Use `/auth/refresh` for token renewal
 *       
 *       ## Example Integration
 *       ```
 *       # Step 1: Get token
 *       curl -X POST https://api.reachapi.com/api/v1/auth/token \
 *         -H "Content-Type: application/json" \
 *         -d '{
 *           "client_id": "client_abc123",
 *           "client_secret": "secret_xyz789"
 *         }'
 *       
 *       # Step 2: Use token in subsequent requests
 *       curl -X POST https://api.reachapi.com/api/v1/messages/send \
 *         -H "Authorization: Bearer <token>" \
 *         -H "Content-Type: application/json" \
 *         -d '{"phone_number": "+1234567890", "content": "Hello!"}'
 *       ```
 *     operationId: getToken
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - client_secret
 *             properties:
 *               client_id:
 *                 type: string
 *                 description: Client ID from registration
 *                 example: "client_abc123def456ghi789"
 *               client_secret:
 *                 type: string
 *                 format: password
 *                 description: Client secret from registration
 *                 example: "secret_xyz789uvw012rst345"
 *           examples:
 *             production:
 *               summary: Production credentials
 *               value:
 *                 client_id: "client_prod_abc123"
 *                 client_secret: "secret_prod_xyz789"
 *             test:
 *               summary: Test credentials
 *               value:
 *                 client_id: "client_test_def456"
 *                 client_secret: "secret_test_uvw012"
 *     responses:
 *       200:
 *         description: Token generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AuthToken'
 *             example:
 *               success: true
 *               data:
 *                 token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                 expires_in: "24h"
 *                 user:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   email: "api@company.com"
 *                   tier: "gold"
 *       401:
 *         description: Invalid API credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidClientId:
 *                 summary: Invalid client_id
 *                 value:
 *                   success: false
 *                   error: "Invalid API credentials"
 *                   code: "AUTH_INVALID_CLIENT_ID"
 *               invalidSecret:
 *                 summary: Invalid client_secret
 *                 value:
 *                   success: false
 *                   error: "Invalid API credentials"
 *                   code: "AUTH_INVALID_SECRET"
 *               revoked:
 *                 summary: API key revoked
 *                 value:
 *                   success: false
 *                   error: "API credentials have been revoked"
 *                   code: "AUTH_CREDENTIALS_REVOKED"
 *       403:
 *         description: Account not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/token', getToken);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Refresh JWT token
 *     description: |
 *       Obtain a new JWT token using an existing valid token.
 *       
 *       ## When to refresh
 *       - Token expiring soon (within 1 hour)
 *       - Maintain continuous authenticated session
 *       - Proactive token renewal
 *       
 *       ## Refresh Strategy
 *       ```
 *       // Option 1: Refresh on 401 response
 *       if (response.status === 401) {
 *         const newToken = await refreshToken();
 *         // Retry original request
 *       }
 *       
 *       // Option 2: Proactive refresh
 *       if (tokenExpiresIn < 3600) { // Less than 1 hour
 *         await refreshToken();
 *       }
 *       ```
 *       
 *       ## Important
 *       - Original token must still be valid (not expired)
 *       - New token has same expiration duration (24h)
 *       - Old token becomes invalid after refresh
 *     operationId: refreshToken
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
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
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     expires_in:
 *                       type: string
 *                       example: "24h"
 *       401:
 *         description: Invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               expired:
 *                 summary: Token expired
 *                 value:
 *                   success: false
 *                   error: "Token has expired"
 *                   code: "AUTH_TOKEN_EXPIRED"
 *               invalid:
 *                 summary: Invalid token
 *                 value:
 *                   success: false
 *                   error: "Invalid token"
 *                   code: "AUTH_INVALID_TOKEN"
 */
router.post('/refresh', refreshToken);

export default router;
