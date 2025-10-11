import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorMiddleware';
import authService from '../services/authService';

/**
 * Register new user
 */
export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, phone } = req.body;

  const result = await authService.register(email, password, phone);

  res.status(201).json({
    success: true,
    message: 'User registered successfully. Awaiting approval.',
    data: {
      user: {
        id: result.user.id,
        email: result.user.email,
        tier: result.user.tier,
        signup_status: result.user.signup_status,
      },
      api_credentials: {
        client_id: result.apiKey.client_id,
        client_secret: result.apiKey.client_secret_plain, // Plain secret shown only once
        environment: result.apiKey.environment,
      },
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
        email: user.email,
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
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  // Verify current token
  const payload = authService.verifyToken(token);

  // Generate new token for the same user
  const newToken = await authService.refreshTokenFromUser(payload.userId);

  res.status(200).json({
    success: true,
    data: {
      token: newToken,
      expires_in: '24h',
    },
  });
});
