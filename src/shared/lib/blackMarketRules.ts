import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import type {
  BlackMarketNpcId,
  BlackMarketRevealRating,
} from '@shared/types/blackMarket';
import type { MaterialType, Quality } from '@shared/types/constants';

export const BLACK_MARKET_REFRESH_MS = 2 * 60 * 60 * 1000;
export const BLACK_MARKET_MAX_INSPECTIONS = 3;

type BlackMarketDisposition =
  'unyielding' | 'shrewd' | 'flexible' | 'desperate';

export type BlackMarketNegotiationStrategy =
  'reason' | 'relationship' | 'pressure' | 'bluff' | 'direct_offer' | 'unknown';

export interface BlackMarketPricingState {
  anchorValue: number;
  initialPrice: number;
  currentPrice: number;
  floorPrice: number;
  patience: number;
}

export interface BlackMarketHaggleDecision {
  outcome: 'accepted' | 'countered' | 'conceded' | 'rejected' | 'locked';
  nextPrice: number;
  nextPatience: number;
}

const NPC_STRATEGY_SCORE: Record<
  BlackMarketNpcId,
  Partial<Record<BlackMarketNegotiationStrategy, number>>
> = {
  'smiling-keeper': {
    relationship: 0.08,
    bluff: 0.04,
    pressure: -0.1,
  },
  'silent-elder': {
    reason: 0.1,
    bluff: -0.05,
    pressure: -0.12,
  },
  'urgent-cultivator': {
    direct_offer: 0.08,
    pressure: 0.04,
    relationship: -0.03,
  },
};

const DISPOSITION_STRATEGY_SCORE: Record<
  BlackMarketDisposition,
  Partial<Record<BlackMarketNegotiationStrategy, number>>
