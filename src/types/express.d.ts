import 'express';

declare namespace Express {
  interface Request {
    user?: {
      userId: string;
      tenant_id: string;
      email: string;
      tier: string;
    };
  }
}

export {}; // Make this a module
