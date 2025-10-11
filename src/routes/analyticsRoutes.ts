import { Router } from 'express';
import { getAnalyticsSummary, getMessageStats } from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Apply authentication
router.use(authMiddleware);

/**
 * @swagger
 * /analytics/summary:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get analytics summary
 *     description: Retrieve overall message statistics
 *     responses:
 *       200:
 *         description: Analytics summary
 */
router.get('/summary', getAnalyticsSummary);

/**
 * @swagger
 * /analytics/stats:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get detailed statistics
 *     responses:
 *       200:
 *         description: Detailed statistics
 */
router.get('/stats', getMessageStats);

export default router;
