import { REALM_VALUES, type RealmType } from '@shared/types/constants';
import type { ConditionOperation, PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

export function getNextMajorRealm(realm: RealmType): RealmType | null {
  const index = REALM_VALUES.indexOf(realm);
  if (index < 0 || index >= REALM_VALUES.length - 1) {
    return null;
  }

  return REALM_VALUES[index + 1];
}

export function getBreakthroughPillLabel(
  targetRealm: RealmType | null,
): string {
  switch (targetRealm) {
    case '筑基':
      return '筑基丹';
    case '金丹':
      return '降尘丹';
    case '元婴':
      return '护婴丹';
    case '化神':
      return '叩神丹';
    case '炼虚':
      return '洞虚丹';
    case '合体':
      return '合真丹';
    case '大乘':
      return '证道丹';
    case '渡劫':
      return '应劫丹';
    default:
      return targetRealm ? `${targetRealm}破境丹` : '破境丹';
  }
}

export function hasBreakthroughFocusEffect(
  operations: readonly ConditionOperation[],
): boolean {
  return operations.some(
    (operation) =>
      operation.type === 'add_status' &&
      operation.status === 'breakthrough_focus',
  );
}

export function getBreakthroughFocusPillLabel(
  spec: Pick<PillSpec, 'family' | 'operations' | 'alchemyMeta'>,
): string | null {
  if (
    spec.family !== 'breakthrough' ||
    !hasBreakthroughFocusEffect(spec.operations)
  ) {
    return null;
  }

  return (
    spec.alchemyMeta.breakthroughLabel ??
    (spec.alchemyMeta.breakthroughTargetRealm
      ? getBreakthroughPillLabel(spec.alchemyMeta.breakthroughTargetRealm)
      : null)
  );
}

export function isBreakthroughConsumableForRealm(
  consumable: Pick<Consumable, 'spec'>,
  targetRealm: RealmType,
): boolean {
  if (
    consumable.spec.kind !== 'pill' ||
    consumable.spec.family !== 'breakthrough'
  ) {
    return false;
  }

  const pillRealm = consumable.spec.alchemyMeta.breakthroughTargetRealm;
  return pillRealm ? pillRealm === targetRealm : true;
}
