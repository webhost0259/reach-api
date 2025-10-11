import { Router } from 'express';
import {
  sendMessage,
  sendBulkMessages,
  getMessageById,
  getMessages,
  scheduleMessage,
} from '../controllers/messageController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication to all message routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique message identifier
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: User who sent the message
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         phone_number:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           description: Recipient phone number (E.164 format)
 *           example: "+14155552671"
 *         content:
 *           type: string
 *           description: Message content
 *           example: "Hello! Your order has been confirmed."
 *         status:
 *           type: string
 *           enum: [queued, processing, sent, delivered, failed]
 *           description: Current message status
 *           example: "delivered"
 *         error_message:
 *           type: string
 *           description: Error details if message failed
 *           example: null
 *         attempts:
 *           type: integer
 *           description: Number of send attempts
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Message creation timestamp
 *           example: "2025-10-11T20:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *           example: "2025-10-11T20:30:15Z"
 *
 *     SendMessageRequest:
 *       type: object
 *       required:
 *         - phone_number
 *         - content
 *       properties:
 *         phone_number:
 *           type: string
 *           pattern: '^\+?[1-9]\d{1,14}$'
 *           description: Recipient phone number in E.164 format
 *           example: "+14155552671"
 *         content:
 *           type: string
 *           minLength: 1
 *           maxLength: 1600
 *           description: Message text content (max 1600 chars)
 *           example: "Hello! Your verification code is 123456."
 *         template_id:
 *           type: string
 *           format: uuid
 *           description: Optional template ID for pre-approved messages
 *           example: "789e0123-e45b-67c8-d901-234567890abc"
 *
 *     BulkMessageRequest:
 *       type: object
 *       required:
 *         - messages
 *       properties:
 *         messages:
 *           type: array
 *           minItems: 1
 *           maxItems: 1000
 *           description: Array of messages to send (max 1000 per request)
 *           items:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *
 *     MessageListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         data:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Message'
 *         pagination:
 *           type: object
 *           properties:
 *             page:
 *               type: integer
 *               example: 1
 *             limit:
 *               type: integer
 *               example: 10
 *             total:
 *               type: integer
 *               example: 150
 *             totalPages:
 *               type: integer
 *               example: 15
 */

