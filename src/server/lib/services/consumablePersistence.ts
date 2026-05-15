import * as schema from '@server/lib/drizzle/schema';
import { assertConsumableSpec, stableSerializeConsumableSpec } from '@shared/lib/consumables';
import type { Consumable } from '@shared/types/cultivator';
import type { ConsumableType, Quality } from '@shared/types/constants';

export type ConsumableRow = typeof schema.consumables.$inferSelect;

export function mapConsumableRow(row: ConsumableRow): Consumable {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ConsumableType,
    quality: row.quality as Quality,
    quantity: row.quantity,
    description: row.description || undefined,
    prompt: row.prompt || undefined,
    score: row.score || 0,
    spec: assertConsumableSpec(row.spec),
  };
}

export function serializeConsumableSpec(spec: Consumable['spec']): string {
  return stableSerializeConsumableSpec(spec);
}
