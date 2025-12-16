import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import settingsService from '../services/settingsService';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    tenant_id: string;
  };
}

/**
 * Get user profile
 */
export const getProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.userId;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const profile = await settingsService.getProfile(userId);

  res.status(200).json({
    success: true,
    data: profile,
  });
});

/**
 * Update user profile
 */
export const updateProfile = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.userId;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const updatedProfile = await settingsService.updateProfile(userId, req.body);

  // Update localStorage on frontend by returning updated user
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedProfile,
  });
});

/**
 * Change password
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.userId;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const { current_password, new_password } = req.body;

  if (!current_password || !new_password) {
    res.status(400).json({
      success: false,
      error: 'Current password and new password are required',
    });
    return;
  }

  await settingsService.changePassword(userId, {
    current_password,
    new_password,
  });

  res.status(200).json({
    success: true,
    message: 'Password changed successfully',
  });
});

/**
 * Get account statistics
 */
export const getAccountStats = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as AuthRequest).user?.tenant_id;

  if (!tenantId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const stats = await settingsService.getAccountStats(tenantId);

  res.status(200).json({
    success: true,
    data: stats,
  });
});
