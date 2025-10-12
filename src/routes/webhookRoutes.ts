import { Router } from 'express';
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from '../controllers/webhookController';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: WhatsApp webhook endpoints
 */

/**
 * @swagger
 * /api/v1/webhooks/whatsapp:
 *   get:
 *     summary: Verify WhatsApp webhook
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification successful
 *       403:
 *         description: Verification failed
 */
router.get('/whatsapp', verifyWhatsAppWebhook);

/**
 * @swagger
 * /api/v1/webhooks/whatsapp:
 *   post:
 *     summary: Receive WhatsApp webhook events
 *     tags: [Webhooks]
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/whatsapp', handleWhatsAppWebhook);

export default router;
