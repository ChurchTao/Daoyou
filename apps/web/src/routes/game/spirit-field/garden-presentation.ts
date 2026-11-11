import type {
  SpiritGardenIncident,
  SpiritGardenPlantView,
  SpiritGardenSpecies,
} from '@daoyou/game-domain/spirit-field';

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

export function stageLabel(plant: SpiritGardenPlantView): string {
  if (plant.exhausted) return '采尽';
  return {
    seedling: '幼苗',
    mature: '成株',
    nurtured: '蕴灵',
    evolved: '蜕变',
  }[plant.stage];
}

export function pendingPlantQuantity(plant: SpiritGardenPlantView): number {
  return (
    plant.pending.reduce((sum, product) => sum + product.quantity, 0) +
    (plant.pendingSeedSpeciesId ? 1 : 0)
  );
}

export function gardenRecoveryPresentation(plant: SpiritGardenPlantView) {
  const kind = plant.incidents.at(-1)?.kind;
  if (kind === 'pests') return { label: '虫害歇养', icon: '🐛' };
  if (kind === 'beast') return { label: '偷吃歇养', icon: '🐾' };
  return { label: '自行恢复', icon: null };
}

export function gardenSeedName(
  speciesId: string,
  species: SpiritGardenSpecies[],
): string {
  const seedSpecies = species.find((entry) => entry.id === speciesId);
  return seedSpecies ? `${seedSpecies.name}的种子` : '灵种';
}

const incidentPlantParts: Record<SpiritGardenSpecies['growthForm'], string> = {
  herb: '嫩叶',
  flower: '花叶',
  vine: '藤梢',
  shrub: '枝叶',
  tree: '枝梢',
  fungus: '菌体',
  aquatic: '水叶',
  root: '根须',
};

export function gardenIncidentPresentation(
  incident: SpiritGardenIncident,
  species: SpiritGardenSpecies,
) {
  const part = incidentPlantParts[species.growthForm];
  switch (incident.kind) {
    case 'pests':
      return {
        label: '虫害',
        description: `${species.name}的${part}受了虫扰，歇养六小时后自行恢复。`,
      };
    case 'beast':
      return {
        label: '灵兽偷吃',
        description:
          species.growthForm === 'fungus' || species.growthForm === 'aquatic'
            ? `灵兽偷吸了${species.name}凝结的灵露，歇养两小时后自行恢复。`
            : `灵兽啃食了${species.name}的嫩芽，歇养两小时后自行恢复。`,
      };
    case 'mutation':
      return {
        label: '异化速生',
        description: `${species.name}的${part}间凝起新灵机，此后的生产速度提高一成。`,
      };
  }
}

export interface PlantOpportunity {
  kind:
    | 'mature'
    | 'branch'
    | 'evolve'
    | 'full'
    | 'growing'
    | 'producing'
    | 'exhausted'
    | 'recovering';
  label: string;
  description: string;
  actionLabel: string;
}

/** Read server-owned opportunities; this layer only chooses the current presentation. */
export function getPlantOpportunity(
  plant: SpiritGardenPlantView,
): PlantOpportunity {
  if (plant.exhausted)
    return {
      kind: 'exhausted',
      label: '采尽',
      description:
        pendingPlantQuantity(plant) > 0
          ? '领取最后一批收成后，就能清畦重种。'
          : '这株灵植的收成已领完，可以清畦重种。',
      actionLabel: '查看这株灵植',
    };
  if (plant.canMature)
    return {
      kind: 'mature',
      label: '可引灵成株',
      description:
        '幼苗根基已足。引入自身天地灵气，便能助其成株，迎来首次收成。',
      actionLabel: '助其成株',
    };
  if (plant.recoveryRemainingMs > 0)
    return {
      kind: 'recovering',
      label: `${gardenRecoveryPresentation(plant).label}${plant.storageFull ? ' · 暂缓' : ''}`,
      description: plant.storageFull
        ? `还需歇养约 ${formatGardenDuration(plant.recoveryRemainingMs)}。积蓄已满，歇养暂缓；领取收成后继续恢复。`
        : `还需歇养约 ${formatGardenDuration(plant.recoveryRemainingMs)}。期间暂停生产，寿命照常消耗，无需照料。`,
      actionLabel: '查看长势',
    };
  if (plant.canBranch)
    return {
      kind: 'branch',
      label: '可蕴灵定向',
      description: '灵蕴已足。引入自身天地灵气，确定今后的收成方向。',
      actionLabel: '确定培养方向',
    };
  if (plant.canEvolve)
    return {
      kind: 'evolve',
      label: '可尝试蜕变',
      description:
        '这株灵植已经养足根基，可以投入灵气与药材，尝试提升往后产物的品质。',
      actionLabel: '前去蜕变',
    };
  if (plant.storageFull)
    return {
      kind: 'full',
      label: '积蓄已满',
      description: '待领收成已经积满，剩余生产时间暂停消耗。收获后会继续生产。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.firstYieldGranted)
    return {
      kind: 'growing',
      label: '幼苗正在扎根',
      description: `再在田长养约 ${formatGardenDuration(plant.matureMs - plant.activeGrowthMs)}，便可引灵成株。等待期间寿命尚未开始。`,
      actionLabel: '查看长势',
    };
  if (plant.remainingHarvestCycles === 0)
    return {
      kind: 'producing',
      label: '临近采尽',
      description: '按当前路线，剩余生产时间不足一轮。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.branch)
    return {
      kind: 'growing',
      label: '静待灵蕴充盈',
      description: `再在田长养约 ${formatGardenDuration(plant.branchRemainingMs)}，便能引灵蕴养，决定往后的培养方向。`,
      actionLabel: '查看培养进程',
    };
  if (!plant.evolved && plant.evolutionAttemptsRemaining === 0)
    return {
      kind: 'producing',
      label: '蜕变次数已尽',
      description: '这株灵植已用尽蜕变机会，仍会按现有方向继续生产。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.evolved && plant.evolveCooldownRemainingMs > 0)
    return {
      kind: 'growing',
      label: '蜕变余韵未散',
      description: `再有效在田长养约 ${formatGardenDuration(plant.evolveCooldownRemainingMs)}，便可再次尝试，期间照常生产。`,
      actionLabel: '查看培养进程',
    };
  if (!plant.evolved && plant.evolveRemainingMs > 0)
    return {
      kind: 'growing',
      label: '根基日渐深厚',
      description: `再在田长养约 ${formatGardenDuration(plant.evolveRemainingMs)}，便养足蜕变根基，期间照常产出。`,
      actionLabel: '查看培养进程',
    };
  return {
    kind: 'producing',
    label: plant.evolved ? '蜕变已成' : '静养待时',
    description:
      !plant.evolved && plant.evolveReason
        ? plant.evolveReason
        : plant.mutated
          ? `已生出速生灵性，距下次产出约 ${formatGardenDuration(plant.nextYieldMs)}。`
          : `每 ${formatGardenDuration(plant.output.cycleMs)} 产出 ${plant.output.quantity} 份${plant.output.name}。`,
    actionLabel: '查看这株灵植',
  };
}
