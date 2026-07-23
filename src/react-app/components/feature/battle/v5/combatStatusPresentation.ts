import type { UnitStateSnapshot } from '@shared/engine/battle-v5/systems/state/types';

type ActionState = NonNullable<UnitStateSnapshot['actionStates']>[number];
type CombatResource = UnitStateSnapshot['combatResources'][number];
type BuffState = UnitStateSnapshot['buffs'][number];

const COMBAT_RESOURCE_ICON_FILTERS: Readonly<Record<string, string>> = {
  '✨': 'hue-rotate(220deg)',
  '🔥': 'hue-rotate(180deg)',
};

export type CompactStatusTone = 'default' | 'buff' | 'debuff';

export interface CompactStatusTag {
  key: string;
  label: string;
  title: string;
  tone: CompactStatusTone;
}

export function formatCompactActionState(state: ActionState): string {
  if (state.type === 'ability_mode') {
    return `「${state.name}」（${state.remainingActions}回合）`;
  }
  if (state.type === 'rest') {
    return `[调息·${state.remainingActions}]`;
  }
  return `[蓄势·${state.ability?.name ?? state.name}]`;
}

export function formatActionStateTitle(state: ActionState): string {
  if (state.type === 'ability_mode') {
    return `${state.name}；余${state.remainingActions}门神通。`;
  }
  const source = state.sourceAbility?.name ?? '战斗效果';
  if (state.type === 'rest') {
    return `调息·余${state.remainingActions}次行动；来源：${source}；下一次自身行动跳过。`;
  }
  return `蓄势·${state.ability?.name ?? state.name}；来源：${source}；下一次自身行动发动${state.ability?.name ?? '后发神通'}。`;
}

function formatCompactBuffStatus(buff: BuffState): string {
  const layers = buff.layers > 1 ? `×${buff.layers}` : '';
  const duration =
    buff.durationUnit === 'owner_action'
      ? `${buff.remaining}回合`
      : `${buff.remaining}轮`;
  return `「${buff.name}${layers}」（${duration}）`;
}

function formatBuffStatusTitle(buff: BuffState): string {
  const layers = buff.layers > 1 ? `×${buff.layers}` : '';
  const remaining =
    buff.durationUnit === 'owner_action'
      ? `余${buff.remaining}次自身行动`
      : `余${buff.remaining}轮`;
  const details = [`${buff.name}${layers} · ${remaining}`];
  if (buff.sourceName) details.push(`来源：${buff.sourceName}`);
  if (buff.description) details.push(buff.description);
  return details.join('；');
}

export function isPlayerVisibleBuff(buff: BuffState): boolean {
  if (buff.statusVisibility) return buff.statusVisibility === 'player';
  return buff.logVisibility !== 'debug';
}

function isCompactTemporaryBuff(buff: BuffState): boolean {
  return isPlayerVisibleBuff(buff) && !buff.isPermanent && buff.remaining > 0;
}

function toBuffStatusTag(buff: BuffState): CompactStatusTag {
  return {
    key: `buff:${buff.id}`,
    label: formatCompactBuffStatus(buff),
    title: formatBuffStatusTitle(buff),
    tone: buff.type === 'buff' ? 'buff' : 'debuff',
  };
}

export function getCompactStatusTags(unit: {
  actionStates?: UnitStateSnapshot['actionStates'];
  buffs?: UnitStateSnapshot['buffs'];
}): CompactStatusTag[] {
  const actionTags = (unit.actionStates ?? []).map((state) => ({
    key: `action:${state.type}:${state.ability?.id ?? state.name}`,
    label: formatCompactActionState(state),
    title: formatActionStateTitle(state),
    tone: 'default' as const,
  }));
  const temporaryBuffs = (unit.buffs ?? []).filter(isCompactTemporaryBuff);
  const negativeTags = temporaryBuffs
    .filter((buff) => buff.type === 'debuff' || buff.type === 'control')
    .map(toBuffStatusTag);
  const positiveTags = temporaryBuffs
    .filter((buff) => buff.type === 'buff')
    .map(toBuffStatusTag);

  return [...actionTags, ...negativeTags, ...positiveTags];
}

export function getCombatResourceDisplay(resource: CombatResource): {
  mode: 'pips' | 'bar';
  value: string;
  accessibleLabel: string;
  iconStyle?: { filter: string };
} {
  const accessibleLabel = `${resource.name}${resource.current}/${resource.max}`;
  const icon = resource.icon;
  if (icon) {
    const filter = COMBAT_RESOURCE_ICON_FILTERS[icon];
    return {
      mode: 'pips',
      value: resource.current > 0 ? icon.repeat(resource.current) : '无',
      accessibleLabel,
      ...(filter ? { iconStyle: { filter } } : {}),
    };
  }
  return {
    mode: 'bar',
    value: `${resource.current}/${resource.max}`,
    accessibleLabel,
  };
}
