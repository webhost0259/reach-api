import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import authService from '../services/authService';
import { RegisterRequest, JWTPayload } from '../types';

interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

/**
 * Register new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const data: RegisterRequest = req.body;

  const result = await authService.register(data);

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Account is now active.',
    data: {
      user: {
        id: result.user.id,
        tenant_id: result.user.tenant_id,
        email: result.user.email,
        account_type: result.user.account_type,
        organization_name: result.user.organization_name,
        tier: result.user.tier,
        signup_status: result.user.signup_status,
      },
      api_credentials: {
        test: {
          client_id: result.apiKeys.test.client_id,
          client_secret: result.apiKeys.test.client_secret_plain!,
        },
        production: {
          client_id: result.apiKeys.production.client_id,
          client_secret: result.apiKeys.production.client_secret_plain!,
        },
      },
      token: result.token,
    },
  });
});

/**
 * Login with email/password
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const { token, user } = await authService.login(email, password);

  res.status(200).json({
    success: true,
    data: {
      token,
      expires_in: '24h',
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        account_type: user.account_type,
        organization_name: user.organization_name,
        tier: user.tier,
        daily_sms_limit: user.daily_sms_limit,
      },
    },
  });
});

/**
 * Get token using API credentials
 */
export const getToken = asyncHandler(async (req: Request, res: Response) => {
  const { client_id, client_secret } = req.body;

  const { token, user } = await authService.authenticateApiKey(client_id, client_secret);

  res.status(200).json({
    success: true,
    data: {
      token,
      expires_in: '24h',
      user: {
        id: user.id,
        tenant_id: user.tenant_id,
        email: user.email,
        tier: user.tier,
      },
    },
  });
});

/**
 * Refresh token
 */
export const refreshToken = asyncHandler(async (req: Request, res: Response) => {
  // Middleware already verified token and set req.user
  const userId = (req as AuthenticatedRequest).user?.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Invalid token' });
    return;
  }

  // Generate new token for the same user
  const newToken = await authService.refreshTokenFromUser(userId);

  res.status(200).json({
    success: true,
    data: {
      token: newToken,
      expires_in: '24h',
    },
  });
});

/**
 * Get current user (NEW - for dashboard)
 */
export const getCurrentUser = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as AuthenticatedRequest).user?.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Not authenticated' });
    return;
  }

  const user = await authService.findUserById(userId);

  res.status(200).json({
    success: true,
    data: {
      id: user.id,
      tenant_id: user.tenant_id,
      email: user.email,
      phone: user.phone,
      account_type: user.account_type,
      organization_name: user.organization_name,
      first_name: user.first_name,
      last_name: user.last_name,
      tier: user.tier,
      daily_sms_limit: user.daily_sms_limit,
      signup_status: user.signup_status,
      created_at: user.created_at,
    },
  });
});
