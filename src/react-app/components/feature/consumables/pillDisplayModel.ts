import { getBreakthroughFocusPillLabel } from '@shared/lib/breakthroughPill';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import {
  getCultivationPillUsageLimit,
  getLongevityPillUsageLimit,
  getPillUsageKeywordLabel,
  getPillUsageRuleText,
  getRealmPillUsageLimit,
} from '@shared/lib/pillUsageText';
import { getResourceLabel, getResourceText } from '@shared/lib/gameConceptDisplay';
import { getTrackConfig } from '@shared/lib/trackConfigRegistry';
import {
  CULTIVATION_BOOST_STATUS_KEY,
  getCultivationBoostDisplayText,
} from '@shared/lib/cultivationBoost';
import type {
  ConditionStatusKey,
  CultivatorCondition,
} from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import type {
  ConditionOperation,
  PillFamily,
  PillQuotaCategory,
  PillSpec,
} from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';

interface PillDisplayOptions {
  realm?: RealmType;
  condition?: CultivatorCondition;
}

export interface PillDetailGroup {
  key: string;
  title: string;
  lines: string[];
}

export interface PillDisplayModel {
  familyLabel: string;
  primaryEffect: string;
  effectSummary: string;
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
  target: Extract<ConditionOperation, { type: 'gain_progress' }>['target'],
): string {
  return target === 'cultivation_exp'
    ? getResourceText('cultivation_exp')
    : getGameConceptLabel('comprehension_insight');
}

function getLifespanGainText(value: number): string {
  return `寿元 +${Math.max(0, Math.floor(value))} 年`;
}

function getBreakthroughPurposeLabel(spec: PillSpec): string | null {
  return getBreakthroughFocusPillLabel(spec);
}

function getPillUsageLimit(
  quotaCategory: PillQuotaCategory,
  realm: RealmType,
): number | null {
  const limit = (() => {
    switch (quotaCategory) {
      case 'long_term':
        return getRealmPillUsageLimit(realm);
      case 'cultivation':
        return getCultivationPillUsageLimit(realm);
      case 'longevity':
        return getLongevityPillUsageLimit(realm);
      case 'none':
        return null;
    }
  })();

  return Number.isFinite(limit) ? limit : null;
}

function getPillUsageCount(
  condition: CultivatorCondition,
  quotaCategory: PillQuotaCategory,
  realm: RealmType,
): number {
  const counters = condition.counters ?? {};
  const longTermCounters = counters.longTermPillUsesByRealm ?? {};
  const cultivationCounters = counters.cultivationPillUsesByRealm ?? {};
  const longevityCounters = counters.longevityPillUsesByRealm ?? {};
  const used =
    quotaCategory === 'long_term'
      ? longTermCounters[realm]
      : quotaCategory === 'cultivation'
        ? cultivationCounters[realm]
        : quotaCategory === 'longevity'
          ? longevityCounters[realm]
          : 0;

  return Number.isFinite(used) ? Math.max(0, Math.floor(used ?? 0)) : 0;
}

