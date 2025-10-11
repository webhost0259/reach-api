import { Router } from 'express';
import authRoutes from './authRoutes';
import messageRoutes from './messageRoutes';
import analyticsRoutes from './analyticsRoutes';
import webhookRoutes from './webhookRoutes';

const router = Router();

// Mount route modules
router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/webhooks', webhookRoutes);

export default router;
