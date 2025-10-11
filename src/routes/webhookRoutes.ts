import { Router } from 'express';
import { handleWhatsAppWebhook, verifyWhatsAppWebhook } from '../controllers/webhookController';

const router = Router();

/**
 * @swagger
 * /webhooks/whatsapp:
 *   get:
 *     tags:
 *       - Webhooks
 *     summary: Verify WhatsApp webhook
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook verified
 */
router.get('/whatsapp', verifyWhatsAppWebhook);

/**
 * @swagger
 * /webhooks/whatsapp:
 *   post:
 *     tags:
 *       - Webhooks
 *     summary: Receive WhatsApp webhook events
 *     security: []
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/whatsapp', handleWhatsAppWebhook);

export default router;
