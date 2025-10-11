import { Router } from 'express';
import authRoutes from './authRoutes';
import messageRoutes from './messageRoutes';
import analyticsRoutes from './analyticsRoutes';
import webhookRoutes from './webhookRoutes';
import templateRoutes from './templateRoutes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/templates', templateRoutes);

export default router;
