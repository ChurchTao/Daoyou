import { z } from 'zod';
import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import { CONSUMABLE_ITEM } from '@daoyou/game-content/items/consumables';
import { ConsumableFactsSchema } from '@daoyou/game-domain/inventory';
import type { InventoryShowcaseSnapshot } from '@daoyou/game-domain/items/catalog';

const AlchemyOutputSchema = ConsumableFactsSchema.strip().extend({
  quantity: z.number().int().positive(),
});

/** 每炉只展示品质最高的完美成丹，使用炼成时的事实而非当前库存。 */
export function alchemyShowcaseSnapshot(
  outputs: readonly unknown[],
): InventoryShowcaseSnapshot | undefined {
  let selected: z.infer<typeof AlchemyOutputSchema> | undefined;
  for (const output of outputs) {
    const parsed = AlchemyOutputSchema.safeParse(output);
    if (!parsed.success) continue;
    const pill = parsed.data;
    if (
      pill.type !== '丹药' ||
      pill.spec.kind !== 'pill' ||
      pill.spec.alchemyMeta.appearance !== 'perfect'
    )
      continue;
    if (
      !selected ||
      QUALITY_ORDER[pill.quality] > QUALITY_ORDER[selected.quality]
    ) {
      selected = pill;
    }
  }
  if (!selected) return undefined;
  const { quantity, ...instanceData } = selected;
  return {
    definitionId: CONSUMABLE_ITEM.id,
    name: selected.name,
    quantity,
    instanceData,
  };
}
