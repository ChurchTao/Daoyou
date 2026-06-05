import type { DungeonOptionCost } from '@shared/lib/dungeon/types';
import type { MaterialType } from '@shared/types/constants';
import { getMaterialTypeLabel } from '@shared/types/dictionaries';
import { getResourceDisplayName } from '@shared/lib/utils/statusDisplay';

function formatMaterialCostName(cost: DungeonOptionCost) {
  if (cost.name) {
    return cost.name;
  }

  const typeLabel = cost.required_type
    ? getMaterialTypeLabel(cost.required_type as MaterialType)
    : '材料';
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
