import {
  runArtifactGuardBaselineBattle,
  runBaselineMirrorBattle,
  runCreationBattleDuel,
  runGongfaSustainBaselineBattle,
} from '@/engine/creation-v2/tests/helpers/BattleRegressionHarness';
import { CreationTags } from '@/engine/shared/tag-domain';
import { Material } from '@/types/cultivator';

const SEEDS = [3101, 3102, 3103, 3104, 3105, 3106, 3107, 3108];

const MATERIAL_SETS: Record<
  'skill' | 'artifact' | 'gongfa',
  { low: Material[]; high: Material[] }
> = {
  skill: {
    low: [
      {
        id: 'skill-low-ore',
        name: '赤纹碎铁',
        type: 'ore',
        rank: '灵品',
        quantity: 2,
        element: '火',
        description: '带有微弱锋刃、火意与爆烈余韵',
      },
      {
        id: 'skill-low-manual',
        name: '焰纹手札',
        type: 'skill_manual',
        rank: '凡品',
        quantity: 1,
        description: '略通斩击与火行运转，能够勉强串起技能结构',
      },
    ],
    high: [
      {
        id: 'skill-high-ore',
        name: '焚岳玄锋',
        type: 'ore',
        rank: '地品',
        quantity: 3,
        element: '火',
        description: '兼具锋刃、火意与爆裂的重锋主材',
      },
      {
        id: 'skill-high-monster',
        name: '雷狱兽核',
        type: 'monster',
        rank: '天品',
        quantity: 2,
        description: '雷霆爆发与凶戾剑势相互共鸣',
      },
      {
        id: 'skill-high-manual',
        name: '焚天剑诀残卷',
        type: 'skill_manual',
        rank: '真品',
        quantity: 1,
        description: '强化斩击与术法输出结构',
      },
      {
        id: 'skill-high-special',
        name: '焚界神纹',
        type: 'tcdb',
        rank: '真品',
        quantity: 1,
        description: '神锋、爆炎与术式框架彼此咬合，强化极限斩击',
      },
    ],
  },
  artifact: {
    low: [
      {
        id: 'artifact-low-ore',
        name: '青纹铁片',
        type: 'ore',
        rank: '灵品',
        quantity: 2,
        description: '可用于简易护具，偏守御',
      },
      {
        id: 'artifact-low-monster',
        name: '山甲残核',
        type: 'monster',
        rank: '凡品',
        quantity: 1,
        description: '带有一点抗击打特性',
      },
    ],
    high: [
      {
        id: 'artifact-high-ore-a',
        name: '玄甲重铁',
        type: 'ore',
        rank: '地品',
        quantity: 3,
        description: '护甲、坚壁与守御意象浓烈',
      },
      {
        id: 'artifact-high-ore-b',
        name: '灵纹寒晶',
        type: 'ore',
        rank: '真品',
        quantity: 2,
        description: '利于护盾成形与法力防护',
      },
      {
        id: 'artifact-high-monster',
        name: '山魄甲核',
        type: 'monster',
        rank: '天品',
        quantity: 2,
        description: '守御、反震与耐久并重',
      },
    ],
  },
  gongfa: {
    low: [
      {
        id: 'gongfa-low-manual',
        name: '养气手札',
        type: 'manual',
        rank: '凡品',
        quantity: 1,
        description: '基础吐纳法门，略有修持意象',
      },
      {
        id: 'gongfa-low-herb',
        name: '回灵草',
        type: 'herb',
        rank: '灵品',
        quantity: 2,
        description: '偏向续航与小幅恢复',
      },
    ],
    high: [
      {
        id: 'gongfa-high-manual',
        name: '太玄心法',
        type: 'gongfa_manual',
        rank: '天品',
        quantity: 1,
        description: '强化灵力运转、悟性与法术底盘',
      },
      {
        id: 'gongfa-high-herb',
        name: '回灵仙草',
        type: 'herb',
        rank: '地品',
        quantity: 3,
        description: '恢复、生机与灵力循环兼备',
      },
      {
        id: 'gongfa-high-ore',
        name: '镇海寒铁',
        type: 'ore',
        rank: '真品',
        quantity: 2,
        description: '补足护体、防御与稳固性',
      },
    ],
  },
};

