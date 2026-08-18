import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { generateOpenApiDocument } from '../openapi.ts';

export const docsRouter = Router();

const openApiDocument = generateOpenApiDocument();

docsRouter.get('/openapi.json', (_req, res) => {
  res.status(200).json(openApiDocument);
});

docsRouter.use('/docs', apiReference({ url: '/openapi.json' }));
