import { SeededRng } from '@daoyou/combat-core/rng';
import type { RealmType } from '@daoyou/constants/realms';
import { REALM_ORDER } from '@daoyou/constants/realms';
import { REALM_DAILY_EXP_BUDGET } from '@daoyou/game-content/cultivation';
import { EXORCISM_REWARD_PACK } from '@daoyou/game-content/dungeon/exorcism';
import { REALM_YIELD_RATES } from '@daoyou/game-content/economy';
import { DUNGEON_REWARD_PACK } from '@daoyou/game-content/rewards/dungeon';
import type {
  DungeonDifficultyTier,
  DungeonRewardPlan,
  DungeonRewardSource,
} from '@daoyou/game-domain/dungeon';
import type {
  ExorcismEndReason,
  ExorcismGrade,
} from '@daoyou/game-domain/dungeon/exorcism';
import { planDungeonReward } from '../../rewards/dungeon.js';
import { getDungeonRewardBonus } from '../../world/dungeon.js';

type Pack = typeof EXORCISM_REWARD_PACK;
type Step = Pack['search'];

export interface ExorcismRewardContext {
  mapRealm: RealmType;
  playerRealm: RealmType;
  difficultyTier: DungeonDifficultyTier;
}

/** 修为按人物与地图中较低的境界，避免高境界碾压低节点换全额修为。 */
export function exorcismExpRealm(
  playerRealm: RealmType,
  mapRealm: RealmType,
): RealmType {
  return REALM_ORDER[playerRealm] <= REALM_ORDER[mapRealm]
    ? playerRealm
    : mapRealm;
}

function streamRng(seed: number, identity: string) {
  let stream = seed >>> 0;
  for (const character of identity)
    stream = Math.imul(stream ^ character.charCodeAt(0), 16777619) >>> 0;
  return new SeededRng(stream);
}

function planResources(
  seed: number,
  key: string,
  step: Pick<Step, 'dailyExpFraction' | 'stoneHours'>,
  context: ExorcismRewardContext,
  factor = 1,
) {
  const bonus = getDungeonRewardBonus(context.difficultyTier);
  const budget =
    REALM_DAILY_EXP_BUDGET[
      exorcismExpRealm(context.playerRealm, context.mapRealm)
    ];
  const rng = streamRng(seed, `${key}:exorcism.resources:1`);
  return {
    experience: Math.floor(budget * step.dailyExpFraction * bonus * factor),
    spiritStones: Math.floor(
      REALM_YIELD_RATES[context.mapRealm] *
        step.stoneHours *
        (0.8 + rng.next() * 1.2) *
        bonus *
        factor,
    ),
  };
}

/** 物品走云游的掉落底座：只换掉落概率和额外奖励系数，品类权重与灵印池不变。 */
function planItems(
  seed: number,
  key: string,
  source: DungeonRewardSource,
  chance: number,
  level: number,
  pack: Pack,
  dungeonPack = DUNGEON_REWARD_PACK,
): DungeonRewardPlan {
  const base = dungeonPack.sources[source];
  const scaled = {
    ...dungeonPack,
    sources: {
      ...dungeonPack.sources,
      [source]: {
        ...base,
        chance,
        bonusChances: {
          originDew: base.bonusChances.originDew * pack.bonusScale,
          superiorOriginDew:
            base.bonusChances.superiorOriginDew * pack.bonusScale,
          superiorBook: base.bonusChances.superiorBook * pack.bonusScale,
          blueprint: base.bonusChances.blueprint * pack.bonusScale,
        },
      },
    },
  };
  return planDungeonReward(seed, key, source, level, scaled);
}

export function planExorcismWinReward(
  seed: number,
  stage: number,
  level: number,
  context: ExorcismRewardContext,
  pack = EXORCISM_REWARD_PACK,
) {
  const step = pack.wins[stage - 1];
  if (!step) throw new Error('除祟场次无效');
  const key = `exorcism:win:${stage}`;
  return {
    key,
    ...planResources(seed, key, step, context),
    plan: planItems(seed, key, 'battle', step.chance, level, pack),
  };
}

export function planExorcismSearchReward(
  seed: number,
  index: number,
  level: number,
  context: ExorcismRewardContext,
  pack = EXORCISM_REWARD_PACK,
) {
  const key = `exorcism:search:${index}`;
  return {
    key,
    ...planResources(seed, key, pack.search, context),
    plan: planItems(seed, key, 'exploration', pack.search.chance, level, pack),
  };
}

/**
 * 评级结算。败退（战败或逃跑）资源打折，主动收手与通关不打折；物品概率同样打折。
 * 击败克星首领多掷一次额外奖励，由调用方用 countered 判定。
 */
export function planExorcismSettlement(
  seed: number,
  grade: ExorcismGrade,
  endReason: ExorcismEndReason,
  level: number,
  context: ExorcismRewardContext,
  pack = EXORCISM_REWARD_PACK,
) {
  const row = pack.grades[grade];
  const factor = endReason === 'defeated' ? pack.defeatSettlementFactor : 1;
  const key = `exorcism:settlement:${grade}`;
  return {
    key,
    insight: row.insight,
    ...planResources(seed, key, row, context, factor),
    plan: planItems(seed, key, 'completion', row.chance * factor, level, pack),
  };
}

/** 击败克星首领的额外一掷：只取通关额外奖励池，不发基础物品。 */
export function planExorcismNemesisBonus(
  seed: number,
  level: number,
  pack = EXORCISM_REWARD_PACK,
) {
  return planItems(seed, 'exorcism:nemesis', 'completion', 0, level, pack);
}

/** 按评级分布算一局的奖励期望，单位是日预算、灵石小时基数和物品件数。 */
export function exorcismRewardExpectation(
  distribution: Partial<Record<ExorcismGrade | 'none', number>>,
  options: { searchShare?: number; defeatShare?: number } = {},
  pack = EXORCISM_REWARD_PACK,
) {
  const searchShare = options.searchShare ?? 0.45;
  const defeatShare = options.defeatShare ?? 0.8;
  const defeatFactor = 1 - defeatShare * (1 - pack.defeatSettlementFactor);
  const winsOf: Record<ExorcismGrade | 'none', number> = {
    none: 0,
    D: 1,
    C: 2,
    B: 3,
    A: 4,
    S: 4,
  };
  const total = { exp: 0, stones: 0, items: 0 };
  for (const [name, probability] of Object.entries(distribution) as Array<
    [ExorcismGrade | 'none', number]
  >) {
    const wins = winsOf[name];
    const steps = pack.wins.slice(0, wins);
    const searches = Math.min(wins, 3) * searchShare;
    let exp =
      steps.reduce((sum, s) => sum + s.dailyExpFraction, 0) +
      searches * pack.search.dailyExpFraction;
    let stones =
      steps.reduce((sum, s) => sum + s.stoneHours, 0) +
      searches * pack.search.stoneHours;
    let items =
      steps.reduce((sum, s) => sum + s.chance, 0) +
      searches * pack.search.chance;
    if (name !== 'none') {
      const row = pack.grades[name];
      const factor = wins < 4 ? defeatFactor : 1;
      exp += row.dailyExpFraction * factor;
      stones += row.stoneHours * factor;
      items += row.chance * factor;
    }
    total.exp += probability * exp;
    total.stones += probability * stones;
    total.items += probability * items;
  }
  return total;
}
