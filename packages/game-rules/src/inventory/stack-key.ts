import {
  ConsumableFactsSchema,
  MaterialFactsSchema,
  SeedFactsSchema,
} from '@daoyou/game-domain/inventory';
import { stableSerializeConsumableSpec } from '@daoyou/game-domain/consumables';

/** Versioned, length-prefixed UTF-8 facts; SQL backfill uses the same encoding. */
export function inventoryStackIdentity(
  definitionId: string,
  data: unknown,
): string | null {
  if (definitionId === 'seed.v1')
    return `seed.v1:${JSON.stringify(SeedFactsSchema.parse(data).seedSpec)}`;
  if (definitionId === 'equipment.v6') return null;
  if (definitionId === 'consumable.v1') {
    const facts = ConsumableFactsSchema.parse(data);
    const spec = facts.spec;
    if (spec.kind !== 'pill')
      return `consumable.v2:${JSON.stringify([facts.name, facts.type, facts.quality, stableSerializeConsumableSpec(spec)])}`;
    // Players compare name, type, quality, effect operations, and appearance.
    const visibleEffect = {
      appearance: spec.alchemyMeta.appearance ?? null,
      operations: spec.operations,
    };
    return `consumable.v4:${JSON.stringify([facts.name, facts.type, facts.quality, stableSerializeConsumableSpec(visibleEffect)])}`;
  }
  if (definitionId !== 'material.v1') return `definition.v1:${definitionId}`;
  const facts = MaterialFactsSchema.parse(data);
  const encoder = new TextEncoder();
  const value = [
    facts.name,
    facts.type,
    facts.rank,
    facts.element ?? '',
    facts.description,
  ]
    .map((part) => `${encoder.encode(part).length}:${part}`)
    .join('');
  return value;
}
