import express from 'express';
import customerGroupController from '../controllers/customerGroupController';
import { authMiddleware as authenticate} from '../middleware/authMiddleware';
import { body } from 'express-validator';
import { validateRequest } from '../middleware/validation';

const router = express.Router();

router.use(authenticate);

/**
 * @swagger
 * /api/customer-groups:
 *   post:
 *     summary: Create a customer group
 *     tags: [Customer Groups]
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
 *               - is_dynamic
 *             properties:
 *               name:
 *                 type: string
 *                 example: VIP Customers
 *               description:
 *                 type: string
 *               is_dynamic:
 *                 type: boolean
 *                 example: false
 *               criteria:
 *                 type: object
 *                 description: For dynamic groups
 *                 properties:
 *                   tags:
 *                     type: array
 *                     items:
 *                       type: string
 *                     example: ["vip", "premium"]
 *                   opt_in_status:
 *                     type: string
 *                     example: opted_in
 *                   country_code:
 *                     type: string
 *               customer_ids:
 *                 type: array
 *                 description: For static groups
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Group created successfully
 */
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Group name is required'),
    body('is_dynamic').isBoolean().withMessage('is_dynamic must be a boolean'),
    body('customer_ids').optional().isArray().withMessage('customer_ids must be an array'),
    validateRequest,
  ],
  customerGroupController.createGroup
);

/**
 * @swagger
 * /api/customer-groups:
 *   get:
 *     summary: Get all customer groups
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of customer groups
 */
router.get('/', customerGroupController.getGroups);

/**
 * @swagger
 * /api/customer-groups/{id}:
 *   get:
 *     summary: Get group by ID
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group details
 */
router.get('/:id', customerGroupController.getGroup);

/**
 * @swagger
 * /api/customer-groups/{id}/customers:
 *   get:
 *     summary: Get customers in a group
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of customers in group
 */
router.get('/:id/customers', customerGroupController.getGroupCustomers);

/**
 * @swagger
 * /api/customer-groups/{id}/customers:
 *   post:
 *     summary: Add customers to group
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_ids
 *             properties:
 *               customer_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Customers added to group
 */
router.post(
  '/:id/customers',
  [body('customer_ids').isArray().withMessage('customer_ids must be an array'), validateRequest],
  customerGroupController.addCustomers
);

/**
 * @swagger
 * /api/customer-groups/{id}/customers:
 *   delete:
 *     summary: Remove customers from group
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_ids
 *             properties:
 *               customer_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Customers removed from group
 */
router.delete(
  '/:id/customers',
  [body('customer_ids').isArray().withMessage('customer_ids must be an array'), validateRequest],
  customerGroupController.removeCustomers
);

/**
 * @swagger
 * /api/customer-groups/{id}:
 *   delete:
 *     summary: Delete group
 *     tags: [Customer Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Group deleted successfully
 */
router.delete('/:id', customerGroupController.deleteGroup);

export default router;