const REQUESTED_SKILL_TAGS = {
  low: [
    CreationTags.MATERIAL.SEMANTIC_BLADE,
    CreationTags.MATERIAL.SEMANTIC_BURST,
  ],
  high: [
    CreationTags.MATERIAL.SEMANTIC_BLADE,
    CreationTags.MATERIAL.SEMANTIC_BURST,
    CreationTags.MATERIAL.SEMANTIC_FLAME,
  ],
} as const;

function summarize(
  productType: 'skill' | 'artifact' | 'gongfa',
  materials: Material[],
  requestedTags?: readonly string[],
) {
  const duels = SEEDS.map((seed) =>
    runCreationBattleDuel({ productType, materials, seed, requestedTags }),
  ).filter((duel): duel is NonNullable<typeof duel> => Boolean(duel));

  return {
    count: duels.length,
    winRate: duels.filter((duel) => duel.challengerWon).length / duels.length,
    avgTurns:
      duels.reduce((sum, duel) => sum + duel.battleResult.turns, 0) /
      duels.length,
    stallRate:
      duels.filter((duel) => duel.reachedMaxTurns).length / duels.length,
  };
}

function summarizeBaseline(
  runner: (seed: number) => ReturnType<typeof runBaselineMirrorBattle>,
) {
  const duels = SEEDS.map((seed) => runner(seed));

  return {
    count: duels.length,
    winRate: duels.filter((duel) => duel.challengerWon).length / duels.length,
    avgTurns:
      duels.reduce((sum, duel) => sum + duel.battleResult.turns, 0) /
      duels.length,
    stallRate:
      duels.filter((duel) => duel.reachedMaxTurns).length / duels.length,
  };
}

describe('creation-v2 battle tier regression', () => {
  it('skill 高投入样本应以更短回合形成优势', () => {
    const low = summarize('skill', MATERIAL_SETS.skill.low, REQUESTED_SKILL_TAGS.low);
    const high = summarize('skill', MATERIAL_SETS.skill.high, REQUESTED_SKILL_TAGS.high);

    expect(low.count).toBe(SEEDS.length);
    expect(high.count).toBe(SEEDS.length);
    expect(high.winRate).toBeGreaterThan(low.winRate);
    expect(high.winRate).toBeGreaterThanOrEqual(0.6);
    expect(high.avgTurns).toBeLessThan(low.avgTurns);
    expect(high.avgTurns).toBeLessThanOrEqual(low.avgTurns + 2);
    expect(high.stallRate).toBeLessThanOrEqual(0.2);
  });

  it('artifact 高投入样本应至少快于镜像基线，且不应更容易陷入拖回合', () => {
    const low = summarize('artifact', MATERIAL_SETS.artifact.low);
    const high = summarize('artifact', MATERIAL_SETS.artifact.high);
    const guardBaseline = summarizeBaseline(runArtifactGuardBaselineBattle);

    expect(low.count).toBe(SEEDS.length);
    expect(high.count).toBe(SEEDS.length);
    expect(guardBaseline.count).toBe(SEEDS.length);
    expect(high.avgTurns).toBeLessThanOrEqual(guardBaseline.avgTurns + 0.5);
    expect(high.stallRate).toBeLessThanOrEqual(
      Math.max(low.stallRate, guardBaseline.stallRate) + 0.1,
    );
    expect(high.avgTurns).toBeLessThanOrEqual(20);
  });

  it('gongfa 高投入样本应至少快于镜像基线，并维持稳定收敛', () => {
    const low = summarize('gongfa', MATERIAL_SETS.gongfa.low);
    const high = summarize('gongfa', MATERIAL_SETS.gongfa.high);
    const sustainBaseline = summarizeBaseline(runGongfaSustainBaselineBattle);

    expect(low.count).toBe(SEEDS.length);
    expect(high.count).toBe(SEEDS.length);
    expect(sustainBaseline.count).toBe(SEEDS.length);
    expect(high.avgTurns).toBeLessThanOrEqual(sustainBaseline.avgTurns + 0.5);
    expect(high.stallRate).toBeLessThanOrEqual(
      Math.max(low.stallRate, sustainBaseline.stallRate) + 0.1,
    );
    expect(high.avgTurns).toBeLessThanOrEqual(18);
  });
});