import type { PresentedLogReferenceV3 } from '@shared/engine/battle-v5/v3';
import type { BattlePlaybackRecordV3 } from '@shared/types/battle';

export interface CombatLogDetail {
  id: string;
  kind: PresentedLogReferenceV3['kind'];
  kindLabel: string;
  name: string;
  description: string;
  rows: string[];
}

const KIND_LABELS: Record<CombatLogDetail['kind'], string> = {
  ability: '神通',
  status: '战斗状态',
  mechanic: '战斗机制',
};

function formatAbilityCosts(
  costs: NonNullable<
    BattlePlaybackRecordV3['stateTimeline']['frames'][number]['units'][string]['cooldowns'][number]['costs']
  >,
): string {
  if (costs.length === 0) return '不消耗战斗资源';
  return costs
    .map((cost) => {
      if (cost.mode === 'flat') {
        return `${cost.resource === 'mp' ? '法力' : '气血'} ${cost.amount}`;
      }
      return `当前气血 ${Number((cost.ratio * 100).toFixed(2))}%`;
    })
    .join('；');
}

export function resolveCombatLogDetail(
  record: BattlePlaybackRecordV3,
  reference: PresentedLogReferenceV3,
): CombatLogDetail {
  const units = record.stateTimeline.frames.flatMap((frame) =>
    Object.values(frame.units),
  );

  if (reference.kind === 'ability') {
    const ability = units
      .flatMap((unit) => unit.cooldowns)
      .find((candidate) => candidate.skillId === reference.id);
    const costs = ability?.costs?.length
      ? formatAbilityCosts(ability.costs)
      : ability && ability.mpCost > 0
        ? `法力 ${ability.mpCost}`
        : '不消耗战斗资源';
    return {
      id: reference.id,
      kind: reference.kind,
      kindLabel: KIND_LABELS[reference.kind],
      name: reference.name,
      description:
        ability?.description ??
        reference.description ??
        '该神通在本场战斗中的具体结算，可结合当前日志查看。',
      rows: Array.from(
        new Set([
          `消耗：${costs}`,
          ability && ability.max > 0 ? `冷却：${ability.max}回合` : '冷却：无',
          ...(ability?.detailRows ?? []),
        ]),
      ),
    };
  }

  const matchingStatus = units
    .flatMap((unit) => unit.buffs)
    .find(
      (candidate) =>
        candidate.id === reference.id || candidate.name === reference.name,
    );

  if (reference.kind === 'status') {
    return {
      id: reference.id,
      kind: reference.kind,
      kindLabel: KIND_LABELS[reference.kind],
      name: reference.name,
      description:
        matchingStatus?.description ??
        reference.description ??
        '该状态的层数、持续时间与实际结算结果以当前战斗日志为准。',
      rows: matchingStatus
        ? [
            `类型：${matchingStatus.type === 'buff' ? '增益' : matchingStatus.type === 'debuff' ? '减益' : '控制'}`,
            matchingStatus.isPermanent
              ? '持续：永久'
              : `持续：${matchingStatus.remaining}回合`,
          ]
        : [],
    };
  }

  return {
    id: reference.id,
    kind: reference.kind,
    kindLabel: KIND_LABELS[reference.kind],
    name: reference.name,
    description:
      reference.description ??
      matchingStatus?.description ??
      '该机制本次产生的具体伤害、恢复或状态变化，已列在触发文字下方。',
    rows: matchingStatus?.description
      ? [`关联状态：${matchingStatus.name}`]
      : [],
  };
}
