import type { SpiritGardenPlantView } from '@daoyou/game-domain/spirit-field';

export function formatGardenDuration(ms: number): string {
  if (ms <= 0) return '即将完成';
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (hours < 24)
    return restMinutes && hours < 6
      ? `${hours} 小时 ${restMinutes} 分钟`
      : `${Math.ceil(minutes / 60)} 小时`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days} 天 ${restHours} 小时` : `${days} 天`;
}

export function stageLabel(stage: SpiritGardenPlantView['stage']): string {
  return {
    seedling: '幼苗',
    mature: '成株',
    nurtured: '蕴灵',
    evolved: '蜕变',
  }[stage];
}

export function pendingPlantQuantity(plant: SpiritGardenPlantView): number {
  return plant.pending.reduce((sum, product) => sum + product.quantity, 0);
}

export interface PlantOpportunity {
  kind: 'branch' | 'evolve' | 'full' | 'growing' | 'producing';
  label: string;
  description: string;
  actionLabel: string;
}

/** Read server-owned opportunities; this layer only chooses the current presentation. */
export function getPlantOpportunity(
  plant: SpiritGardenPlantView,
): PlantOpportunity {
  if (plant.canBranch)
    return {
      kind: 'branch',
      label: '可定培养方向',
      description: '灵蕴已足。可以确定长期培养方向，今后的收成会随之改变。',
      actionLabel: '确定培养方向',
    };
  if (plant.canEvolve)
    return {
      kind: 'evolve',
      label: '可完成蜕变',
      description: '这株灵植已经养足根基，备好药材后即可提升往后产物的品质。',
      actionLabel: '前去蜕变',
    };
  if (plant.storageFull)
    return {
      kind: 'full',
      label: '积蓄已满',
      description: '田中收成已经积满，收获后会继续生产，灵植长势不受影响。',
      actionLabel: '查看这株灵植',
    };
  if (plant.stage === 'seedling')
    return {
      kind: 'growing',
      label: '幼苗正在扎根',
      description: `距首次成株约 ${formatGardenDuration(plant.matureMs - plant.activeGrowthMs)}，此后会持续产出。`,
      actionLabel: '查看长势',
    };
  if (!plant.branch)
    return {
      kind: 'growing',
      label: '静待灵蕴充盈',
      description: `再长养约 ${formatGardenDuration(plant.branchMs - plant.activeGrowthMs)}，便能决定它往后的培养方向。`,
      actionLabel: '查看培养进程',
    };
  if (!plant.evolved && plant.activeGrowthMs < plant.evolveMs)
    return {
      kind: 'growing',
      label: '根基日渐深厚',
      description: `距蜕变积累约 ${formatGardenDuration(plant.evolveMs - plant.activeGrowthMs)}，期间照常产出。`,
      actionLabel: '查看培养进程',
    };
  return {
    kind: 'producing',
    label: plant.evolved ? '长养不辍' : '静养待时',
    description:
      !plant.evolved && plant.evolveReason
        ? plant.evolveReason
        : `每 ${formatGardenDuration(plant.output.cycleMs)} 产出 ${plant.output.quantity} 份${plant.output.name}，采收后继续生长。`,
    actionLabel: '查看这株灵植',
  };
}
