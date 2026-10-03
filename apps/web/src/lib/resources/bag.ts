import {
  defaultResourceReducer,
  loadResourceEndpoint,
  resolveTopicScope,
} from './definitionCore';
import { useSingletonResource } from './hooks';
import type { ResourceDefinition } from './store';

export const inventoryBagResource: ResourceDefinition<'inventory.bag', void> = {
  topic: 'inventory.bag',
  resolveScope: (scopes) => resolveTopicScope('inventory.bag', scopes),
  normalizeParams: () => undefined,
  load: (scope, _params, signal) =>
    loadResourceEndpoint(
      'inventory.bag',
      '/api/combat-v6/inventory?location=bag',
      scope,
      signal,
    ),
  reduce: defaultResourceReducer,
};

/** One complete, unfiltered bag snapshot per active character, shared across scenes. */
export function useInventoryBag(enabled = true) {
  return useSingletonResource(inventoryBagResource, enabled);
}