> = {
  unyielding: {
    reason: 0.16,
    pressure: -0.18,
    bluff: -0.08,
    direct_offer: -0.06,
  },
  shrewd: { relationship: 0.1, bluff: 0.12, reason: 0.04, pressure: -0.06 },
  flexible: {
    relationship: 0.08,
    direct_offer: 0.1,
    reason: 0.06,
    pressure: 0.03,
  },
  desperate: {
    direct_offer: 0.18,
    pressure: 0.12,
    relationship: -0.02,
    bluff: -0.05,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Stable, platform-independent unit interval value. The server must feed this
 * with a secret-derived seed; the value itself is deliberately pure for tests.
 */
export function blackMarketUnit(seed: string, label: string): number {
  let hash = 2166136261;
  const input = `${seed}:${label}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function selectDisposition(
  seed: string,
  npcId: BlackMarketNpcId,
): BlackMarketDisposition {
  const roll = blackMarketUnit(seed, 'disposition');
  const thresholds: Record<BlackMarketNpcId, [number, number, number]> = {
    'smiling-keeper': [0.18, 0.55, 0.9],
    'silent-elder': [0.42, 0.78, 0.95],
    'urgent-cultivator': [0.07, 0.25, 0.6],
  };
  const [unyielding, shrewd, flexible] = thresholds[npcId];
  return roll < unyielding
    ? 'unyielding'
    : roll < shrewd
      ? 'shrewd'
      : roll < flexible
        ? 'flexible'
        : 'desperate';
}

function dispositionFloorMultiplier(
  disposition: BlackMarketDisposition,
  unit: number,
): number {
  switch (disposition) {
    case 'unyielding':
      return 1;
    case 'shrewd':
      return 0.84 + unit * 0.16;
    case 'flexible':
      return 0.64 + unit * 0.26;
    case 'desperate':
      return 0.5 + unit * 0.25;
  }
}

function dispositionPatience(
  disposition: BlackMarketDisposition,
  unit: number,
): number {
  switch (disposition) {
    case 'unyielding':
      return 4;
    case 'shrewd':
      return 3 + Math.floor(unit * 2);
    case 'flexible':
      return 2 + Math.floor(unit * 3);
    case 'desperate':
      return 2 + Math.floor(unit * 2);
  }
}

function strategyScore(input: {
  seed: string;
  npcId: BlackMarketNpcId;
  strategy: BlackMarketNegotiationStrategy;
}): number {
  const disposition = selectDisposition(input.seed, input.npcId);
  const baseline = NPC_STRATEGY_SCORE[input.npcId][input.strategy] ?? 0;
  const hidden = DISPOSITION_STRATEGY_SCORE[disposition][input.strategy] ?? 0;
  const jitter =
    (blackMarketUnit(input.seed, `strategy:${input.strategy}`) - 0.5) * 0.16;
  return baseline + hidden + jitter;
}

export function computeBlackMarketAnchorValue(input: {
  quality: Quality;
  materialType: MaterialType;
  regionFactor: number;
}): number {
  return Math.max(
    1,
    Math.round(
      BASE_PRICES[input.quality] *
        (TYPE_MULTIPLIERS[input.materialType] ?? 1) *
        clamp(input.regionFactor, 0.5, 2),
    ),
  );
}

export function createBlackMarketPricing(input: {
  seed: string;
  npcId: BlackMarketNpcId;
  anchorValue: number;
}): BlackMarketPricingState {
  const disposition = selectDisposition(input.seed, input.npcId);
  const initialBias =
    disposition === 'unyielding'
      ? 0.06
      : disposition === 'shrewd'
        ? 0.04
        : disposition === 'desperate'
          ? -0.05
          : 0;
  const initialMultiplier = clamp(
    1.2 + blackMarketUnit(input.seed, 'initial-price') * 0.8 + initialBias,
    1.2,
    2,
  );
  const floorMultiplier = dispositionFloorMultiplier(
    disposition,
    blackMarketUnit(input.seed, 'floor-price'),
  );
  const initialPrice = Math.max(
    1,
    Math.round(input.anchorValue * initialMultiplier),
  );

  return {
    anchorValue: input.anchorValue,
    initialPrice,
    currentPrice: initialPrice,
    floorPrice: Math.max(1, Math.round(input.anchorValue * floorMultiplier)),
    patience: dispositionPatience(
      disposition,
      blackMarketUnit(input.seed, 'patience'),
    ),
  };
}

export function evaluateBlackMarketHaggle(input: {
  seed: string;
  npcId: BlackMarketNpcId;
  currentPrice: number;
  floorPrice: number;
  offeredPrice: number;
  patience: number;
  strategy: BlackMarketNegotiationStrategy;
  argumentQuality: 0 | 1 | 2;
  validEvidenceCount: number;
  randomRoll: number;
}): BlackMarketHaggleDecision {
  const currentPrice = Math.max(1, Math.round(input.currentPrice));
  const floorPrice = clamp(Math.round(input.floorPrice), 1, currentPrice);
  const offeredPrice = clamp(Math.round(input.offeredPrice), 1, currentPrice);
  const offerProgress =
    currentPrice === floorPrice
      ? 1
      : clamp((offeredPrice - floorPrice) / (currentPrice - floorPrice), -1, 1);
  const hiddenStrategyScore = strategyScore({
    seed: input.seed,
    npcId: input.npcId,
    strategy: input.strategy,
  });
  const persuasion =
    input.argumentQuality * 0.14 +
    Math.min(2, input.validEvidenceCount) * 0.1 +
    hiddenStrategyScore +
    (clamp(input.randomRoll, 0, 1) - 0.5) * 0.34;
  const acceptThreshold = 0.52 - persuasion;

  if (offeredPrice >= floorPrice && offerProgress >= acceptThreshold) {
    return {
      outcome: 'accepted',
      nextPrice: offeredPrice,
      nextPatience: input.patience,
    };
  }

  const nextPatience = Math.max(
    0,
    input.patience - (offeredPrice < floorPrice * 0.72 ? 2 : 1),
  );
  if (nextPatience === 0) {
    return {
      outcome: 'locked',
      nextPrice: currentPrice,
      nextPatience,
    };
  }

  const concessionStrength = clamp(
    0.16 + persuasion * 0.32 + clamp(input.randomRoll, 0, 1) * 0.12,
    0.05,
    0.48,
  );
  const counterTarget = Math.max(
    floorPrice,
    Math.round(
      currentPrice - (currentPrice - offeredPrice) * concessionStrength,
    ),
  );

  if (counterTarget < currentPrice) {
    return {
      outcome: nextPatience <= 1 ? 'countered' : 'conceded',
      nextPrice: counterTarget,
      nextPatience,
    };
  }

  return {
    outcome: 'rejected',
    nextPrice: currentPrice,
    nextPatience,
  };
}

export function classifyBlackMarketReveal(
  paidPrice: number,
  anchorValue: number,
): { valueRatio: number; rating: BlackMarketRevealRating } {
  const valueRatio = anchorValue / Math.max(1, paidPrice);
  const paidToValue = paidPrice / Math.max(1, anchorValue);
  const rating: BlackMarketRevealRating =
    paidToValue >= 1.55
      ? '血亏'
      : paidToValue >= 1.12
        ? '小亏'
        : paidToValue >= 0.9
          ? '公允'
          : paidToValue >= 0.74
            ? '小赚'
            : paidToValue >= 0.58
              ? '捡漏'
              : '天降横财';
  return { valueRatio, rating };
}
