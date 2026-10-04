import {
  TOWER_ELIGIBLE_REALMS,
  TOWER_MAX_FLOOR,
  TOWER_MIN_REALM,
} from '@daoyou/game-rules/tower';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { z } from 'zod';
const SeasonKeySchema = z
  .string()
  .regex(/^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])@Asia\/Shanghai$/);
export const TowerQuerySchema = z.object({
  seasonKey: SeasonKeySchema.optional(),
  realm: z
    .enum(REALM_VALUES)
    .refine((realm) => TOWER_ELIGIBLE_REALMS.includes(realm), '蜃楼境界未开放')
    .default(TOWER_MIN_REALM),
  floor: z.coerce.number().int().min(1).max(TOWER_MAX_FLOOR).default(1),
});
export const TowerRegenerateSchema = z.strictObject({
  seasonKey: SeasonKeySchema,
  expectedFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .nullable(),
});
