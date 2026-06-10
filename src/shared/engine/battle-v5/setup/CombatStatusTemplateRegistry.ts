import type { CombatStatusTemplate, PersistentCombatStatusV5 } from './types';
import { AttributeType, ModifierType } from '../core/types';
import { getGameConceptInfo } from '@shared/lib/gameConceptDisplay';

class CombatStatusTemplateRegistry {
  private readonly templates = new Map<string, CombatStatusTemplate>();

  register(template: CombatStatusTemplate): void {
    this.templates.set(template.id, template);
  }

  get(id: string): CombatStatusTemplate | undefined {
    return this.templates.get(id);
  }

  getAll(): CombatStatusTemplate[] {
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

function buildWeaknessMultiplier(status: PersistentCombatStatusV5): number {
  const stacks = clampStacks(status.stacks);
  return clampRatio(1 - stacks * 0.05, 0.5, 1);
}

function buildHpMultiplierStatus(
  id: string,
  ratio: number,
  shortDesc: string,
): CombatStatusTemplate {
  const displayInfo = getGameConceptInfo(`status_${id}`);

  return {
    id,
    name: displayInfo.label,
    description: displayInfo.description ?? '',
    display: {
      icon: displayInfo.icon,
      shortDesc,
      showUses: false,
      showExpiry: false,
    },
    toBattleInit() {
      return {
        modifiers: [
          {
            attrType: AttributeType.MAX_HP,
            type: ModifierType.MULTIPLY,
            value: ratio,
          },
        ],
      };
    },
  };
}

export const combatStatusTemplateRegistry = new CombatStatusTemplateRegistry();

combatStatusTemplateRegistry.register({
  id: 'weakness',
  name: getGameConceptInfo('status_weakness').label,
  description:
    getGameConceptInfo('status_weakness').description ??
    '元气大伤，全属性随层数下降。',
  display: {
    icon: getGameConceptInfo('status_weakness').icon,
    shortDesc: '元气大伤，全属性降低',
    showUses: false,
    showExpiry: false,
  },
  toBattleInit(status) {
    const multiplier = buildWeaknessMultiplier(status);
    const primaryAttrs = [
      AttributeType.SPIRIT,
      AttributeType.VITALITY,
      AttributeType.SPEED,
      AttributeType.WILLPOWER,
      AttributeType.WISDOM,
    ];
    return {
      modifiers: primaryAttrs.map((attrType) => ({
        attrType,
        type: ModifierType.MULTIPLY,
        value: multiplier,
      })),
    };
  },
});

combatStatusTemplateRegistry.register(
  buildHpMultiplierStatus(
    'minor_wound',
    0.9,
    '气血上限降低10%，需要疗伤',
  ),
);

combatStatusTemplateRegistry.register(
  buildHpMultiplierStatus(
    'major_wound',
    0.7,
    '最大气血大幅降低30%，需要疗伤',
  ),
);

combatStatusTemplateRegistry.register(
  buildHpMultiplierStatus(
    'near_death',
    0.4,
    '命悬一线，需要紧急疗伤',
  ),
);

combatStatusTemplateRegistry.register({
  id: 'hp_deficit',
  name: getGameConceptInfo('status_hp_deficit').label,
  description: getGameConceptInfo('status_hp_deficit').description ?? '',
  display: {
    icon: getGameConceptInfo('status_hp_deficit').icon,
    shortDesc: '气血未复',
    showUses: false,
    showExpiry: false,
  },
  toBattleInit() {
    return {};
  },
});

combatStatusTemplateRegistry.register({
  id: 'mana_depleted',
  name: getGameConceptInfo('status_mana_depleted').label,
  description: getGameConceptInfo('status_mana_depleted').description ?? '',
  display: {
    icon: getGameConceptInfo('status_mana_depleted').icon,
    shortDesc: '法力未复',
    showUses: false,
    showExpiry: false,
  },
  toBattleInit() {
    return {};
  },
});

export function getCombatStatusTemplate(statusId: string) {
  return combatStatusTemplateRegistry.get(statusId);
}

export function getAllCombatStatusTemplates() {
  return combatStatusTemplateRegistry.getAll();
}

export function getCombatStatusDisplay(statusId: string) {
  return combatStatusTemplateRegistry.get(statusId)?.display;
}

export function isPersistentCombatStatusV5(
  value: unknown,
): value is PersistentCombatStatusV5 {
  if (!value || typeof value !== 'object') return false;
  const status = value as Partial<PersistentCombatStatusV5>;
  return (
    status.version === 1 &&
    typeof status.templateId === 'string' &&
    typeof status.stacks === 'number'
  );
}

export function normalizePersistentCombatStatuses(
  value: unknown,
): PersistentCombatStatusV5[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isPersistentCombatStatusV5)
    .map((status) => ({
      version: 1,
      templateId: status.templateId,
      stacks: clampStacks(status.stacks),
      usesRemaining:
        typeof status.usesRemaining === 'number'
          ? Math.max(0, Math.floor(status.usesRemaining))
          : undefined,
      expiresAt:
        typeof status.expiresAt === 'number' ? status.expiresAt : undefined,
      payload:
        status.payload && typeof status.payload === 'object'
          ? status.payload
          : undefined,
    }));
}
