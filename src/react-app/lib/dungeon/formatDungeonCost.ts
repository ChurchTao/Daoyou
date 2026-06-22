import type { DungeonOptionCost } from '@shared/lib/dungeon/types';
import type { MaterialType } from '@shared/types/constants';
import {
  getMaterialTypeLabel,
  getResourceTypeLabel,
} from '@shared/lib/gameConceptDisplay';
import { getResourceDisplayName } from '@shared/lib/gameConceptDisplay';

function formatMaterialCostName(cost: DungeonOptionCost) {
  if (cost.name) {
    return cost.name;
  }

  const typeLabel = cost.required_type
    ? getMaterialTypeLabel(cost.required_type as MaterialType)
    : getResourceTypeLabel('material');
  const qualityLabel = cost.required_quality
    ? `${cost.required_quality}以上`
    : '';

  return `${qualityLabel}${typeLabel}`;
}

export function formatDungeonCostName(cost: DungeonOptionCost) {
  if (cost.type === 'battle') {
    const metadata = cost.metadata;
    return metadata
      ? `遭遇 ${metadata.realm_stage}${metadata.race}${metadata.enemy_name ? `·${metadata.enemy_name}` : ''}`
      : '遭遇战';
  }

  if (cost.type === 'material') {
    return formatMaterialCostName(cost);
  }

  return cost.desc || getResourceDisplayName(cost.type);
}

export function formatDungeonCostValue(cost: DungeonOptionCost) {
  if (cost.type === 'hp_loss' || cost.type === 'mp_loss') {
    return `-${Math.round(cost.value * 100)}%`;
  }

  if (cost.type === 'battle') {
    return `危险 ${cost.value}`;
  }

  return `-${cost.value}`;
}

interface BodyCultivationCostFeedback {
  rawLoss?: unknown;
  actualLoss?: unknown;
  preventedLoss?: unknown;
  eventType?: unknown;
  track?: unknown;
  trackLabel?: unknown;
  triggerText?: unknown;
}

function getBodyCultivationFeedback(
  cost: DungeonOptionCost,
): BodyCultivationCostFeedback | null {
  const metadata = cost.metadata as
    | { bodyCultivation?: BodyCultivationCostFeedback }
    | undefined;
  return metadata?.bodyCultivation ?? null;
}

export function formatDungeonCostBodyCultivationFeedback(
  cost: DungeonOptionCost,
) {
  const feedback = getBodyCultivationFeedback(cost);
  if (!feedback) return null;

  if (typeof feedback.triggerText === 'string' && feedback.triggerText.trim()) {
    return feedback.triggerText;
  }

  const preventedLoss = Number(feedback.preventedLoss);
  if (Number.isFinite(preventedLoss) && preventedLoss > 0) {
    return `肉身炼体生效：已抵消 ${Math.round(preventedLoss)} 点损耗`;
  }

  return null;
}
