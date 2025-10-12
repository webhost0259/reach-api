import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import { WebhookService } from '../services/webhookService';
import { WhatsAppWebhookPayload } from '../types/webhook';
import logger from '../utils/logger';

export const verifyWhatsAppWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    logger.info('Webhook verification request received', { mode, token });

    const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN || 'your_verify_token_here';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('✅ Webhook verified successfully');
      res.status(200).send(challenge);
      return;
    }

    logger.warn('❌ Webhook verification failed', {
      expectedToken: verifyToken,
      receivedToken: token,
      mode,
    });

    res.status(403).json({
      success: false,
      error: 'Verification failed',
    });
  }
);

export const handleWhatsAppWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-hub-signature-256'] as string;

      if (signature && process.env.WHATSAPP_APP_SECRET) {
        const rawBody = JSON.stringify(req.body);
        const isValid = WebhookService.verifySignature(rawBody, signature);

        if (!isValid) {
          logger.warn('❌ Invalid webhook signature');
          res.status(403).json({
            success: false,
            error: 'Invalid signature',
          });
          return;
        }

        logger.info('✅ Webhook signature verified');
      }

      const payload: WhatsAppWebhookPayload = req.body;

      logger.info('📥 Webhook received:', {
        object: payload.object,
        entries: payload.entry?.length || 0,
      });

      if (payload.object !== 'whatsapp_business_account') {
        logger.warn('Invalid webhook object type:', payload.object);
        res.status(400).json({
          success: false,
          error: 'Invalid webhook object',
        });
        return;
      }

      res.status(200).json({ success: true });

      setImmediate(async () => {
        try {
          for (const entry of payload.entry) {
            logger.info(`Processing entry for WABA: ${entry.id}`);

            for (const change of entry.changes) {
              if (change.value.statuses) {
                logger.info(`Processing ${change.value.statuses.length} status update(s)`);
                
                for (const status of change.value.statuses) {
                  try {
                    await WebhookService.processStatusUpdate(status);
                  } catch (error) {
                    logger.error('Error processing status update:', {
                      error,
                      statusId: status.id,
                    });
                  }
                }
              }

              if (change.value.messages) {
                logger.info(`Processing ${change.value.messages.length} inbound message(s)`);
                
                for (const message of change.value.messages) {
                  try {
                    await WebhookService.processInboundMessage(message);
                  } catch (error) {
                    logger.error('Error processing inbound message:', {
                      error,
                      messageId: message.id,
                    });
                  }
                }
              }
            }
          }

          logger.info('✅ Webhook processing completed');
        } catch (error) {
          logger.error('Error in async webhook processing:', error);
        }
      });
    } catch (error) {
      logger.error('❌ Webhook handler error:', error);
      res.status(200).json({
        success: false,
        error: 'Internal processing error',
      });
    }
  }
);
