import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import whatsAppConfigService from '../services/whatsAppConfigService';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    tenant_id: string;
  };
}

/**
 * Get WhatsApp configuration for tenant
 */
export const getConfig = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as AuthRequest).user?.tenant_id;

  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const config = await whatsAppConfigService.getConfig(tenantId);

  res.status(200).json({
    success: true,
    data: config,
  });
});

/**
 * Save/Update WhatsApp configuration for tenant
 */
export const saveConfig = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as AuthRequest).user?.tenant_id;

  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const config = await whatsAppConfigService.saveConfig(tenantId, req.body);

  res.status(200).json({
    success: true,
    message: 'WhatsApp configuration saved successfully',
    data: config,
  });
});

/**
 * Test WhatsApp connection for tenant
 */
export const testConnection = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as AuthRequest).user?.tenant_id;
  const { environment } = req.body;

  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  if (!environment || !['test', 'production'].includes(environment)) {
    res.status(400).json({ 
      success: false, 
      error: 'Invalid environment. Must be "test" or "production"' 
    });
    return;
  }

  const isConnected = await whatsAppConfigService.testConnection(tenantId, environment);

  res.status(200).json({
    success: true,
    data: {
      connected: isConnected,
      environment,
    },
  });
});

/**
 * Switch environment for tenant
 */
export const switchEnvironment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as AuthRequest).user?.tenant_id;
  const { environment } = req.body;

  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  if (!environment || !['test', 'production'].includes(environment)) {
    res.status(400).json({ 
      success: false, 
      error: 'Invalid environment. Must be "test" or "production"' 
    });
    return;
  }

  await whatsAppConfigService.switchEnvironment(tenantId, environment);

  res.status(200).json({
    success: true,
    message: `Switched to ${environment} environment`,
  });
});
