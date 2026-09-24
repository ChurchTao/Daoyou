import type { ItemGrant } from '../inventory';
import type { ItemLibraryEntry } from '../lib/itemLibrary';
import { MaterialFactsSchema } from './definitions/materials';
import { seedFactsOf } from './definitions/seeds';

/** The library is only a source: the selected facts are frozen in the reward. */
export function libraryMaterialGrant(entry: ItemLibraryEntry): ItemGrant {
  if (entry.type !== 'material') throw new Error('仅支持材料库来源');
  const p = entry.payload;
  if (p.type === 'seed')
    return {
      definitionId: 'seed.v1',
      quantity: 1,
      instanceData: seedFactsOf(p),
    };
  return {
    definitionId: 'material.v1',
    quantity: 1,
    instanceData: MaterialFactsSchema.parse({
      name: p.name,
      type: p.type,
      rank: p.rank,
      element: p.element ?? null,
      description: p.description ?? '',
    }),
  };
}
