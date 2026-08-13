import path from 'path';
import swaggerJsdoc, { Options } from 'swagger-jsdoc';

// swagger-jsdoc scans route files for `@swagger`/`@openapi` JSDoc blocks.
// __dirname points at src/ under ts-node-dev (dev) and dist/ under a
// compiled `node dist/index.js` (production) — so the extension has to
// match whichever one is actually running. tsc preserves comments by
// default (no `removeComments` in tsconfig.json), so the same annotations
// work unmodified in both.
const isProduction = process.env.NODE_ENV === 'production';
const routesGlob = path.join(__dirname, 'routes', `*.${isProduction ? 'js' : 'ts'}`);

const options: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LUMINA API',
      version: '0.1.0',
      description:
        'API for the LUMINA multimodal AI creative platform — auth, projects, and image/video/3D/audio generation.',
    },
    servers: [{ url: '/api', description: 'Relative to this server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string', nullable: true },
            avatar: { type: 'string', nullable: true },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            user: { $ref: '#/components/schemas/User' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Generation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string', enum: ['image', 'video', '3d', 'audio'] },
            prompt: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
            outputUrl: { type: 'string', nullable: true },
            metadata: { type: 'object', nullable: true },
            error: { type: 'string', nullable: true },
            projectId: { type: 'string' },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [routesGlob],
};

export const swaggerSpec = swaggerJsdoc(options);
