import { mutationBody } from '@app/components/feature/combat-v6/request';
import { apiFetch } from '@app/lib/api/fetch';
import { consumeResourceMutation } from '@app/lib/resources/mutations';

export async function consumeInventoryItem(
  item: { id: string; revision: number },
  quantity = 1,
) {
  return consumeResourceMutation(
    await apiFetch(
      '/api/cultivator/consume',
      mutationBody({
        consumableId: item.id,
        revision: item.revision,
        quantity,
      }),
    ),
  );
}
