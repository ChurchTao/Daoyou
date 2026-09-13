import type {
  AddStatusOperation,
  AdvanceTrackOperation,
  ChangeGaugeOperation,
  ConditionOperation,
  ConsumableSpec,
  GainProgressOperation,
  IncreaseLifespanOperation,
  PillSpec,
  SpiritFruitSpec,
  RemoveStatusOperation,
  RestoreResourceOperation,
  TalismanSpec,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function isPillSpec(
  spec: ConsumableSpec | null | undefined,
): spec is PillSpec {
  return !!spec && spec.kind === 'pill';
}

export function isTalismanSpec(
  spec: ConsumableSpec | null | undefined,
): spec is TalismanSpec {
  return !!spec && spec.kind === 'talisman';
}

export function isSpiritFruitSpec(
  spec: ConsumableSpec | null | undefined,
): spec is SpiritFruitSpec {
  return !!spec && spec.kind === 'spirit_fruit';
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

export function isSpiritFruitConsumable(
  consumable: Consumable | null | undefined,
): consumable is Consumable & { spec: SpiritFruitSpec } {
  return !!consumable && isSpiritFruitSpec(consumable.spec);
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

export function isGainProgressOperation(
  operation: ConditionOperation,
): operation is GainProgressOperation {
  return operation.type === 'gain_progress';
}

export function isIncreaseLifespanOperation(
  operation: ConditionOperation,
): operation is IncreaseLifespanOperation {
  return operation.type === 'increase_lifespan';
}

export function assertConsumableSpec(value: unknown): ConsumableSpec {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw new Error(
      '消耗品数据缺少有效 spec，请清理旧 consumables 数据后重试。',
    );
  }

  if (value.kind === 'pill') {
    return value as unknown as ConsumableSpec;
  }

  if (value.kind === 'talisman') {
    return value as unknown as ConsumableSpec;
  }

  if (value.kind === 'spirit_fruit') {
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

/**
 * 返回影响消耗品实际使用效果的稳定堆叠键。
 *
 * 炼丹来源、药蕴摘要、批次分布和展示文案都属于追踪/展示元数据，
 * 不应阻止同效果丹药合堆。该键会在写入时持久化，库存查询不再比较 JSONB。
 */
export function buildConsumableStackKey(
  consumable: Pick<Consumable, 'name' | 'type' | 'quality' | 'spec'>,
): string {
  const spec = consumable.spec;
  const stackableSpec = {
    kind: spec.kind,
    ...(spec.kind === 'pill'
      ? {
          ...(spec.alchemyMeta.version === 4
            ? { protocol: 'pill:v4' as const }
            : {}),
          family: spec.family,
          operations: spec.operations,
          consumeRules: spec.consumeRules,
        }
      : spec.kind === 'spirit_fruit'
        ? {
            family: spec.family,
            operations: spec.operations,
            consumeRules: spec.consumeRules,
            source: spec.source,
          }
        : {
          scenario: spec.scenario,
          sessionMode: spec.sessionMode,
          notes: spec.notes,
        }),
    name: consumable.name,
    quality: consumable.quality ?? '凡品',
    type: consumable.type,
  };
  return JSON.stringify(sortJsonValue(stackableSpec));
}
