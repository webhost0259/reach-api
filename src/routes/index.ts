import { Router } from 'express';
import authRoutes from './authRoutes';
import messageRoutes from './messageRoutes';
import analyticsRoutes from './analyticsRoutes';
import webhookRoutes from './webhookRoutes';
import templateRoutes from './templateRoutes';
import settingsRoutes from './settingsRoutes';
import whatsappConfigRoutes from './whatsappConfigRoutes';
import campaignRoutes from './campaignRoutes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/templates', templateRoutes);
router.use('/settings', settingsRoutes);
router.use('/whatsapp-config', whatsappConfigRoutes);
router.use('/campaigns', campaignRoutes);

export default router;
