import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { consumeBagConsumable, findBagTalisman } from './BagConsumables';
import { mapConsumableRow } from './consumablePersistence';

export class TalismanScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TalismanScenarioError';
  }
}

export async function consumeFirstTalismanByScenario(
  cultivatorId: string,
  scenario: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{
  itemId: string;
  remaining: ReturnType<typeof mapConsumableRow> | null;
}> {
  const q = executor ?? getExecutor();
  const row = (await findBagTalisman(cultivatorId, scenario, q))[0];
  if (!row?.id)
    throw new TalismanScenarioError('缺少随身符箓，请先从洞府宝库取出');
  const result = await consumeBagConsumable(cultivatorId, row.id, 1, q);
  return { itemId: row.id, remaining: result.remaining };
}
