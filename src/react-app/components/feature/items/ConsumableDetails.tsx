import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { PillDetailGroups } from '../consumables/pillDisplayComponents';
import {
  toPillDisplayModel,
  toSpiritFruitDisplayModel,
} from '../consumables/pillDisplayModel';
import { buildTalismanDetailText } from '../consumables/talismanDisplay';

export function ConsumableDetails({
  data,
  quantity,
}: {
  data: unknown;
  quantity: number;
}) {
  const item = { ...ConsumableFactsSchema.parse(data), quantity };
  if (item.spec.kind === 'talisman')
    return (
      <p className="whitespace-pre-line">{buildTalismanDetailText(item)}</p>
    );
  const model =
    item.spec.kind === 'pill'
      ? toPillDisplayModel({ ...item, spec: item.spec })
      : toSpiritFruitDisplayModel({ ...item, spec: item.spec });
  return (
    <>
      <PillDetailGroups groups={model.detailGroups} />
      <p className="mt-3 whitespace-pre-line">{item.description}</p>
    </>
  );
}
