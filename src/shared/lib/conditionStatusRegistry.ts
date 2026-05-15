import type { BattleUnitInitSpec } from '@shared/engine/battle-v5/setup/types';
import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';

export interface ConditionStatusTemplate {
  key: ConditionStatusKey;
  name: string;
  description: string;
  display: {
    icon: string;
    shortDesc: string;
  };
  hooks: {
    onBattleInit?: (status: ConditionStatusInstance) => BattleUnitInitSpec;
    onNaturalRecovery?: (
      status: ConditionStatusInstance,
      condition: CultivatorCondition,
    ) => number;
  };
}

class Registry {
  private readonly templates = new Map<ConditionStatusKey, ConditionStatusTemplate>();

  register(template: ConditionStatusTemplate): void {
    this.templates.set(template.key, template);
  }

  get(key: ConditionStatusKey): ConditionStatusTemplate | undefined {
    return this.templates.get(key);
  }

  has(key: string): key is ConditionStatusKey {
    return this.templates.has(key as ConditionStatusKey);
  }

  getAll(): ConditionStatusTemplate[] {
    return Array.from(this.templates.values());
  }
}

function clampStacks(stacks: number, fallback = 1): number {
  if (!Number.isFinite(stacks) || stacks <= 0) return fallback;
  return Math.max(1, Math.floor(stacks));
}

function clampRatio(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildWeaknessMultiplier(status: ConditionStatusInstance): number {
  return clampRatio(1 - clampStacks(status.stacks) * 0.05, 0.5, 1);
}

function buildWoundTemplate(
  key: Extract<ConditionStatusKey, 'minor_wound' | 'major_wound' | 'near_death'>,
  name: string,
  description: string,
  icon: string,
  hpRatio: number,
  recoveryMultiplier: number,
  shortDesc: string,
): ConditionStatusTemplate {
  return {
    key,
    name,
    description,
    display: {
      icon,
      shortDesc,
    },
    hooks: {
      onBattleInit: () => ({
        modifiers: [
          {
            attrType: AttributeType.MAX_HP,
            type: ModifierType.MULTIPLY,
            value: hpRatio,
          },
        ],
      }),
      onNaturalRecovery: () => recoveryMultiplier,
    },
  };
}

const registry = new Registry();

registry.register({
  key: 'weakness',
  name: '虚弱',
  description: '元气大伤，全属性随层数下降。',
  display: {
    icon: '😰',
    shortDesc: '元气大伤，全属性降低',
  },
  hooks: {
    onBattleInit: (status) => {
      const value = buildWeaknessMultiplier(status);
      return {
        modifiers: [
          AttributeType.SPIRIT,
          AttributeType.VITALITY,
          AttributeType.SPEED,
          AttributeType.WILLPOWER,
          AttributeType.WISDOM,
        ].map((attrType) => ({
          attrType,
          type: ModifierType.MULTIPLY,
          value,
        })),
      };
    },
  },
});

registry.register(
  buildWoundTemplate(
    'minor_wound',
    '轻伤',
    '气血上限降低 10%，需要疗伤调息。',
    '🩹',
    0.9,
    0.88,
    '气血上限降低10%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'major_wound',
    '重伤',
    '气血上限降低 30%，实力受损明显。',
    '💥',
    0.7,
    0.68,
    '最大气血大幅降低30%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'near_death',
    '濒死',
    '命悬一线，气血上限大幅衰减。',
    '☠️',
    0.4,
    0.42,
    '命悬一线，需要紧急疗伤',
  ),
);

registry.register({
  key: 'breakthrough_focus',
  name: '破境凝神',
  description: '心神收束，为下一次破境做足准备。',
  display: {
    icon: '🕯️',
    shortDesc: '突破前凝神蓄势',
  },
  hooks: {},
});

registry.register({
  key: 'protect_meridians',
  name: '护脉',
  description: '药力护住经脉，减轻破境时的反噬。',
  display: {
    icon: '🪢',
    shortDesc: '护住经脉，降低反噬',
  },
  hooks: {},
});

registry.register({
  key: 'clear_mind',
  name: '清心',
  description: '心境澄明，便于在关键时刻稳住道心。',
  display: {
    icon: '🪷',
    shortDesc: '清心定神，减少杂念',
  },
  hooks: {},
});

export function getConditionStatusTemplate(key: ConditionStatusKey) {
  return registry.get(key);
}

export function getAllConditionStatusTemplates() {
  return registry.getAll();
}

export function isConditionStatusKey(value: string): value is ConditionStatusKey {
  return registry.has(value);
}
