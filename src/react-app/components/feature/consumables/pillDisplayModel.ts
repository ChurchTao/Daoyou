import { getBreakthroughPillLabel } from '@shared/lib/breakthroughPill';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import {
  getPillUsageKeywordLabel,
  getPillUsageRuleText,
} from '@shared/lib/pillUsageText';
import { getResourceLabel, getResourceText } from '@shared/lib/resourceText';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import type { ConditionStatusKey } from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type {
  ConditionOperation,
  PillFamily,
  PillSpec,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

export interface PillDetailGroup {
  key: string;
  title: string;
  lines: string[];
}

export interface PillDisplayModel {
  familyLabel: string;
  primaryEffect: string;
  keywordLabels: string[];
  detailGroups: PillDetailGroup[];
  flavorText?: string;
}

function formatPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

function getStatusName(status: ConditionStatusKey): string {
  return getConditionStatusTemplate(status)?.name ?? status;
}

function getRestoreEffectText(
  operation: Extract<ConditionOperation, { type: 'restore_resource' }>,
): string {
  if (operation.mode === 'percent') {
    return `恢复最大${getResourceLabel(operation.resource)} ${formatPercent(operation.value)}`;
  }

  return `恢复${getResourceLabel(operation.resource)} ${operation.value}`;
}

function getRestoreTargetText(
  operation: Extract<ConditionOperation, { type: 'restore_resource' }>,
): string {
  if (operation.mode === 'percent') {
    return `最大${getResourceLabel(operation.resource)} ${formatPercent(operation.value)}`;
  }

  return `${getResourceLabel(operation.resource)} ${operation.value}`;
}

function getGaugeChangeText(delta: number): string {
  return `丹毒 ${delta > 0 ? '+' : ''}${delta}`;
}

function getProgressTargetLabel(
  target: Extract<
    ConditionOperation,
    { type: 'gain_progress' }
  >['target'],
): string {
  return target === 'cultivation_exp'
    ? getResourceText('cultivation_exp')
    : '道心感悟';
}

function getBreakthroughPurposeLabel(spec: PillSpec): string | null {
  return (
    spec.alchemyMeta.breakthroughLabel ??
    (spec.alchemyMeta.breakthroughTargetRealm
      ? getBreakthroughPillLabel(spec.alchemyMeta.breakthroughTargetRealm)
      : null)
  );
}

export function getPillFamilyLabel(family: PillFamily): string {
  switch (family) {
    case 'healing':
      return '疗伤';
    case 'mana':
      return '回元';
    case 'detox':
      return '解毒';
    case 'cultivation':
      return '修为';
    case 'insight':
      return '感悟';
    case 'breakthrough':
      return '破境';
    case 'tempering':
      return '炼体';
    case 'marrow_wash':
      return '洗髓';
    case 'hybrid':
      return '复合';
  }
}

export function describePillOperation(operation: ConditionOperation): string {
  switch (operation.type) {
    case 'restore_resource':
      return getRestoreEffectText(operation);
    case 'change_gauge':
      return getGaugeChangeText(operation.delta);
    case 'gain_progress':
      return `${getProgressTargetLabel(operation.target)} +${operation.value}`;
    case 'remove_status':
      return `化解「${getStatusName(operation.status)}」`;
    case 'add_status':
      return `获得「${getStatusName(operation.status)}」${
        typeof operation.usesRemaining === 'number'
          ? `（可用 ${operation.usesRemaining} 次）`
          : ''
      }`;
    case 'advance_track':
      return `推进${getTrackConfig(operation.track).name} +${operation.value}`;
  }
}

function buildPrimaryEffect(spec: PillSpec): string {
  switch (spec.family) {
    case 'healing':
    case 'mana': {
      const restore = spec.operations.find(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'restore_resource' }
        > => operation.type === 'restore_resource',
      );
      return restore
        ? getRestoreEffectText(restore)
        : `${getPillFamilyLabel(spec.family)}药效`;
    }
    case 'hybrid': {
      const restores = spec.operations.filter(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'restore_resource' }
        > => operation.type === 'restore_resource',
      );
      if (restores.length === 0) return '复合药效';

      return restores
        .map((operation, index) =>
          index === 0
            ? getRestoreEffectText(operation)
            : getRestoreTargetText(operation),
        )
        .join(' / ');
    }
    case 'detox': {
      const detox = spec.operations.find(
        (
          operation,
        ): operation is Extract<ConditionOperation, { type: 'change_gauge' }> =>
          operation.type === 'change_gauge',
      );
      return detox ? getGaugeChangeText(detox.delta) : '调理丹毒';
    }
    case 'cultivation':
    case 'insight': {
      const gain = spec.operations.find(
        (
          operation,
        ): operation is Extract<ConditionOperation, { type: 'gain_progress' }> =>
          operation.type === 'gain_progress',
      );
      return gain
        ? `${getProgressTargetLabel(gain.target)} +${gain.value}`
        : `${getPillFamilyLabel(spec.family)}药效`;
    }
    case 'breakthrough': {
      const status = spec.operations.find(
        (
          operation,
        ): operation is Extract<ConditionOperation, { type: 'add_status' }> =>
          operation.type === 'add_status',
      );
      const breakthroughLabel = getBreakthroughPurposeLabel(spec);
      if (!status) {
        return breakthroughLabel
          ? `${breakthroughLabel}，助力破境`
          : '助力破境';
      }

      return breakthroughLabel
        ? `${breakthroughLabel}：${describePillOperation(status)}`
        : describePillOperation(status);
    }
    case 'tempering':
    case 'marrow_wash': {
      const advance = spec.operations.find(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'advance_track' }
        > => operation.type === 'advance_track',
      );
      return advance ? describePillOperation(advance) : '推进修炼进度';
    }
  }
}

