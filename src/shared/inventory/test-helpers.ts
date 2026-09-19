import { addItems as planItems } from './index';
import { inventoryStackIdentity } from './stack-key';

/** Pure planner tests supply opaque keys; hashing is a server persistence concern. */
export function addItems(
  ...args: [
    Parameters<typeof planItems>[0],
    Parameters<typeof planItems>[1],
    'bag' | 'storage',
    boolean,
    () => string,
  ]
) {
  return planItems(
    ...args,
    inventoryStackIdentity(args[1].definitionId, args[1].instanceData),
  );
}
