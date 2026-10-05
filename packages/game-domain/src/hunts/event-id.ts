import { z } from 'zod';

export const HuntEventIdSchema = z
  .string()
  .regex(/^hunt-v[1234]-\d{1,10}-[0-6]$/);
