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
 *     description: Create a custom WhatsApp message template. Template must be approved by Meta before use.
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
 *               example_values:
 *                 type: array
 *                 description: Example values for placeholders
 *                 items:
 *                   type: string
 *                 example: ["John Doe"]
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
 *                   example: Template created successfully. Awaiting Meta approval.
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
 *                       example: pending
 *       400:
 *         description: Invalid input
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
 *           enum: [pending, approved, rejected]
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
 *     description: Update template details (name, status, etc.)
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
 *                 enum: [pending, approved, rejected]
 *                 description: Updated approval status
 *                 example: approved
 *               rejection_reason:
 *                 type: string
 *                 description: Reason for rejection (if status is rejected)
 *                 example: Template violates WhatsApp policies
 *               meta_template_id:
 *                 type: string
 *                 description: Template ID from Meta (after approval)
 *                 example: meta_12345678
 *     responses:
 *       200:
 *         description: Template updated successfully
 *       400:
 *         description: Invalid input
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
 *     description: Permanently delete a template
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

export default router;
