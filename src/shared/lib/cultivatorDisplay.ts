import type { Cultivator } from '@shared/types/cultivator';
import type { CultivatorCondition } from '@shared/types/condition';
import { projectNaturalRecoveryResources } from './condition';
import {
  projectCultivatorMultiSectV5ToCombatV6,
  projectCultivatorWithTrainingToCombatV6,
  type CharacterPanelV1,
  type ProjectCultivatorMultiSectToCombatV6Input,
} from '@shared/engine/combat-v6/projection';

export type CultivatorDisplayInput = Pick<Cultivator,
  'id' | 'name' | 'attributes' | 'realm' | 'realm_stage' | 'condition'
  | 'cultivations' | 'sect' | 'equipped'> & {
  inventory: Pick<Cultivator['inventory'], 'artifacts'>;
  combatV6ResourceAuthority?: CombatV6ResourceAuthority & { build: CharacterDisplayBuild | null };
};

export type CharacterDisplayBuild = Pick<ProjectCultivatorMultiSectToCombatV6Input,
  'sect' | 'equipment' | 'manuals'>;

export interface CombatV6ResourceAuthority {
  maxHp: number;
  maxMp: number;
  recoveryPaused: boolean;
  attrs: CharacterPanelV1;
}

export interface CultivatorDisplaySnapshot {
  attrs: CharacterPanelV1;
  resources: Record<'hp' | 'mp', { current: number; max: number; percent: number }>;
}

export const CHARACTER_ATTRIBUTE_LABELS = {
  vitality: '体魄', strength: '力道', spirit: '灵力', endurance: '根骨', speed: '身法', willpower: '神识',
} as const;

export const CHARACTER_PANEL_LABELS: Record<keyof CharacterPanelV1, string> = {
  physicalAtk: '物理攻击', physicalDef: '物理防御', magicAtk: '法术攻击', magicDef: '法术防御',
  maxHp: '气血上限', maxMp: '法力上限', speed: '速度', hit: '命中', dodge: '躲避',
  healPower: '治疗强度', sealHit: '封印命中', sealResist: '封印抵抗',
  critRate: '物理暴击率', spellCritRate: '法术暴击率', physicalFuryRate: '物理狂暴率',
};

export function characterDisplayRows(attributes: Cultivator['attributes'], panel: CharacterPanelV1) {
  const rows = (values: Record<string, number>, labels: Record<string, string>) =>
    Object.entries(labels).map(([type, label]) => ({ type, attrType: type, label, baseValue: values[type]!, finalValue: values[type]!, modifier: 0 }));
  return { primaryRows: rows({ ...attributes }, CHARACTER_ATTRIBUTE_LABELS), secondaryAll: rows({ ...panel }, CHARACTER_PANEL_LABELS) };
}

export function formatCharacterAttributeValue(type: string, value: number): string {
  return ['critRate', 'spellCritRate', 'physicalFuryRate'].includes(type) ? `${(value * 100).toFixed(1)}%` : `${value}`;
}

export function formatCharacterAttributeModifier(type: string, value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatCharacterAttributeValue(type, Math.abs(value))}`;
}

/** Same projection as battle entry; no legacy equipment or status modifiers. */
export function projectCharacterDisplay(
  cultivator: Pick<CultivatorDisplayInput, 'id' | 'name' | 'realm' | 'realm_stage' | 'attributes' | 'condition'>,
  build: CharacterDisplayBuild | null,
): CharacterPanelV1 {
  const input = {
    cultivator: { ...cultivator, id: cultivator.id ?? 'character-preview' },
    side: 0 as const, slot: 0, resourcePolicy: 'full' as const,
  };
  const result = build
    ? projectCultivatorMultiSectV5ToCombatV6({ ...input, ...build })
    : projectCultivatorWithTrainingToCombatV6(input);
  if (!result.ok) throw new Error(result.diagnostics.map((item) => item.message).join('；'));
  const panel = {} as CharacterPanelV1;
  for (const key of Object.keys(CHARACTER_PANEL_LABELS) as (keyof CharacterPanelV1)[]) {
    const value = result.unit.attrs[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`V6 属性缺失：${key}`);
    panel[key] = value;
  }
  return panel;
}

/** Changing maxima never heals an existing character, including a previously full one. */
export function normalizeCharacterResource(current: number | undefined, max: number) {
  return { current: current === undefined ? max : Math.min(max, Math.max(0, Math.floor(current))), max };
}

export function characterResourceMaxima(cultivator: CultivatorDisplayInput, condition?: CultivatorCondition) {
  const authority = cultivator.combatV6ResourceAuthority;
  if (authority?.recoveryPaused) return { maxHp: authority.maxHp, maxMp: authority.maxMp };
  const panel = projectCharacterDisplay(
    { ...cultivator, condition: condition ?? cultivator.condition }, authority?.build ?? null,
  );
  return { maxHp: panel.maxHp, maxMp: panel.maxMp };
}

/** Settle elapsed recovery against the old limits before installing a changed panel. */
export function rebaseCharacterResources(
  condition: CultivatorCondition,
  authority: CombatV6ResourceAuthority,
  now: Date,
  recovery: { toxicityPenaltyMultiplier: number; naturalRecoveryMultiplier: number },
): CultivatorCondition {
  const projection = projectNaturalRecoveryResources({
    conditionInput: condition,
    maxHp: condition.resources.hp.max ?? authority.maxHp,
    maxMp: condition.resources.mp.max ?? authority.maxMp,
    now,
    ...recovery,
    naturalRecoveryMultiplier: authority.recoveryPaused ? 0 : recovery.naturalRecoveryMultiplier,
  });
  return {
    ...condition,
    resources: {
      hp: normalizeCharacterResource(projection.resources.hp.current, authority.maxHp),
      mp: normalizeCharacterResource(projection.resources.mp.current, authority.maxMp),
    },
    timestamps: { ...condition.timestamps, lastRecoveryAt: now.toISOString() },
    metrics: {
      ...condition.metrics,
      totalRecoveredHp: (condition.metrics?.totalRecoveredHp ?? 0) + projection.recovery.hp.recovered,
      totalRecoveredMp: (condition.metrics?.totalRecoveredMp ?? 0) + projection.recovery.mp.recovered,
    },
  };
}
