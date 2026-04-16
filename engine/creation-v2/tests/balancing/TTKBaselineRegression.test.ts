import {
  runArtifactGuardBaselineBattle,
  runBaselineMirrorBattle,
  runCreationBattleDuel,
  runGongfaSustainBaselineBattle,
} from '@/engine/creation-v2/tests/helpers/BattleRegressionHarness';
import { Material } from '@/types/cultivator';

const MATERIAL_SETS: Record<'skill' | 'artifact' | 'gongfa', Material[]> = {
  skill: [
    {
      id: 'ttk-skill-ore',
      name: '裂锋玄铁',
      type: 'ore',
      rank: '地品',
      quantity: 3,
      element: '火',
      description: '锋刃与爆烈并存，适合斩击连攻',
    },
    {
      id: 'ttk-skill-monster',
      name: '狂刃兽核',
      type: 'monster',
      rank: '天品',
      quantity: 2,
      description: '狂烈剑意与爆发妖力相互共鸣',
    },
    {
      id: 'ttk-skill-manual',
      name: '焚天剑诀残卷',
      type: 'skill_manual',
      rank: '天品',
      quantity: 2,
      description: '补足斩击框架与灵力运转，令爆发结构更稳定',
    },
  ],
  artifact: [
    {
      id: 'ttk-art-ore-a',
      name: '玄甲重铁',
      type: 'ore',
      rank: '地品',
      quantity: 3,
      description: '用于护体与铸甲',
    },
    {
      id: 'ttk-art-ore-b',
      name: '灵纹寒晶',
      type: 'ore',
      rank: '真品',
      quantity: 2,
      description: '可塑护盾与防御阵',
    },
    {
      id: 'ttk-art-monster',
      name: '山魄甲核',
      type: 'monster',
      rank: '玄品',
      quantity: 1,
      description: '守御特化之核',
    },
  ],
  gongfa: [
    {
      id: 'ttk-gf-manual',
      name: '太玄心法',
      type: 'gongfa_manual',
      rank: '天品',
      quantity: 1,
      description: '强化修为与续航',
    },
    {
      id: 'ttk-gf-herb',
      name: '回灵仙草',
      type: 'herb',
      rank: '地品',
      quantity: 3,
      description: '恢复与生机并重',
    },
    {
      id: 'ttk-gf-ore',
      name: '镇海寒铁',
      type: 'ore',
      rank: '玄品',
      quantity: 2,
      description: '补足护体与稳固',
    },
  ],
};

const BATTLE_THRESHOLDS: Record<
  'skill' | 'artifact' | 'gongfa',
  {
    minWinRate?: number;
    minAvgTurns: number;
    maxAvgTurns: number;
    maxStallRate: number;
    baselineKind?: 'mirror' | 'artifact_guard' | 'gongfa_sustain';
  }
> = {
  skill: {
    minWinRate: 0.55,
    minAvgTurns: 4,
    maxAvgTurns: 11,
    maxStallRate: 0.15,
    baselineKind: 'mirror',
  },
  artifact: {
    minAvgTurns: 4,
    maxAvgTurns: 12,
    maxStallRate: 0.4,
    baselineKind: 'artifact_guard',
  },
  gongfa: {
    minAvgTurns: 4,
    maxAvgTurns: 12,
    maxStallRate: 0.3,
    baselineKind: 'gongfa_sustain',
  },
};

function resolveBaselineRunner(
  baselineKind: 'mirror' | 'artifact_guard' | 'gongfa_sustain',
) {
  switch (baselineKind) {
    case 'artifact_guard':
      return runArtifactGuardBaselineBattle;
    case 'gongfa_sustain':
      return runGongfaSustainBaselineBattle;
    case 'mirror':
    default:
      return runBaselineMirrorBattle;
  }
}

describe('battle-v5 TTK baseline regression (skill/artifact/gongfa)', () => {
  for (const productType of ['skill', 'artifact', 'gongfa'] as const) {
    it(`${productType} 样本应在真实 battle-v5 对战中维持可接受胜率与收敛回合数`, () => {
      const duels = Array.from({ length: 12 })
        .map((_, index) =>
          runCreationBattleDuel({
            productType,
            materials: MATERIAL_SETS[productType],
            seed: 1000 + index,
          }),
        )
        .filter((item): item is NonNullable<typeof item> => Boolean(item));

      expect(duels.length).toBeGreaterThanOrEqual(10);

      const winRate =
        duels.filter((duel) => duel.challengerWon).length / duels.length;
      const avgTurns =
        duels.reduce((sum, duel) => sum + duel.battleResult.turns, 0) /
        duels.length;
      const stallRate =
        duels.filter((duel) => duel.reachedMaxTurns).length / duels.length;

      const baselineKind = BATTLE_THRESHOLDS[productType].baselineKind;
      const baselineDuels = baselineKind
        ? Array.from({ length: 12 }).map((_, index) =>
            resolveBaselineRunner(baselineKind)(1000 + index),
          )
        : [];
      const baselineAvgTurns =
        baselineDuels.length > 0
          ? baselineDuels.reduce((sum, duel) => sum + duel.battleResult.turns, 0) /
            baselineDuels.length
          : undefined;

      if (typeof BATTLE_THRESHOLDS[productType].minWinRate === 'number') {
        expect(winRate).toBeGreaterThanOrEqual(
          BATTLE_THRESHOLDS[productType].minWinRate,
        );
      }
      expect(avgTurns).toBeGreaterThanOrEqual(
        BATTLE_THRESHOLDS[productType].minAvgTurns,
      );
      expect(avgTurns).toBeLessThanOrEqual(
        BATTLE_THRESHOLDS[productType].maxAvgTurns,
      );
      expect(stallRate).toBeLessThanOrEqual(
        BATTLE_THRESHOLDS[productType].maxStallRate,
      );

      if (typeof baselineAvgTurns === 'number') {
        expect(avgTurns).toBeLessThanOrEqual(baselineAvgTurns + 0.5);
      }
    });
  }
});
