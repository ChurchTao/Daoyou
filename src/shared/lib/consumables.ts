import type { Consumable } from '@shared/types/cultivator';
import type {
  AddStatusOperation,
  AdvanceTrackOperation,
  ChangeGaugeOperation,
  ConditionOperation,
  ConsumableSpec,
  PillSpec,
  RemoveStatusOperation,
  RestoreResourceOperation,
  TalismanSpec,
} from '@shared/types/consumable';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isPillSpec(spec: ConsumableSpec | null | undefined): spec is PillSpec {
  return !!spec && spec.kind === 'pill';
}

export function isTalismanSpec(
  spec: ConsumableSpec | null | undefined,
): spec is TalismanSpec {
  return !!spec && spec.kind === 'talisman';
}

export function isPillConsumable(
  consumable: Consumable | null | undefined,
): consumable is Consumable & { spec: PillSpec } {
  return !!consumable && isPillSpec(consumable.spec);
}

export function isTalismanConsumable(
  consumable: Consumable | null | undefined,
): consumable is Consumable & { spec: TalismanSpec } {
  return !!consumable && isTalismanSpec(consumable.spec);
}

export function isRestoreResourceOperation(
  operation: ConditionOperation,
): operation is RestoreResourceOperation {
  return operation.type === 'restore_resource';
}

export function isChangeGaugeOperation(
  operation: ConditionOperation,
): operation is ChangeGaugeOperation {
  return operation.type === 'change_gauge';
}

export function isRemoveStatusOperation(
  operation: ConditionOperation,
): operation is RemoveStatusOperation {
  return operation.type === 'remove_status';
}

export function isAddStatusOperation(
  operation: ConditionOperation,
): operation is AddStatusOperation {
  return operation.type === 'add_status';
}

export function isAdvanceTrackOperation(
  operation: ConditionOperation,
): operation is AdvanceTrackOperation {
  return operation.type === 'advance_track';
}

export function assertConsumableSpec(
  value: unknown,
): ConsumableSpec {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new Error('消耗品数据缺少有效 spec，请清理旧 consumables 数据后重试。');
  }

  if (value.kind === 'pill') {
    return value as unknown as ConsumableSpec;
  }

  if (value.kind === 'talisman') {
    return value as unknown as ConsumableSpec;
  }

  throw new Error('消耗品 spec.kind 非法，请清理旧 consumables 数据后重试。');
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJsonValue);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortJsonValue(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function stableSerializeConsumableSpec(spec: ConsumableSpec): string {
  return JSON.stringify(sortJsonValue(spec));
}
