import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import * as templateController from '../controllers/templateController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * tags:
 *   name: Templates
 *   description: WhatsApp message template management
 */

/**
 * @swagger
 * /api/v1/templates:
 *   post:
 *     summary: Create a new message template
 *     description: Create a custom WhatsApp message template. Set submit_to_meta to true to automatically submit for approval, or false to save as draft.
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - template_code
 *               - body_text
 *             properties:
 *               name:
 *                 type: string
 *                 description: User-friendly template name
 *                 example: Welcome Message
 *               template_code:
 *                 type: string
 *                 description: Unique template identifier (lowercase, underscore separated)
 *                 example: welcome_new_user
 *               language:
 *                 type: string
 *                 description: Template language code
 *                 default: en_US
 *                 example: en_US
 *               category:
 *                 type: string
 *                 enum: [marketing, utility, authentication]
 *                 default: utility
 *                 description: Template category
 *                 example: utility
 *               header_type:
 *                 type: string
 *                 enum: [none, text, image, video, document]
 *                 default: none
 *                 description: Header type
 *               header_content:
 *                 type: string
 *                 description: Header text or media URL
 *                 example: Welcome to our service!
 *               body_text:
 *                 type: string
 *                 description: Template body with placeholders {{1}}, {{2}}, etc.
 *                 example: Hello {{1}}, welcome to our service!
 *               footer_text:
 *                 type: string
 *                 description: Optional footer text (max 60 chars)
 *                 example: Powered by ReachAPI
 *               buttons:
 *                 type: array
 *                 description: Optional buttons (quick reply, URL, phone)
 *                 items:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [QUICK_REPLY, URL, PHONE_NUMBER]
 *                     text:
 *                       type: string
 *                     url:
 *                       type: string
 *                     phone_number:
 *                       type: string
 *                 example: [{"type": "URL", "text": "Visit Website", "url": "https://example.com"}]
 *               example_values:
 *                 type: array
 *                 description: Example values for placeholders
 *                 items:
 *                   type: string
 *                 example: ["John Doe"]
 *               submit_to_meta:
 *                 type: boolean
 *                 description: If true, submits template to Meta immediately. If false, saves as draft.
 *                 default: false
 *                 example: true
 *     responses:
 *       201:
 *         description: Template created successfully
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
 *                   example: Template created and submitted to Meta for approval.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     name:
 *                       type: string
 *                       example: Welcome Message
 *                     template_code:
 *                       type: string
 *                       example: welcome_new_user
 *                     status:
 *                       type: string
 *                       enum: [draft, pending, approved, rejected]
 *                       example: pending
 *                     meta_template_id:
 *                       type: string
 *                       example: 1234567890
 *       400:
 *         description: Invalid input or placeholder mismatch
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Template code already exists
 */
router.post('/', templateController.createTemplate);

/**
 * @swagger
 * /api/v1/templates:
 *   get:
 *     summary: List all templates
 *     description: Get paginated list of templates for authenticated user with optional filters
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected, paused, disabled]
 *         description: Filter by approval status
 *         example: approved
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [marketing, utility, authentication]
 *         description: Filter by category
 *         example: utility
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Results per page
 *         example: 20
 *     responses:
 *       200:
 *         description: List of templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Unauthorized
 */
router.get('/', templateController.listTemplates);

