import { MaterialFactsSchema } from '../items/definitions/materials';

/** Versioned, length-prefixed UTF-8 facts; SQL backfill uses the same encoding. */
export function inventoryStackIdentity(
  definitionId: string,
  data: unknown,
): string | null {
  if (definitionId === 'equipment.v6') return null;
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
