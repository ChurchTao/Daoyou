import { z } from 'zod';
import { isEquipmentLevel } from './levels.js';

export const ForgingLevelSchema = z
  .number()
  .int()
  .min(10)
  .max(170)
  .multipleOf(10)
  .refine(isEquipmentLevel, '道装必须属于九个境界档位');
