import type {
  ConditionStatusInstance,
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
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

function buildWoundTemplate(
  key: Extract<ConditionStatusKey, 'minor_wound' | 'major_wound' | 'near_death'>,
  recoveryMultiplier: number,
  shortDesc: string,
): ConditionStatusTemplate {
  const display = getGameConceptInfo(`status_${key}`);

  return {
    key,
    name: display.label,
    description: display.description ?? '',
    effectDetails: [
      `自然恢复速度降低至 ${Math.round(recoveryMultiplier * 100)}%。`,
    ],
    display: {
      icon: display.icon,
      shortDesc,
    },
    hooks: {
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
    '元气大伤，尚待恢复。',
  effectDetails: [
    '保留虚弱状态记录，不改变人物战斗属性。',
  ],
  display: {
    icon: getGameConceptInfo('status_weakness').icon,
    shortDesc: '元气大伤，尚待恢复',
  },
  hooks: {},
});

registry.register(
  buildWoundTemplate(
    'minor_wound',
    0.88,
    '自然恢复速度降低至88%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'major_wound',
    0.68,
    '自然恢复速度降低至68%，需要疗伤',
  ),
);

registry.register(
  buildWoundTemplate(
    'near_death',
    0.42,
    '命悬一线，需要紧急疗伤',
  ),
);

registry.register({
  key: 'breakthrough_focus',
  name: getGameConceptInfo('status_breakthrough_focus').label,
  description: getGameConceptInfo('status_breakthrough_focus').description ?? '',
  effectDetails: ['下一次突破按药力获得额外成功率。'],
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
  effectDetails: ['突破失败时按药力降低修为损失。'],
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
  effectDetails: ['突破失败不会滋生心魔，服用时清除既有心魔。'],
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
