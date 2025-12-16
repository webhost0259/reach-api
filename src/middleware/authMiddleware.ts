import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/database';

export interface AuthRequest extends Request {
  user?: {
    id: string;           // user's id
    email: string;
    tenant_id: string;    // user's tenant_id
  };
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { 
      id: string; 
      email: string;
      tenant_id?: string; // May or may not exist in old tokens
    };

    console.log('🔐 Auth middleware - decoded token:', {
      id: decoded.id,
      email: decoded.email,
      tenant_id: decoded.tenant_id,
    });

    // If tenant_id not in token, fetch from database
    let tenantId = decoded.tenant_id;
    
    if (!tenantId) {
      console.log('⚠️ tenant_id not in token, fetching from database...');
      const userResult: any = await query(
        'SELECT tenant_id FROM users WHERE id = ?',
        [decoded.id]
      );

      if (userResult && userResult.length > 0 && userResult[0].tenant_id) {
        tenantId = userResult[0].tenant_id;
        console.log('✅ Found tenant_id from database:', tenantId);
      } else {
        console.log('❌ User not found or has no tenant_id');
        res.status(401).json({
          success: false,
          error: 'User not found or missing tenant information',
        });
        return;
      }
    }

    // At this point tenantId is guaranteed to be a string
    req.user = {
      id: decoded.id,
      email: decoded.email,
      tenant_id: tenantId as string, // Type assertion since we validated it above
    };

    console.log('✅ Auth complete - req.user:', req.user);

    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
    return;
  }
};
