import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { query, queryOne } from '../config/database';
import { IUser, IApiKey, JwtPayload } from '../types';
import { AppError } from '../middleware/errorMiddleware';

export class AuthService {
  /**
   * Register a new user
   */
  async register(
    email: string,
    password: string,
    phone?: string
  ): Promise<{
    user: IUser;
    apiKey: IApiKey & { client_secret_plain: string };
  }> {
    // Check if user exists
    const existingUser = await queryOne<IUser>('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    // Insert user
    await query(
      `INSERT INTO users (id, email, password_hash, phone, signup_status, tier, daily_sms_limit) 
       VALUES (?, ?, ?, ?, 'pending', 'free', 5)`,
      [userId, email, password_hash, phone || null]
    );

    // Generate API key
    const client_id = `client_${uuidv4().replace(/-/g, '')}`;
    const client_secret = `secret_${uuidv4().replace(/-/g, '')}`;
    const client_secret_hash = await bcrypt.hash(client_secret, 10);
    const apiKeyId = uuidv4();

    await query(
      `INSERT INTO api_keys (id, user_id, client_id, client_secret_hash, environment, status) 
       VALUES (?, ?, ?, ?, 'test', 'active')`,
      [apiKeyId, userId, client_id, client_secret_hash]
    );

    const user = await queryOne<IUser>('SELECT * FROM users WHERE id = ?', [userId]);
    const apiKey = await queryOne<IApiKey>('SELECT * FROM api_keys WHERE id = ?', [apiKeyId]);

    if (!user || !apiKey) {
      throw new AppError('Failed to create user', 500);
    }

    return {
      user,
      apiKey: { ...apiKey, client_secret_plain: client_secret },
    };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string): Promise<{ token: string; user: IUser }> {
    const user = await queryOne<IUser>('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.signup_status !== 'approved') {
      throw new AppError('Account not approved yet', 403);
    }

    const token = this.generateToken(user);

    return { token, user };
  }

  /**
   * Authenticate with client_id and client_secret
   */
  async authenticateApiKey(
    client_id: string,
    client_secret: string
  ): Promise<{ token: string; user: IUser }> {
    const apiKey = await queryOne<IApiKey>(
      'SELECT * FROM api_keys WHERE client_id = ? AND status = "active"',
      [client_id]
    );

    if (!apiKey) {
      throw new AppError('Invalid API credentials', 401);
    }

    const isValidSecret = await bcrypt.compare(client_secret, apiKey.client_secret_hash);

    if (!isValidSecret) {
      throw new AppError('Invalid API credentials', 401);
    }

    const user = await queryOne<IUser>('SELECT * FROM users WHERE id = ?', [apiKey.user_id]);

    if (!user || user.signup_status !== 'approved') {
      throw new AppError('Account not active', 403);
    }

    const token = this.generateToken(user);

    return { token, user };
  }

  /**
   * Refresh token - generate new token from existing valid token
   */
  async refreshTokenFromUser(userId: string): Promise<string> {
    const user = await queryOne<IUser>('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user || user.signup_status !== 'approved') {
      throw new AppError('Account not active', 403);
    }

    return this.generateToken(user);
  }

 /**
 * Generate JWT token
 */
  private generateToken(user: IUser): string {
    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      tier: user.tier,
    };

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new AppError('JWT_SECRET not configured', 500);
    }

    return jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    } as SignOptions);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JwtPayload {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new AppError('JWT_SECRET not configured', 500);
      }

      return jwt.verify(token, secret) as JwtPayload;
    } catch (error) {
      throw new AppError('Invalid or expired token', 401);
    }
  }
}

export default new AuthService();
