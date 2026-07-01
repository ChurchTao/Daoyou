import type { AttributeModifierConfig } from '@shared/engine/battle-v5/core/configs';
import {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import type { BattleInitConfigV5 } from '@shared/engine/battle-v5/setup/types';
import { isConditionStatusActive } from '@shared/lib/condition';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
import type { Cultivator } from '@shared/types/cultivator';
import {
  type TowerBlessingId,
  type TowerFloorKind,
} from '@shared/lib/tower';
import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';
import { ConditionService } from '@server/lib/services/ConditionService';

const PRIMARY_ATTRIBUTES = [
  AttributeType.VITALITY,
  AttributeType.SPIRIT,
  AttributeType.SPEED,
  AttributeType.WILLPOWER,
  AttributeType.WISDOM,
] as const;

const WOUND_ORDER: ConditionStatusKey[] = [
  'minor_wound',
  'major_wound',
  'near_death',
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function createModifier(
  attrType: AttributeType,
  value: number,
): AttributeModifierConfig {
  return {
    attrType,
    type: ModifierType.MULTIPLY,
    value,
  };
}

function appendRepeatedModifiers(
  target: AttributeModifierConfig[],
  attrTypes: readonly AttributeType[],
  multiplier: number,
  stacks: number,
) {
  for (let index = 0; index < stacks; index += 1) {
    for (const attrType of attrTypes) {
      target.push(createModifier(attrType, multiplier));
    }
  }
}

function buildBlessingModifiers(
  blessings: Partial<Record<TowerBlessingId, number>>,
) {
  const modifiers: AttributeModifierConfig[] = [];

  appendRepeatedModifiers(
    modifiers,
    [AttributeType.VITALITY],
    1.08,
    blessings.vitality_surge ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    [AttributeType.SPIRIT],
    1.08,
    blessings.spirit_surge ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    [AttributeType.SPEED],
    1.08,
    blessings.swift_step ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    [AttributeType.WISDOM, AttributeType.WILLPOWER],
    1.06,
    blessings.mind_focus ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    [AttributeType.MAX_HP],
    1.1,
    blessings.jade_bones ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    [AttributeType.MAX_MP],
    1.12,
    blessings.sea_of_qi ?? 0,
  );
  appendRepeatedModifiers(
    modifiers,
    PRIMARY_ATTRIBUTES,
    1.05,
    blessings.balanced_dao ?? 0,
  );

  return modifiers;
}

function applyPreBattleRecovery(args: {
  condition: CultivatorCondition;
  maxHp: number;
  maxMp: number;
  blessings: Partial<Record<TowerBlessingId, number>>;
}) {
  const breathingStacks = args.blessings.breathing_technique ?? 0;
  const meridianStacks = args.blessings.meridian_cycle ?? 0;
  const missingHp = Math.max(0, args.maxHp - args.condition.resources.hp.current);
  const missingMp = Math.max(0, args.maxMp - args.condition.resources.mp.current);

  const recoveredHp = Math.floor(missingHp * 0.1 * breathingStacks);
  const recoveredMp = Math.floor(missingMp * 0.15 * meridianStacks);

  return {
    hp: clamp(args.condition.resources.hp.current + recoveredHp, 0, args.maxHp),
    mp: clamp(args.condition.resources.mp.current + recoveredMp, 0, args.maxMp),
  };
}

function buildOpponentModifiers(kind: TowerFloorKind) {
  if (kind === 'normal') {
    return [] as AttributeModifierConfig[];
  }

  const multiplier = kind === 'boss' ? 1.15 : 1.08;
  const hpMultiplier = kind === 'boss' ? 1.3 : 1.18;
  const modifiers: AttributeModifierConfig[] = [createModifier(AttributeType.MAX_HP, hpMultiplier)];

  for (const attrType of PRIMARY_ATTRIBUTES) {
    modifiers.push(createModifier(attrType, multiplier));
  }

  return modifiers;
}

function getWoundSeverity(key: ConditionStatusKey) {
  return WOUND_ORDER.indexOf(key);
}

function replaceWoundStatus(
  statuses: ConditionStatusInstance[],
  target: ConditionStatusKey,
  nowIso: string,
) {
  const currentWound = statuses
    .filter((status) => getWoundSeverity(status.key) >= 0)
    .sort((left, right) => getWoundSeverity(right.key) - getWoundSeverity(left.key))[0];

  const nextKey =
    currentWound && getWoundSeverity(currentWound.key) > getWoundSeverity(target)
      ? currentWound.key
      : target;

  return [
    ...statuses.filter((status) => getWoundSeverity(status.key) < 0),
    {
      key: nextKey,
      stacks: 1,
      source: 'battle' as const,
      duration: { kind: 'until_removed' } as const,
      createdAt: currentWound?.createdAt ?? nowIso,
      updatedAt: nowIso,
    },
  ];
}

export function buildTowerBattleInit(args: {
  cultivator: Cultivator;
  condition: CultivatorCondition;
  blessings: Partial<Record<TowerBlessingId, number>>;
  encounterKind: TowerFloorKind;
}): {
  battleInit: BattleInitConfigV5;
  normalizedCondition: CultivatorCondition;
} {
  const normalizedCondition = ConditionService.normalizeCondition(
    args.cultivator,
    args.condition,
  );
  const { maxHp, maxMp } = ConditionService.getMaxResources(args.cultivator);
  const recovered = applyPreBattleRecovery({
    condition: normalizedCondition,
    maxHp,
    maxMp,
    blessings: args.blessings,
  });

  return {
    normalizedCondition,
    battleInit: {
      player: {
        modifiers: buildBlessingModifiers(args.blessings),
        resourceState: {
          hp: {
            mode: 'absolute',
            value: recovered.hp,
          },
          mp: {
            mode: 'absolute',
            value: recovered.mp,
          },
        },
        statusRefs: normalizedCondition.statuses
          .filter((status) => isConditionStatusActive(status))
          .map((status) => ({
            version: 1 as const,
            templateId: status.key,
            stacks: status.stacks,
          })),
      },
      opponent: {
        modifiers: buildOpponentModifiers(args.encounterKind),
      },
    },
  };
}

export function applyTowerBattleOutcome(args: {
  cultivator: Cultivator;
  condition: CultivatorCondition;
  playerSnapshot: UnitStateSnapshot;
  didLose: boolean;
  now?: Date;
}) {
  const now = args.now ?? new Date();
  const normalizedCondition = ConditionService.normalizeCondition(
    args.cultivator,
    args.condition,
    now,
  );
  const { maxHp, maxMp } = ConditionService.getMaxResources(args.cultivator);

  if (args.didLose) {
    return {
      ...normalizedCondition,
      resources: {
        hp: { current: 1, max: maxHp },
        mp: { current: 0, max: maxMp },
      },
      statuses: replaceWoundStatus(
        normalizedCondition.statuses,
        'near_death',
        now.toISOString(),
      ),
      timestamps: {
        ...normalizedCondition.timestamps,
        lastBattleAt: now.toISOString(),
        lastRecoveryAt: now.toISOString(),
      },
    };
  }

  const currentHp = clamp(args.playerSnapshot.hp.current, 0, maxHp);
  const currentMp = clamp(args.playerSnapshot.mp.current, 0, maxMp);
  const hpRatio = maxHp > 0 ? currentHp / maxHp : 0;
  let statuses = normalizedCondition.statuses;

  if (hpRatio <= 0.15) {
    statuses = replaceWoundStatus(statuses, 'major_wound', now.toISOString());
  } else if (hpRatio <= 0.35) {
    statuses = replaceWoundStatus(statuses, 'minor_wound', now.toISOString());
  }

  return {
    ...normalizedCondition,
    resources: {
      hp: { current: currentHp, max: maxHp },
      mp: { current: currentMp, max: maxMp },
    },
    statuses,
    timestamps: {
      ...normalizedCondition.timestamps,
      lastBattleAt: now.toISOString(),
      lastRecoveryAt: now.toISOString(),
    },
  };
}
