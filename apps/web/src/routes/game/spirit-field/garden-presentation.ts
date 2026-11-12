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
  if (plant.exhausted) return '停止产出';
  return {
    seedling: '幼苗',
    mature: '成株',
    nurtured: '已选培养方向',
    evolved: '已蜕变',
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
  if (kind === 'pests') return { label: '虫害后恢复中', icon: '🐛' };
  if (kind === 'beast') return { label: '偷吃后恢复中', icon: '🐾' };
  return { label: '恢复中', icon: null };
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
        description: `${species.name}的${part}遭遇虫害，需恢复6小时，期间暂停生产，无需照料。收成已满或灵植处于暂存区时，恢复计时暂停。`,
      };
    case 'beast':
      return {
        label: '灵兽偷吃',
        description:
          species.growthForm === 'fungus' || species.growthForm === 'aquatic'
            ? `灵兽偷吸了${species.name}凝结的灵露，需恢复2小时，期间暂停生产，不扣除已有收成，无需照料。收成已满或灵植处于暂存区时，恢复计时暂停。`
            : `灵兽啃食了${species.name}的嫩芽，需恢复2小时，期间暂停生产，不扣除已有收成，无需照料。收成已满或灵植处于暂存区时，恢复计时暂停。`,
      };
    case 'mutation':
      return {
        label: '生长加速',
        description: `${species.name}的${part}出现了新的变化，此后的产出速度提高10%。`,
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
      label: '停止产出',
      description:
        pendingPlantQuantity(plant) > 0
          ? '这株灵植已停止产出。领取剩余收成后，可清理田块并重新栽种。'
          : '这株灵植已停止产出，收成已领完。可清理田块并重新栽种。',
      actionLabel: '查看这株灵植',
    };
  if (plant.canMature)
    return {
      kind: 'mature',
      label: '可培育成株',
      description:
        '幼苗已长足，投入天地灵气即可成株，获得首批收成并开始持续生产。',
      actionLabel: '培育成株',
    };
  if (plant.recoveryRemainingMs > 0)
    return {
      kind: 'recovering',
      label: `${gardenRecoveryPresentation(plant).label}${plant.storageFull ? ' · 恢复计时暂停' : ''}`,
      description: plant.storageFull
        ? `恢复还需约 ${formatGardenDuration(plant.recoveryRemainingMs)}。待领收成已满，恢复计时暂停；领取后继续。`
        : `恢复还需约 ${formatGardenDuration(plant.recoveryRemainingMs)}。期间暂停生产，寿命照常消耗，无需照料。`,
      actionLabel: '查看长势',
    };
  if (plant.canBranch)
    return {
      kind: 'branch',
      label: '可选择培养方向',
      description:
        '已解锁培养方向。消耗天地灵气，可选择药材增产，或改产灵果、天材地宝；具体产物见选择页面。',
      actionLabel: '选择培养方向',
    };
  if (plant.canEvolve)
    return {
      kind: 'evolve',
      label: '可尝试蜕变',
      description:
        '已满足蜕变条件。投入天地灵气、灵石与药材，有机会提升之后产物的品质。',
      actionLabel: '查看蜕变',
    };
  if (plant.storageFull)
    return {
      kind: 'full',
      label: '收成已满',
      description: '待领收成已满，剩余生产时间暂停消耗。收获后会继续生产。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.firstYieldGranted)
    return {
      kind: 'growing',
      label: '幼苗正在扎根',
      description: `幼苗还需生长约 ${formatGardenDuration(plant.matureMs - plant.activeGrowthMs)}，之后可投入天地灵气使其成株。成株前不消耗生产寿命。`,
      actionLabel: '查看长势',
    };
  if (plant.remainingHarvestCycles === 0)
    return {
      kind: 'producing',
      label: '即将停止产出',
      description: '按当前培养方向，剩余寿命不足以完成下一轮生产。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.branch)
    return {
      kind: 'growing',
      label: '等待解锁培养方向',
      description: `还需在田生长约 ${formatGardenDuration(plant.branchRemainingMs)}，之后可投入天地灵气选择培养方向。`,
      actionLabel: '查看培养进程',
    };
  if (
    !plant.evolved &&
    plant.evolveSuccessChance > 0 &&
    plant.evolutionAttemptsRemaining === 0
  )
    return {
      kind: 'producing',
      label: '蜕变次数已用完',
      description: '这株灵植的蜕变次数已用完，仍会按现有方向继续生产。',
      actionLabel: '查看这株灵植',
    };
  if (!plant.evolved && plant.evolveCooldownRemainingMs > 0)
    return {
      kind: 'growing',
      label: '蜕变冷却中',
      description: `冷却还需在田生长约 ${formatGardenDuration(plant.evolveCooldownRemainingMs)}，期间照常生产；收成已满或灵植处于暂存区时暂停计时。`,
      actionLabel: '查看培养进程',
    };
  if (
    !plant.evolved &&
    plant.evolveSuccessChance > 0 &&
    plant.evolveRemainingMs > 0
  )
    return {
      kind: 'growing',
      label: '等待蜕变',
      description: `还需在田生长约 ${formatGardenDuration(plant.evolveRemainingMs)}，达到所需境界后便可尝试蜕变；期间照常生产。`,
      actionLabel: '查看培养进程',
    };
  return {
    kind: 'producing',
    label: plant.evolved ? '蜕变成功' : '持续生产',
    description:
      !plant.evolved && plant.evolveReason
        ? plant.evolveReason
        : plant.mutated
          ? `产出速度提高10%，距下次产出约 ${formatGardenDuration(plant.nextYieldMs)}。`
          : '按当前培养方向持续生产，产出的收成会留在田中。',
    actionLabel: '查看这株灵植',
  };
}
