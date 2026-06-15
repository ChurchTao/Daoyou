import type { BattleUnitInitSpec } from '@shared/engine/battle-v5/setup/types';
import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
import type {
  AttributeType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { getGameConceptInfo } from './gameConceptDisplay';

export interface ConditionStatusTemplate {
  key: ConditionStatusKey;
  name: string;
  description: string;
  effectDetails?: string[];
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

const ATTR = {
  MAX_HP: 'maxHp' as AttributeType,
  SPIRIT: 'spirit' as AttributeType,
  VITALITY: 'vitality' as AttributeType,
  SPEED: 'speed' as AttributeType,
  WILLPOWER: 'willpower' as AttributeType,
  WISDOM: 'wisdom' as AttributeType,
};

const MOD = {
  MULTIPLY: 'multiply' as ModifierType,
};

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
  hpRatio: number,
  recoveryMultiplier: number,
  shortDesc: string,
): ConditionStatusTemplate {
  const display = getGameConceptInfo(`status_${key}`);

  return {
    key,
    name: display.label,
    description: display.description ?? '',
    effectDetails: [
      `战斗时最大气血降低 ${Math.round((1 - hpRatio) * 100)}%。`,
      `自然恢复速度降低至 ${Math.round(recoveryMultiplier * 100)}%。`,
    ],
    display: {
      icon: display.icon,
      shortDesc,
    },
    hooks: {
      onBattleInit: () => ({
        modifiers: [
          {
            attrType: ATTR.MAX_HP,
            type: MOD.MULTIPLY,
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
  name: getGameConceptInfo('status_weakness').label,
  description:
    getGameConceptInfo('status_weakness').description ??
    '元气大伤，全属性随层数下降。',
  effectDetails: [
    '战斗时体魄、灵力、悟性、身法、神识都会同步下降。',
    '每层额外降低 5%，最多衰减至原本的 50%。',
  ],
  display: {
    icon: getGameConceptInfo('status_weakness').icon,
    shortDesc: '元气大伤，全属性降低',
  },
  hooks: {
    onBattleInit: (status) => {
      const value = buildWeaknessMultiplier(status);
      return {
        modifiers: [
          ATTR.SPIRIT,
          ATTR.VITALITY,
          ATTR.SPEED,
          ATTR.WILLPOWER,
          ATTR.WISDOM,
        ].map((attrType) => ({
          attrType,
          type: MOD.MULTIPLY,
          value,
        })),
      };
    },
  },
});

registry.register(
  buildWoundTemplate(
    'minor_wound',
    0.9,
    0.88,
    '气血上限降低10%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'major_wound',
    0.7,
    0.68,
    '最大气血大幅降低30%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'near_death',
    0.4,
    0.42,
    '命悬一线，需要紧急疗伤',
  ),
);

registry.register({
  key: 'breakthrough_focus',
  name: getGameConceptInfo('status_breakthrough_focus').label,
  description: getGameConceptInfo('status_breakthrough_focus').description ?? '',
  display: {
    icon: getGameConceptInfo('status_breakthrough_focus').icon,
    shortDesc: '突破前凝神蓄势',
  },
  hooks: {},
});

registry.register({
  key: 'protect_meridians',
  name: getGameConceptInfo('status_protect_meridians').label,
  description: getGameConceptInfo('status_protect_meridians').description ?? '',
  display: {
    icon: getGameConceptInfo('status_protect_meridians').icon,
    shortDesc: '护住经脉，降低反噬',
  },
  hooks: {},
});

registry.register({
  key: 'clear_mind',
  name: getGameConceptInfo('status_clear_mind').label,
  description: getGameConceptInfo('status_clear_mind').description ?? '',
  display: {
    icon: getGameConceptInfo('status_clear_mind').icon,
    shortDesc: '清心定神，减少杂念',
  },
  hooks: {},
});

registry.register({
  key: 'cultivation_boost',
  name: getGameConceptInfo('status_cultivation_boost').label,
  description: getGameConceptInfo('status_cultivation_boost').description ?? '',
  effectDetails: ['下一次闭关修炼获得的修为按药力百分比提升。'],
  display: {
    icon: getGameConceptInfo('status_cultivation_boost').icon,
    shortDesc: '下一次闭关修为提升',
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
