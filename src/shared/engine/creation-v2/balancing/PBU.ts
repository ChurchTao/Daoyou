import { QUALITY_ORDER, Quality } from '@shared/types/constants';
import { AffixCategory, RolledAffix } from '../types';

export interface PBUChannels {
  damage: number;
  sustain: number;
  defense: number;
  control: number;
  resource: number;
  utility: number;
  modifier: number;
}

export type TargetTtkBand = '4-10' | '8-20' | '20+';

export interface BalanceMetrics {
  pbu: number;
  targetTtkBand: TargetTtkBand;
  channels: PBUChannels;
}

const CATEGORY_MULTIPLIER: Record<AffixCategory, number> = {
  skill_core: 1.3,
  skill_variant: 1.0,
  skill_rare: 1.5,
  gongfa_foundation: 1.3,
  gongfa_school: 1.15,
  gongfa_secret: 1.4,
  artifact_core: 1.3,
  artifact_panel: 1.3,
  artifact_defense: 1.1,
  artifact_treasure: 1.5,
};

const EFFECT_MULTIPLIER = {
  damage: 1.2,
  sustain: 1.05,
  defense: 1.1,
  control: 1.18,
  resource: 0.95,
  utility: 0.9,
  modifier: 1,
} as const;

const EMPTY_CHANNELS: PBUChannels = {
  damage: 0,
  sustain: 0,
  defense: 0,
  control: 0,
  resource: 0,
  utility: 0,
  modifier: 0,
};

export function estimateBalanceMetrics(
  affixes: RolledAffix[],
  quality: Quality,
): BalanceMetrics {
  const qualityMultiplier = 1 + QUALITY_ORDER[quality] * 0.12;
  let perfectBonus = 0;

  const rawChannels = affixes.reduce<PBUChannels>((channels, affix) => {
    // 引入数值效率系数：效率越高，贡献的战力评估越高
    const efficiencyFactor = 0.8 + 0.4 * (affix.rollEfficiency ?? 1);
    const weightedEnergy = 
      affix.energyCost * 
      CATEGORY_MULTIPLIER[affix.category] * 
      efficiencyFactor;

    if (affix.isPerfect) {
      perfectBonus += 15;
    }

    const channel = inferChannel(affix);
    channels[channel] += weightedEnergy * EFFECT_MULTIPLIER[channel];
    return channels;
  }, { ...EMPTY_CHANNELS });

  const channelSum = Object.values(rawChannels).reduce((sum, value) => sum + value, 0);

  // 最终 PBU = (词缀能效总和 * 品质乘数) + 极品奖励
  const pbu = Math.max(1, Math.round(channelSum * qualityMultiplier + perfectBonus));
  const channels: PBUChannels = {
    damage: Math.round(rawChannels.damage * qualityMultiplier),
    sustain: Math.round(rawChannels.sustain * qualityMultiplier),
    defense: Math.round(rawChannels.defense * qualityMultiplier),
    control: Math.round(rawChannels.control * qualityMultiplier),
    resource: Math.round(rawChannels.resource * qualityMultiplier),
    utility: Math.round(rawChannels.utility * qualityMultiplier),
    modifier: Math.round(rawChannels.modifier * qualityMultiplier),
  };

  return {
    pbu,
    targetTtkBand: classifyTtkBand(pbu),
    channels,
  };
}

function inferChannel(affix: RolledAffix): keyof PBUChannels {
  const id = affix.id.toLowerCase();

  if (
    id.includes('damage') ||
    id.includes('burn') ||
    id.includes('execute') ||
    id.includes('burst')
  ) {
    return 'damage';
  }

  if (id.includes('heal') || id.includes('life') || id.includes('regen')) {
    return 'sustain';
  }

  if (
    id.includes('shield') ||
    id.includes('armor') ||
    id.includes('guard') ||
    id.includes('death-prevent') ||
    id.includes('immunity')
  ) {
    return 'defense';
  }

  if (
    id.includes('stun') ||
    id.includes('freeze') ||
    id.includes('control') ||
    id.includes('seal')
  ) {
    return 'control';
  }

  if (id.includes('mana') || id.includes('drain') || id.includes('siphon')) {
    return 'resource';
  }

  if (
    id.includes('cooldown') ||
    id.includes('trigger') ||
    id.includes('dispel') ||
    id.includes('crit')
  ) {
    return 'utility';
  }

  if (id.includes('core') || id.includes('prefix') || id.includes('suffix')) {
    return 'modifier';
  }

  return 'utility';
}

function classifyTtkBand(pbu: number): TargetTtkBand {
  if (pbu >= 64) return '4-10';
  if (pbu >= 38) return '8-20';
  return '20+';
}
