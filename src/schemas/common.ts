import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const AuthorizationHeaderSchema = z
  .string({ error: 'Missing or invalid Authorization header' })
  .regex(/^Bearer\s+.+$/, 'Missing or invalid Authorization header')
  .openapi({ example: 'Bearer <tenant_api_key>' });
