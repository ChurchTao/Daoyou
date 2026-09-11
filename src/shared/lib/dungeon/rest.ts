import type { Consumable } from '../../types/cultivator';

export function isDungeonRecoveryPill(item: Pick<Consumable, 'spec'>) {
  return (
    item.spec.kind === 'pill' &&
    item.spec.operations.some((op) => op.type === 'restore_resource') &&
    item.spec.operations.every(
      (op) => op.type === 'restore_resource' || op.type === 'change_gauge',
    )
  );
}

export function canUseDungeonRecoveryPill(
  run: { status: string; activeBattleId?: string | null },
  item: Pick<Consumable, 'spec'>,
) {
  return (
    !run.activeBattleId &&
    ['EXPLORING', 'LOOTING'].includes(run.status) &&
    isDungeonRecoveryPill(item)
  );
}