function getPillUsageProgressText(
  quotaCategory: PillQuotaCategory,
  options?: PillDisplayOptions,
): { keyword: string; rule: string } | null {
  if (quotaCategory === 'none' || !options?.realm || !options.condition) {
    return null;
  }

  const limit = getPillUsageLimit(quotaCategory, options.realm);
  if (limit === null) {
    return null;
  }

  const used = getPillUsageCount(
    options.condition,
    quotaCategory,
    options.realm,
  );
  const remaining = Math.max(0, limit - used);
  const keyword =
    quotaCategory === 'longevity'
      ? `寿元丹剩余 ${remaining}/${limit}`
      : `剩余 ${remaining}/${limit}`;

  return {
    keyword,
    rule: `本境界已服 ${used}/${limit}，尚可服 ${remaining} 颗`,
  };
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
      return getGameConceptLabel('cultivation_exp');
    case 'insight':
      return getGameConceptLabel('comprehension_insight');
    case 'breakthrough':
      return '破境';
    case 'tempering':
      return '炼体';
    case 'marrow_wash':
      return '洗髓';
    case 'longevity':
      return '延寿';
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
    case 'increase_lifespan':
      return getLifespanGainText(operation.value);
    case 'remove_status':
      return `化解「${getStatusName(operation.status)}」`;
    case 'add_status':
      if (operation.status === CULTIVATION_BOOST_STATUS_KEY) {
        return `${getCultivationBoostDisplayText(operation)}（可用 ${
          operation.usesRemaining ?? 1
        } 次）`;
      }
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
    case 'insight': {
      const gain = spec.operations.find(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'gain_progress' }
        > => operation.type === 'gain_progress',
      );
      return gain
        ? `${getProgressTargetLabel(gain.target)} +${gain.value}`
        : `${getPillFamilyLabel(spec.family)}药效`;
    }
    case 'cultivation': {
      const cultivationBoost = spec.operations.find(
        (
          operation,
        ): operation is Extract<ConditionOperation, { type: 'add_status' }> =>
          operation.type === 'add_status' &&
          operation.status === CULTIVATION_BOOST_STATUS_KEY,
      );
      if (cultivationBoost) {
        return getCultivationBoostDisplayText(cultivationBoost);
      }

      const gain = spec.operations.find(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'gain_progress' }
        > => operation.type === 'gain_progress',
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
    case 'longevity': {
      const lifespan = spec.operations.find(
        (
          operation,
        ): operation is Extract<
          ConditionOperation,
          { type: 'increase_lifespan' }
        > => operation.type === 'increase_lifespan',
      );
      return lifespan ? describePillOperation(lifespan) : '延续寿元';
    }
  }
}

function buildKeywordLabels(
  spec: PillSpec,
  options?: PillDisplayOptions,
): string[] {
  const lifespan = spec.operations.find(
    (
      operation,
    ): operation is Extract<
      ConditionOperation,
      { type: 'increase_lifespan' }
    > => operation.type === 'increase_lifespan',
  );
  const labels = [
    getPillFamilyLabel(spec.family),
    spec.family === 'longevity' && lifespan
      ? getLifespanGainText(lifespan.value)
      : null,
    spec.family === 'breakthrough' ? getBreakthroughPurposeLabel(spec) : null,
    getPillUsageProgressText(spec.consumeRules.quotaCategory, options)
      ?.keyword ??
      getPillUsageKeywordLabel(spec.consumeRules.quotaCategory, options?.realm),
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

function buildEffectSummary(spec: PillSpec): string {
  const coreEffectLines = buildCoreEffectLines(spec);
  return coreEffectLines.length > 0
    ? coreEffectLines.join(' / ')
    : buildPrimaryEffect(spec);
}

function buildCostAndRuleLines(
  spec: PillSpec,
  options?: PillDisplayOptions,
): string[] {
  const lines = spec.operations
    .filter(
      (
        operation,
      ): operation is Extract<ConditionOperation, { type: 'change_gauge' }> =>
        operation.type === 'change_gauge' && operation.delta >= 0,
    )
    .map((operation) => describePillOperation(operation));

  lines.push('仅可在场外服用');
  const usageRuleText =
    getPillUsageProgressText(spec.consumeRules.quotaCategory, options)?.rule ??
    getPillUsageRuleText(spec.consumeRules.quotaCategory, options?.realm);
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
    alchemyMeta.source === 'formula' && Number.isFinite(alchemyMeta.fitScore)
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
  options?: PillDisplayOptions,
): PillDisplayModel {
  return {
    familyLabel: getPillFamilyLabel(consumable.spec.family),
    primaryEffect: buildPrimaryEffect(consumable.spec),
    effectSummary: buildEffectSummary(consumable.spec),
    keywordLabels: buildKeywordLabels(consumable.spec, options),
    detailGroups: [
      {
        key: 'core-effects',
        title: '核心药效',
        lines: buildCoreEffectLines(consumable.spec),
      },
      {
        key: 'cost-and-rules',
        title: '代价与规则',
        lines: buildCostAndRuleLines(consumable.spec, options),
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
