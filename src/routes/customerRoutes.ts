import express from 'express';
import customerController from '../controllers/customerController';
import { authMiddleware } from '../middleware/authMiddleware';
import { body, query } from 'express-validator';
import { validateRequest } from '../middleware/validation'; 
const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - first_name
 *               - mobile_number
 *             properties:
 *               first_name:
 *                 type: string
 *                 example: John
 *               last_name:
 *                 type: string
 *                 example: Doe
 *               mobile_number:
 *                 type: string
 *                 example: "+918870692077"
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               country_code:
 *                 type: string
 *                 example: "+91"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["premium", "vip"]
 *               custom_fields:
 *                 type: object
 *                 example: { "city": "Mumbai", "age": 25 }
 *               notes:
 *                 type: string
 *               opt_in_status:
 *                 type: string
 *                 enum: [opted_in, opted_out, pending]
 *                 default: pending
 *     responses:
 *       201:
 *         description: Customer created successfully
 */
router.post(
  '/',
  [
    body('first_name').notEmpty().withMessage('First name is required'),
    body('mobile_number')
      .notEmpty()
      .withMessage('Mobile number is required')
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid mobile number format (use E.164)'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    body('opt_in_status')
      .optional()
      .isIn(['opted_in', 'opted_out', 'pending'])
      .withMessage('Invalid opt-in status'),
    validateRequest,
  ],
  customerController.createCustomer
);

/**
 * @swagger
 * /api/customers:
 *   get:
 *     summary: Get all customers with filters
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name, phone, or email
 *       - in: query
 *         name: opt_in_status
 *         schema:
 *           type: string
 *           enum: [opted_in, opted_out, pending]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, blocked, deleted]
 *       - in: query
 *         name: country_code
 *         schema:
 *           type: string
 *       - in: query
 *         name: created_from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: created_to
 *         schema:
 *           type: string
 *           format: date
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
 *         description: List of customers
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    validateRequest,
  ],
  customerController.getCustomers
);

/**
 * @swagger
 * /api/customers/stats:
 *   get:
 *     summary: Get customer statistics
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer statistics
 */
router.get('/stats', customerController.getStats);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
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
 *         description: Customer details
 *       404:
 *         description: Customer not found
 */
router.get('/:id', customerController.getCustomer);

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
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
 *     responses:
 *       200:
 *         description: Customer updated successfully
 */
router.put(
  '/:id',
  [
    body('mobile_number')
      .optional()
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Invalid mobile number format'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('tags').optional().isArray().withMessage('Tags must be an array'),
    validateRequest,
  ],
  customerController.updateCustomer
);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     summary: Delete customer (soft delete)
 *     tags: [Customers]
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
 *         description: Customer deleted successfully
 */
router.delete('/:id', customerController.deleteCustomer);

/**
 * @swagger
 * /api/customers/bulk/import:
 *   post:
 *     summary: Bulk import customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customers
 *             properties:
 *               customers:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Import results
 */
router.post(
  '/bulk/import',
  [body('customers').isArray().withMessage('Customers must be an array'), validateRequest],
  customerController.bulkImport
);

/**
 * @swagger
 * /api/customers/csv/upload:
 *   post:
 *     summary: Upload CSV to import customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - csv_content
 *             properties:
 *               csv_content:
 *                 type: string
 *                 example: "first_name,last_name,mobile_number\nJohn,Doe,+918870692077"
 *     responses:
 *       200:
 *         description: Import results
 */
router.post('/csv/upload', customerController.uploadCSV);

/**
 * @swagger
 * /api/customers/csv/template:
 *   get:
 *     summary: Download CSV import template
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template file
 */
router.get('/csv/template', customerController.downloadTemplate);

/**
 * @swagger
 * /api/customers/csv/export:
 *   get:
 *     summary: Export customers to CSV
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: opt_in_status
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CSV file download
 */
router.get('/csv/export', customerController.exportCSV);

export default router;