/**
 * @swagger
 * /api/v1/templates/stats:
 *   get:
 *     summary: Get template statistics
 *     description: Get statistics about templates including counts by status and category
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template statistics
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
 *                     total:
 *                       type: integer
 *                       example: 10
 *                     draft:
 *                       type: integer
 *                       example: 2
 *                     pending:
 *                       type: integer
 *                       example: 5
 *                     approved:
 *                       type: integer
 *                       example: 4
 *                     rejected:
 *                       type: integer
 *                       example: 1
 *                     byCategory:
 *                       type: object
 *                       properties:
 *                         marketing:
 *                           type: integer
 *                           example: 3
 *                         utility:
 *                           type: integer
 *                           example: 5
 *                         authentication:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', templateController.getTemplateStats);

/**
 * @swagger
 * /api/v1/templates/{templateId}:
 *   get:
 *     summary: Get template by ID
 *     description: Retrieve detailed information about a specific template
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Template details
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
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:templateId', templateController.getTemplate);

/**
 * @swagger
 * /api/v1/templates/{templateId}:
 *   patch:
 *     summary: Update template
 *     description: Update template details (name only for approved templates, full edit for drafts)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Updated template name
 *                 example: Updated Welcome Message
 *               status:
 *                 type: string
 *                 enum: [draft, pending, approved, rejected]
 *                 description: Updated approval status (admin only)
 *                 example: approved
 *               rejection_reason:
 *                 type: string
 *                 description: Reason for rejection (if status is rejected)
 *                 example: Template violates WhatsApp policies
 *               meta_template_id:
 *                 type: string
 *                 description: Template ID from Meta (after approval)
 *                 example: 1234567890
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Invalid input or only drafts can be edited
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to update this template
 *       404:
 *         description: Template not found
 */
router.patch('/:templateId', templateController.updateTemplate);

/**
 * @swagger
 * /api/v1/templates/{templateId}:
 *   delete:
 *     summary: Delete template
 *     description: Permanently delete a template (also removes from Meta if submitted)
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Template deleted successfully
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
 *                   example: Template deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to delete this template
 *       404:
 *         description: Template not found
 */
router.delete('/:templateId', templateController.deleteTemplate);

/**
 * @swagger
 * /api/v1/templates/{templateId}/submit:
 *   post:
 *     summary: Submit draft template to Meta
 *     description: Submit an existing draft template to Meta for approval. Template status will change from 'draft' to 'pending'.
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Template submitted to Meta successfully
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
 *                   example: Template submitted to Meta for approval
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     status:
 *                       type: string
 *                       example: pending
 *                     meta_template_id:
 *                       type: string
 *                       example: 1234567890
 *                     submitted_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-12-16T00:35:00.000Z
 *       400:
 *         description: Template is not a draft or WhatsApp config incomplete
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to submit this template
 *       404:
 *         description: Template not found
 *       500:
 *         description: Failed to submit to Meta (check error message)
 */
router.post('/:templateId/submit', templateController.submitToMeta);

/**
 * @swagger
 * /api/v1/templates/{templateId}/sync:
 *   post:
 *     summary: Sync template status from Meta
 *     description: Check the current approval status of a template from Meta and update local database. Use this to check if a pending template has been approved or rejected.
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template UUID
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Template status synced successfully
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
 *                   example: Template status synced from Meta
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: 550e8400-e29b-41d4-a716-446655440000
 *                     status:
 *                       type: string
 *                       enum: [draft, pending, approved, rejected, paused, disabled]
 *                       example: approved
 *                     rejection_reason:
 *                       type: string
 *                       nullable: true
 *                       example: null
 *                     approved_at:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: 2025-12-16T00:40:00.000Z
 *                     last_synced_at:
 *                       type: string
 *                       format: date-time
 *                       example: 2025-12-16T00:45:00.000Z
 *       400:
 *         description: Template not submitted to Meta yet
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Not authorized to sync this template
 *       404:
 *         description: Template not found or not submitted to Meta
 *       500:
 *         description: Failed to sync from Meta
 */
router.post('/:templateId/sync', templateController.syncTemplateStatus);

/**
 * @swagger
 * /api/v1/templates/sync-all/meta:
 *   post:
 *     summary: Sync all pending templates
 *     description: Sync approval status for all pending templates from Meta. Useful for batch checking multiple templates at once.
 *     tags: [Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Templates synced successfully
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
 *                   example: Synced 5 templates
 *                 data:
 *                   type: object
 *                   properties:
 *                     synced_count:
 *                       type: integer
 *                       description: Number of successfully synced templates
 *                       example: 5
 *                     error_count:
 *                       type: integer
 *                       description: Number of templates that failed to sync
 *                       example: 0
 *                     synced_ids:
 *                       type: array
 *                       description: IDs of successfully synced templates
 *                       items:
 *                         type: string
 *                       example: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"]
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Partial failure (check synced_count vs error_count)
 */
router.post('/sync-all/meta', templateController.syncAllTemplates);

export default router;