function buildKeywordLabels(spec: PillSpec, realm?: RealmType): string[] {
  const labels = [
    getPillFamilyLabel(spec.family),
    spec.family === 'breakthrough' ? getBreakthroughPurposeLabel(spec) : null,
    getPillUsageKeywordLabel(spec.consumeRules.quotaCategory, realm),
  ].filter((label): label is string => Boolean(label));

  const gaugeChange = spec.operations.find(
    (
      operation,
    ): operation is Extract<ConditionOperation, { type: 'change_gauge' }> =>
      operation.type === 'change_gauge',
  );
  if (gaugeChange) {
    labels.push(getGaugeChangeText(gaugeChange.delta));
  }

  return labels.slice(0, 3);
}

function buildCoreEffectLines(spec: PillSpec): string[] {
  return spec.operations
    .filter(
      (operation) => operation.type !== 'change_gauge' || operation.delta < 0,
    )
    .map(describePillOperation);
}

function buildCostAndRuleLines(spec: PillSpec, realm?: RealmType): string[] {
  const lines = spec.operations
    .filter(
      (
        operation,
      ): operation is Extract<ConditionOperation, { type: 'change_gauge' }> =>
        operation.type === 'change_gauge' && operation.delta >= 0,
    )
    .map((operation) => describePillOperation(operation));

  lines.push('仅可在场外服用');
  const usageRuleText = getPillUsageRuleText(
    spec.consumeRules.quotaCategory,
    realm,
  );
  if (usageRuleText) {
    lines.push(usageRuleText);
  }

  return lines;
}

function buildAlchemyInfoLines(
  consumable: Consumable & { spec: PillSpec },
): string[] {
  const { alchemyMeta } = consumable.spec;
  const breakthroughLabel = getBreakthroughPurposeLabel(consumable.spec);
  const formulaFitBandText =
    alchemyMeta.source === 'formula'
      ? alchemyMeta.fitBand === 'aligned'
        ? '契合成丹'
        : alchemyMeta.fitBand === 'degraded'
          ? '勉强成丹'
          : undefined
      : undefined;
  const formulaFitScoreText =
    alchemyMeta.source === 'formula' &&
    Number.isFinite(alchemyMeta.fitScore)
      ? `药性拟合：${Math.round(alchemyMeta.fitScore * 100)}%`
      : undefined;
  const formulaFitMultiplierText =
    alchemyMeta.source === 'formula' &&
    Number.isFinite(alchemyMeta.fitMultiplier)
      ? `丹方倍率：${Math.round(alchemyMeta.fitMultiplier * 100)}%`
      : undefined;
  const fitBandText =
    alchemyMeta.source === 'formula' ? formulaFitBandText : undefined;

  return [
    `丹药类别：${getPillFamilyLabel(consumable.spec.family)}`,
    breakthroughLabel ? `破境用途：${breakthroughLabel}` : undefined,
    alchemyMeta.breakthroughTargetRealm
      ? `目标大境界：${alchemyMeta.breakthroughTargetRealm}`
      : undefined,
    `炼制来源：${alchemyMeta.source === 'formula' ? '丹方炼制' : '即兴炼制'}`,
    fitBandText ? `成丹层级：${fitBandText}` : undefined,
    formulaFitScoreText,
    formulaFitMultiplierText,
    `稳度：${alchemyMeta.stability}`,
    alchemyMeta.dominantElement
      ? `主元素：${alchemyMeta.dominantElement}`
      : undefined,
    alchemyMeta.sourceMaterials.length > 0
      ? `炼制材料：${alchemyMeta.sourceMaterials.join('、')}`
      : undefined,
  ].filter((line): line is string => Boolean(line));
}

export function toPillDisplayModel(
  consumable: Consumable & { spec: PillSpec },
  options?: { realm?: RealmType },
): PillDisplayModel {
  return {
    familyLabel: getPillFamilyLabel(consumable.spec.family),
    primaryEffect: buildPrimaryEffect(consumable.spec),
    keywordLabels: buildKeywordLabels(consumable.spec, options?.realm),
    detailGroups: [
      {
        key: 'core-effects',
        title: '核心药效',
        lines: buildCoreEffectLines(consumable.spec),
      },
      {
        key: 'cost-and-rules',
        title: '代价与规则',
        lines: buildCostAndRuleLines(consumable.spec, options?.realm),
      },
      {
        key: 'alchemy-info',
        title: '炼制信息',
        lines: buildAlchemyInfoLines(consumable),
      },
    ],
    flavorText: consumable.description,
  };
}
