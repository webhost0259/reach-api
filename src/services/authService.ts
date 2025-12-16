import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query as executeQuery} from '../config/database';
import { IUser, IApiKey, RegisterRequest, JWTPayload } from '../types';

class AuthService {
  private JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private JWT_EXPIRES_IN = '24h';

  /**
   * Register new user with multi-tenant support
   */
  async register(data: RegisterRequest) {
    const { email, password, phone, account_type = 'individual', organization_name, first_name, last_name, company_size, industry, country = 'India' } = data;

    // Check if email exists
    const existingUser = await this.findUserByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Validate organization_name if account_type is organization
    if (account_type === 'organization' && !organization_name) {
      throw new Error('Organization name is required for organization accounts');
    }

    // Generate unique IDs
    const userId = uuidv4();
    const tenant_id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    // Auto-approve for now
    const signup_status = 'approved';
    const approved_at = new Date();

    // Create user
    const userQuery = `
      INSERT INTO users (
        id, tenant_id, email, password_hash, phone, 
        account_type, organization_name, first_name, last_name,
        company_size, industry, country, signup_status, approved_at,
        tier, daily_sms_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', 5)
    `;

    await executeQuery(userQuery, [
      userId,
      tenant_id,
      email,
      passwordHash,
      phone || null,
      account_type,
      organization_name || null,
      first_name || null,
      last_name || null,
      company_size || null,
      industry || null,
      country,
      signup_status,
      approved_at,
    ]);

    // Get created user
    const user = await this.findUserById(userId);

    // Create API keys (test and production)
    const testKey = await this.createApiKey(userId, tenant_id, 'test');
    const prodKey = await this.createApiKey(userId, tenant_id, 'prod');

    // Generate JWT token for immediate login
    const token = this.generateToken({
      id: user.id,              // ✅ Changed from userId to id
      tenant_id: user.tenant_id,
      email: user.email,
      tier: user.tier,
    });

    return {
      user,
      apiKeys: {
        test: testKey,
        production: prodKey,
      },
      token,
    };
  }

  /**
   * Login with email and password
   */
  async login(email: string, password: string) {
    const user = await this.findUserByEmail(email);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash!);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check approval status
    if (user.signup_status !== 'approved') {
      throw new Error(`Account is ${user.signup_status}`);
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,              // ✅ Changed from userId to id
      tenant_id: user.tenant_id,
      email: user.email,
      tier: user.tier,
    });

    return { token, user };
  }

  /**
   * Authenticate with API credentials (client_id/client_secret)
   */
  async authenticateApiKey(client_id: string, client_secret: string) {
    // Find API key
    const query = 'SELECT * FROM api_keys WHERE client_id = ? AND status = "active"';
    const results = await executeQuery(query, [client_id]);

    if (!results || results.length === 0) {
      throw new Error('Invalid API credentials');
    }

    const apiKey = results[0];

    // Verify secret
    const isValid = await bcrypt.compare(client_secret, apiKey.client_secret_hash);
    if (!isValid) {
      throw new Error('Invalid API credentials');
    }

    // Get user
    const user = await this.findUserById(apiKey.user_id);

    // Check approval
    if (user.signup_status !== 'approved') {
      throw new Error('Account not approved');
    }

    // Generate token
    const token = this.generateToken({
      id: user.id,              // ✅ Changed from userId to id
      tenant_id: user.tenant_id,
      email: user.email,
      tier: user.tier,
    });

    return { token, user };
  }

  /**
   * Generate JWT token
   */
  generateToken(payload: JWTPayload): string {
    return jwt.sign(
      payload, 
      this.JWT_SECRET, 
      { expiresIn: this.JWT_EXPIRES_IN } as jwt.SignOptions
    );
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.JWT_SECRET) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Refresh token
   */
  async refreshTokenFromUser(userId: string): Promise<string> {
    const user = await this.findUserById(userId);

    if (user.signup_status !== 'approved') {
      throw new Error('Account not approved');
    }

    return this.generateToken({
      id: user.id,              // ✅ Changed from userId to id
      tenant_id: user.tenant_id,
      email: user.email,
      tier: user.tier,
    });
  }

  /**
   * Create API key
   */
  private async createApiKey(user_id: string, tenant_id: string, environment: 'test' | 'prod'): Promise<IApiKey> {
    const id = uuidv4();
    const client_id = `client_${environment}_${crypto.randomBytes(16).toString('hex')}`;
    const client_secret = `secret_${environment}_${crypto.randomBytes(32).toString('hex')}`;
    const client_secret_hash = await bcrypt.hash(client_secret, 10);

    const query = `
      INSERT INTO api_keys (id, user_id, tenant_id, client_id, client_secret_hash, environment, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `;

    await executeQuery(query, [id, user_id, tenant_id, client_id, client_secret_hash, environment]);

    return {
      id,
      user_id,
      tenant_id,
      client_id,
      client_secret_hash,
      client_secret_plain: client_secret,
      environment,
      status: 'active',
      created_at: new Date(),
    };
  }

  async findUserById(id: string): Promise<IUser> {
    const query = 'SELECT * FROM users WHERE id = ?';
    const results = await executeQuery(query, [id]);

    if (!results || results.length === 0) {
      throw new Error('User not found');
    }

    return results[0];
  }

  async findUserByEmail(email: string): Promise<IUser | null> {
    const query = 'SELECT * FROM users WHERE email = ?';
    const results = await executeQuery(query, [email]);
    return results && results.length > 0 ? results[0] : null;
  }
}

export default new AuthService();
