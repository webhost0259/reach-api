import 'express';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      userId: string;
      email: string;
      tier: string;
      iat?: number;
      exp?: number;
    };
  }
}
