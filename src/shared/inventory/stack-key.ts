import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { SeedFactsSchema } from '../items/definitions/seeds';
import { stableSerializeConsumableSpec } from '../lib/consumables';
import { calculatePillScore } from '../lib/pillScore';

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
    const stackableSpec = {
      kind: spec.kind,
      family: spec.family,
      operations: spec.operations,
      consumeRules: spec.consumeRules,
      ...(spec.alchemyMeta.version === 4 ? { protocol: 'pill:v4' } : {}),
      appearance: spec.alchemyMeta.appearance ?? null,
      breakthroughTargetRealm:
        spec.alchemyMeta.breakthroughTargetRealm ?? null,
      breakthroughLabel: spec.alchemyMeta.breakthroughLabel ?? null,
      recycleScore: calculatePillScore(facts),
    };
    return `consumable.v3:${JSON.stringify([facts.name, facts.type, facts.quality, facts.score, stableSerializeConsumableSpec(stackableSpec)])}`;
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