/**
 * @swagger
 * /messages/send:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Send a single message
 *     description: |
 *       Send a single SMS message via WhatsApp Business API or SMS gateway.
 *       
 *       ## Features
 *       - Automatic queue management
 *       - Retry logic for failed messages (up to 3 attempts)
 *       - Real-time status tracking
 *       - Rate limiting per user tier
 *       
 *       ## Message Flow
 *       1. Message validated and queued
 *       2. Worker picks up from Redis queue
 *       3. Sent via WhatsApp Business API
 *       4. Status updated in real-time
 *       5. Delivery receipt via webhook
 *       
 *       ## Rate Limits by Tier
 *       - **Free**: 5 messages/day
 *       - **Silver**: 100 messages/day
 *       - **Gold**: 1,000 messages/day
 *       - **Platinum**: 10,000 messages/day
 *       
 *       ## Phone Number Format
 *       Use E.164 format: `+[country code][number]`
 *       - ✅ Valid: `+14155552671`
 *       - ❌ Invalid: `4155552671`, `(415) 555-2671`
 *       
 *       ## Message Length
 *       - Maximum: 1600 characters
 *       - Longer messages will be rejected
 *       - Consider using templates for consistency
 *       
 *       ## Error Handling
 *       Messages can fail for several reasons:
 *       - Invalid phone number
 *       - Daily limit exceeded
 *       - Account not approved
 *       - WhatsApp API unavailable
 *     operationId: sendMessage
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendMessageRequest'
 *           examples:
 *             simple:
 *               summary: Simple text message
 *               value:
 *                 phone_number: "+14155552671"
 *                 content: "Hello! Your order #12345 has been confirmed."
 *             withTemplate:
 *               summary: Using template
 *               value:
 *                 phone_number: "+14155552671"
 *                 content: "Your verification code is 123456"
 *                 template_id: "789e0123-e45b-67c8-d901-234567890abc"
 *             international:
 *               summary: International number
 *               value:
 *                 phone_number: "+442071234567"
 *                 content: "Your appointment is confirmed for tomorrow at 10 AM."
 *     responses:
 *       200:
 *         description: Message queued successfully
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
 *                   example: "Message queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     message_id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     status:
 *                       type: string
 *                       example: "queued"
 *                     queue_position:
 *                       type: integer
 *                       example: 5
 *             example:
 *               success: true
 *               message: "Message queued successfully"
 *               data:
 *                 message_id: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "queued"
 *                 queue_position: 5
 *                 estimated_delivery: "2025-10-11T20:31:00Z"
 *       400:
 *         description: Invalid request or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             examples:
 *               invalidPhone:
 *                 summary: Invalid phone number format
 *                 value:
 *                   success: false
 *                   error: "Invalid phone number format"
 *                   details:
 *                     - field: "phone_number"
 *                       message: "Must be in E.164 format (+1234567890)"
 *               contentTooLong:
 *                 summary: Message content too long
 *                 value:
 *                   success: false
 *                   error: "Message content exceeds maximum length"
 *                   details:
 *                     - field: "content"
 *                       message: "Maximum 1600 characters allowed"
 *       401:
 *         description: Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Daily limit exceeded or account not approved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               limitExceeded:
 *                 summary: Daily limit reached
 *                 value:
 *                   success: false
 *                   error: "Daily message limit exceeded"
 *                   code: "LIMIT_EXCEEDED"
 *                   details:
 *                     current_usage: 5
 *                     daily_limit: 5
 *                     resets_at: "2025-10-12T00:00:00Z"
 *               notApproved:
 *                 summary: Account pending approval
 *                 value:
 *                   success: false
 *                   error: "Account not approved for sending messages"
 *                   code: "ACCOUNT_NOT_APPROVED"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/send', sendMessage);

/**
 * @swagger
 * /messages/bulk:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Send bulk messages
 *     description: |
 *       Send multiple messages in a single API call. Ideal for campaigns, notifications, and alerts.
 *       
 *       ## Features
 *       - Send up to 1,000 messages per request
 *       - Automatic deduplication
 *       - Batch queue processing
 *       - Individual message tracking
 *       - Partial success handling
 *       
 *       ## Use Cases
 *       - Marketing campaigns
 *       - Event notifications
 *       - Appointment reminders
 *       - Order updates
 *       - Emergency alerts
 *       
 *       ## Processing
 *       - Messages queued immediately
 *       - Processed in order received
 *       - Rate limited per tier (80 msg/sec)
 *       - Failed messages automatically retried
 *       
 *       ## Best Practices
 *       1. Validate phone numbers before sending
 *       2. Use templates for consistency
 *       3. Monitor delivery status via webhook
 *       4. Handle partial failures gracefully
 *       5. Respect user opt-out preferences
 *       
 *       ## CSV Upload
 *       ```
 *       # Prepare CSV file
 *       phone_number,content
 *       +14155552671,Hello John!
 *       +14155552672,Hello Jane!
 *       
 *       # Convert to JSON and send
 *       curl -X POST https://api.reachapi.com/api/v1/messages/bulk \
 *         -H "Authorization: Bearer <token>" \
 *         -H "Content-Type: application/json" \
 *         -d @messages.json
 *       ```
 *     operationId: sendBulkMessages
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkMessageRequest'
 *           examples:
 *             campaign:
 *               summary: Marketing campaign
 *               value:
 *                 messages:
 *                   - phone_number: "+14155552671"
 *                     content: "Flash Sale! 50% off all items today only!"
 *                   - phone_number: "+14155552672"
 *                     content: "Flash Sale! 50% off all items today only!"
 *                   - phone_number: "+442071234567"
 *                     content: "Flash Sale! 50% off all items today only!"
 *             reminders:
 *               summary: Appointment reminders
 *               value:
 *                 messages:
 *                   - phone_number: "+14155552671"
 *                     content: "Reminder: Your appointment is tomorrow at 10 AM"
 *                   - phone_number: "+14155552672"
 *                     content: "Reminder: Your appointment is tomorrow at 2 PM"
 *     responses:
 *       200:
 *         description: Bulk messages queued successfully
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
 *                   example: "Bulk messages queued successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 100
 *                     queued:
 *                       type: integer
 *                       example: 98
 *                     failed:
 *                       type: integer
 *                       example: 2
 *                     message_ids:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["msg-001", "msg-002", "msg-003"]
 *                     failed_messages:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           phone_number:
 *                             type: string
 *                           error:
 *                             type: string
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       403:
 *         description: Bulk sending limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/bulk', sendBulkMessages);

/**
 * @swagger
 * /messages/{id}:
 *   get:
 *     tags:
 *       - Messages
 *     summary: Get message by ID
 *     description: |
 *       Retrieve detailed information about a specific message including status, delivery details, and attempts.
 *       
 *       ## Response includes
 *       - Current status (queued, sent, delivered, failed)
 *       - Delivery timestamps
 *       - Error details if failed
 *       - Number of retry attempts
 *       - Queue position if pending
 *       
 *       ## Status Flow
 *       `queued` → `processing` → `sent` → `delivered`
 *       
 *       Any status can transition to `failed` if errors occur.
 *     operationId: getMessageById
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Message UUID
 *         schema:
 *           type: string
 *           format: uuid
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Message details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       404:
 *         description: Message not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', getMessageById);

/**
 * @swagger
 * /messages:
 *   get:
 *     tags:
 *       - Messages
 *     summary: List all messages
 *     description: |
 *       Retrieve a paginated list of messages with optional filtering.
 *       
 *       ## Filtering
 *       - By status: `?status=delivered`
 *       - By date range: `?from=2025-10-01&to=2025-10-31`
 *       - By phone: `?phone_number=+14155552671`
 *       
 *       ## Sorting
 *       - Newest first: `?sort=-created_at` (default)
 *       - Oldest first: `?sort=created_at`
 *       
 *       ## Pagination
 *       - Default: 10 messages per page
 *       - Max: 100 messages per page
 *       - Use `page` and `limit` parameters
 *     operationId: getMessages
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Results per page
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [queued, processing, sent, delivered, failed]
 *         description: Filter by message status
 *       - name: from
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD)
 *       - name: to
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MessageListResponse'
 */
router.get('/', getMessages);

/**
 * @swagger
 * /messages/schedule:
 *   post:
 *     tags:
 *       - Messages
 *     summary: Schedule a message for future delivery
 *     description: |
 *       Schedule a message to be sent at a specific date and time.
 *       
 *       ## Features
 *       - Schedule up to 30 days in advance
 *       - Automatic timezone handling
 *       - Can cancel before send time
 *       - Supports all message types
 *       
 *       ## Time Format
 *       Use ISO 8601 format: `2025-10-15T14:30:00Z`
 *     operationId: scheduleMessage
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SendMessageRequest'
 *               - type: object
 *                 required:
 *                   - scheduled_at
 *                 properties:
 *                   scheduled_at:
 *                     type: string
 *                     format: date-time
 *                     description: ISO 8601 timestamp
 *                     example: "2025-10-15T14:30:00Z"
 *     responses:
 *       200:
 *         description: Message scheduled successfully
 *       400:
 *         description: Invalid schedule time
 */
router.post('/schedule', scheduleMessage);

export default router;
