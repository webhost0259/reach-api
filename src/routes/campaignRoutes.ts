import { Router } from 'express';
import campaignController from '../controllers/campaignController';
import { authMiddleware as authenticate} from '../middleware/authMiddleware';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();

// Validation middleware
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: errors.array(),
    });
  }
  next();
};

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Campaign management and bulk messaging
 */

/**
 * @swagger
 * /api/campaigns:
 *   post:
 *     summary: Create a new campaign
 *     tags: [Campaigns]
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
 *               - template_id
 *               - recipients
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Black Friday Sale 2024"
 *               description:
 *                 type: string
 *                 example: "Holiday promotional campaign"
 *               template_id:
 *                 type: string
 *                 format: uuid
 *               template_variables:
 *                 type: object
 *                 properties:
 *                   body:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         position:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         sample:
 *                           type: string
 *               recipients:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - phone_number
 *                   properties:
 *                     phone_number:
 *                       type: string
 *                       example: "+1234567890"
 *                     customer_id:
 *                       type: string
 *                       format: uuid
 *                     variables:
 *                       type: object
 *                       example: { "param_1": "John Doe", "param_2": "20%" }
 *               scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-25T10:00:00Z"
 *               send_rate:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 10
 *               retry_failed:
 *                 type: boolean
 *                 default: true
 *               max_retries:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10
 *                 default: 3
 *     responses:
 *       201:
 *         description: Campaign created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Campaign name is required'),
    body('template_id').isUUID().withMessage('Valid template_id is required'),
    // ✅ ADD VALIDATION FOR template_variables (optional)
    body('template_variables')
      .optional()
      .isObject()
      .withMessage('template_variables must be an object'),
    body('template_variables.body')
      .optional()
      .isArray()
      .withMessage('template_variables.body must be an array'),
    body('recipients').isArray({ min: 1 }).withMessage('At least one recipient is required'),
    body('recipients.*.phone_number').notEmpty().withMessage('Phone number is required for each recipient'),
    body('recipients.*.variables')
      .optional()
      .isObject()
      .withMessage('Recipient variables must be an object'),
    body('send_rate').optional().isInt({ min: 1, max: 100 }).withMessage('Send rate must be between 1 and 100'),
    body('max_retries').optional().isInt({ min: 0, max: 10 }).withMessage('Max retries must be between 0 and 10'),
    validate,
  ],
  campaignController.createCampaign
);

/**
 * @swagger
 * /api/campaigns:
 *   get:
 *     summary: Get all campaigns
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, scheduled, queued, sending, paused, completed, cancelled, failed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: List of campaigns
 *       401:
 *         description: Unauthorized
 */
router.get( 
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    validate,
  ],
  campaignController.getCampaigns
);

/**
 * @swagger
 * /api/campaigns/stats:
 *   get:
 *     summary: Get campaign statistics
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Campaign statistics
 */
router.get('/stats', campaignController.getCampaignStats);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   get:
 *     summary: Get campaign by ID
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign details
 *       404:
 *         description: Campaign not found
 */
router.get(
  '/:id',
  [param('id').isUUID().withMessage('Valid campaign ID is required'), validate],
  campaignController.getCampaignById
);

/**
 * @swagger
 * /api/campaigns/{id}/start:
 *   post:
 *     summary: Start a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign started
 *       400:
 *         description: Cannot start campaign
 */
router.post(
  '/:id/start',
  [param('id').isUUID(), validate],
  campaignController.startCampaign
);

/**
 * @swagger
 * /api/campaigns/{id}/pause:
 *   post:
 *     summary: Pause a running campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign paused
 */
router.post(
  '/:id/pause',
  [param('id').isUUID(), validate],
  campaignController.pauseCampaign
);

/**
 * @swagger
 * /api/campaigns/{id}/resume:
 *   post:
 *     summary: Resume a paused campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign resumed
 */
router.post(
  '/:id/resume',
  [param('id').isUUID(), validate],
  campaignController.resumeCampaign
);

/**
 * @swagger
 * /api/campaigns/{id}/cancel:
 *   post:
 *     summary: Cancel a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign cancelled
 */
router.post(
  '/:id/cancel',
  [param('id').isUUID(), validate],
  campaignController.cancelCampaign
);

/**
 * @swagger
 * /api/campaigns/{id}:
 *   delete:
 *     summary: Delete a campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Campaign deleted
 */
router.delete(
  '/:id',
  [param('id').isUUID(), validate],
  campaignController.deleteCampaign
);

/**
 * @swagger
 * /api/campaigns/{id}/recipients:
 *   get:
 *     summary: Get campaign recipients
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, sent, delivered, read, failed]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of recipients
 */
router.get(
  '/:id/recipients',
  [param('id').isUUID(), validate],
  campaignController.getCampaignRecipients
);

/**
 * @swagger
 * /api/campaigns/{id}/recipients:
 *   post:
 *     summary: Add recipients to campaign
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - recipients
 *             properties:
 *               recipients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     phone_number:
 *                       type: string
 *                     customer_id:
 *                       type: string
 *                       format: uuid
 *                     variables:
 *                       type: object
 *     responses:
 *       200:
 *         description: Recipients added
 */
router.post(
  '/:id/recipients',
  [
    param('id').isUUID(),
    body('recipients').isArray({ min: 1 }).withMessage('At least one recipient required'),
    validate,
  ],
  campaignController.addRecipients
);

/**
 * @swagger
 * /api/campaigns/{id}/analytics:
 *   get:
 *     summary: Get campaign analytics history
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Analytics snapshots
 */
router.get(
  '/:id/analytics',
  [param('id').isUUID(), validate],
  campaignController.getCampaignAnalytics
);

/**
 * @swagger
 * /api/campaigns/{id}/logs:
 *   get:
 *     summary: Get campaign activity logs
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Activity logs
 */
router.get(
  '/:id/logs',
  [param('id').isUUID(), validate],
  campaignController.getCampaignLogs
);

/**
 * @swagger
 * /api/campaigns/{id}/snapshot:
 *   post:
 *     summary: Create analytics snapshot
 *     tags: [Campaigns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Snapshot created
 */
router.post(
  '/:id/snapshot',
  [param('id').isUUID(), validate],
  campaignController.createSnapshot
);

export default router;
