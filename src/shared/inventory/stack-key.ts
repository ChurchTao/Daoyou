import { ConsumableFactsSchema } from '../items/definitions/consumables';
import { MaterialFactsSchema } from '../items/definitions/materials';
import { stableSerializeConsumableSpec } from '../lib/consumables';

/** Versioned, length-prefixed UTF-8 facts; SQL backfill uses the same encoding. */
export function inventoryStackIdentity(
  definitionId: string,
  data: unknown,
): string | null {
  if (definitionId === 'equipment.v6') return null;
  if (definitionId === 'consumable.v1') {
    const facts = ConsumableFactsSchema.parse(data);
    return `consumable.v1:${JSON.stringify([facts.name, facts.type, facts.quality, facts.description, facts.prompt, facts.score, stableSerializeConsumableSpec(facts.spec)])}`;
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
