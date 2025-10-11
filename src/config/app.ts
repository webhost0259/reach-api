import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import redoc from 'redoc-express';
import logger from '../utils/logger';
import routes from '../routes';
import { errorHandler } from '../middleware/errorMiddleware';
import swaggerSpec from './swagger';

const app: Application = express();

// Security middleware with relaxed CSP for documentation
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.redoc.ly',
          'https://unpkg.com',
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Required for Redoc
          'https://unpkg.com',
          'https://cdn.redoc.ly',
        ],
        fontSrc: [
          "'self'",
          'data:',
          'https://fonts.gstatic.com',
          'https://cdn.redoc.ly',
        ],
        imgSrc: ["'self'", 'data:', 'https:', 'http:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
      },
    },
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ReachAPI is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// API Documentation - Swagger UI
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'ReachAPI Documentation',
  })
);

// API Documentation - Redoc
app.get(
  '/docs',
  redoc({
    title: 'ReachAPI Documentation',
    specUrl: '/api/v1/openapi.json',
    redocOptions: {
      theme: {
        colors: {
          primary: {
            main: '#3b82f6',
          },
        },
        typography: {
          fontFamily: 'Montserrat, Roboto, sans-serif',
          fontSize: '14px',
          headings: {
            fontFamily: 'Montserrat, sans-serif',
          },
        },
      },
      hideDownloadButton: false,
      expandResponses: '200,201',
      jsonSampleExpandLevel: 2,
    },
  })
);

// Serve OpenAPI spec as JSON
app.get('/api/v1/openapi.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/v1', routes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
  });
});

// Global error handler
app.use(errorHandler);

export default app;
