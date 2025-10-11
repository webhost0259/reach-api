import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ReachAPI - Multi-Channel Messaging Platform',
      version,
      description: `
        ReachAPI is a production-ready bulk messaging API supporting WhatsApp, SMS, and Email.
        
        ## Features
        - 🔐 JWT Authentication with client_id/client_secret
        - 📨 Multi-channel support (WhatsApp, SMS, Email)
        - 🚀 Redis-backed queue system with retry logic
        - 📊 Real-time analytics and reporting
        - 🔔 Webhook support for delivery status
        - 📋 Template management
        - ⚡ Rate limiting (80 msg/sec for WhatsApp)
        
        ## Authentication
        1. Register a client account
        2. Obtain JWT token using client_id and client_secret
        3. Include token in Authorization header: \`Bearer <token>\`
      `,
      contact: {
        name: 'ReachAPI Support',
        email: 'support@reachapi.com',
        url: 'https://reachapi.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}/api/v1`,
        description: 'Development server',
      },
      {
        url: 'https://api.reachapi.com/api/v1',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT token obtained from /auth/token endpoint',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: { type: 'string', example: 'Error message' },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'Client registration and JWT token management',
      },
      {
        name: 'Messages',
        description: 'Send and manage messages across channels',
      },
      {
        name: 'Analytics',
        description: 'Message statistics and reporting',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for delivery status updates',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts', './src/models/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
