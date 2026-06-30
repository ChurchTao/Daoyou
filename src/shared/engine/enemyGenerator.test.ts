import { describe, expect, it, vi } from 'vitest';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { createCombatUnitFromCultivator } from '@shared/engine/battle-v5/adapters/CultivatorCombatAdapter';
import { getCultivatorDisplayAttributes } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { BASIC_SKILLS, BASIC_TECHNIQUES } from '@shared/engine/cultivator/creation/config';
import { CreationSession } from '@shared/engine/creation-v2/CreationSession';
import { CreationPhase } from '@shared/engine/creation-v2/core/types';
import type { SkillProductModel } from '@shared/engine/creation-v2/models/types';
import {
  deserializeAndRehydrate,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { getRealmStageAttributeBudget } from '@shared/config/realmProgression';
import { ENEMY_RACE_VALUES, type EnemyRace } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import {
  enemyGenerator,
  EnemyCraftExecutor,
  EnemyGenerator,
  EnemyLoadoutPlanner,
  NoopEnemyCopyProvider,
} from './enemyGenerator';
import {
  getEnemyCombatPolicy,
  validateEnemySkillRoles,
} from './enemy-generation/EnemyCombatPolicy';

function sumAttributes(attributes: Cultivator['attributes']): number {
  return Object.values(attributes).reduce((sum, value) => sum + value, 0);
}

function createPlayerFixture(): Cultivator {
  return {
    id: 'player-fixture',
    name: '韩立',
    title: null,
    gender: '男',
    realm: '筑基',
    realm_stage: '中期',
    age: 40,
    lifespan: 260,
    attributes: {
      vitality: 52,
      spirit: 58,
      wisdom: 50,
      speed: 48,
      willpower: 44,
    },
    spiritual_roots: [{ element: '木', strength: 82 }],
    pre_heaven_fates: [],
    cultivations: [BASIC_TECHNIQUES.木()],
    skills: [...BASIC_SKILLS.木],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    spirit_stones: 0,
    background: '测试用玩家角色',
  };
}

function snapshotEnemy(draft: ReturnType<typeof enemyGenerator.buildDraft>): string {
  return JSON.stringify({
    balance: draft.balance,
    cultivator: {
      id: draft.cultivator.id,
      name: draft.cultivator.name,
      title: draft.cultivator.title,
      background: draft.cultivator.background,
      description: draft.cultivator.description,
      attributes: draft.cultivator.attributes,
      condition: draft.cultivator.condition,
      spiritual_roots: draft.cultivator.spiritual_roots,
      equipped: draft.cultivator.equipped,
      cultivations: draft.cultivator.cultivations.map((technique) => ({
        id: technique.id,
        name: technique.name,
        description: technique.description,
        quality: technique.quality,
        slug: technique.abilityConfig?.slug,
        tags: technique.abilityConfig?.tags,
      })),
      skills: draft.cultivator.skills.map((skill) => ({
        id: skill.id,
        name: skill.name,
        description: skill.description,
        quality: skill.quality,
        cost: skill.cost,
        cooldown: skill.cooldown,
        target_self: skill.target_self,
        slug: skill.abilityConfig?.slug,
        tags: skill.abilityConfig?.tags,
      })),
      artifacts: draft.cultivator.inventory.artifacts.map((artifact) => ({
        id: artifact.id,
        name: artifact.name,
        description: artifact.description,
        quality: artifact.quality,
        slot: artifact.slot,
        slug: artifact.abilityConfig?.slug,
        tags: artifact.abilityConfig?.tags,
        battleRuntimeMeta: artifact.battleRuntimeMeta,
      })),
    },
    copyFacts: draft.copyFacts,
  });
}

function assertV5Compatible(draft: ReturnType<typeof enemyGenerator.buildDraft>) {
  for (const technique of draft.cultivator.cultivations) {
    expect(technique.abilityConfig).toBeDefined();
    expect(() => AbilityFactory.create(technique.abilityConfig!)).not.toThrow();
    expectProductModelAffixes(technique.productModel, 'gongfa');
  }

  for (const skill of draft.cultivator.skills) {
    expect(skill.abilityConfig).toBeDefined();
    expect(() => AbilityFactory.create(skill.abilityConfig!)).not.toThrow();
    expectProductModelAffixes(skill.productModel, 'skill');
  }

  const artifactIds = new Set(
    draft.cultivator.inventory.artifacts.map((artifact) => artifact.id),
  );
  for (const artifact of draft.cultivator.inventory.artifacts) {
    expect(artifact.abilityConfig).toBeDefined();
    expect(() => AbilityFactory.create(artifact.abilityConfig!)).not.toThrow();
    expectProductModelAffixes(artifact.productModel, 'artifact');
    expect(artifact.battleRuntimeMeta?.anchorRealm).toBe(draft.cultivator.realm);
  }

  for (const slot of ['weapon', 'armor', 'accessory'] as const) {
    const equippedId = draft.cultivator.equipped[slot];
    if (!equippedId) continue;
    expect(artifactIds.has(equippedId)).toBe(true);
    expect(
      draft.cultivator.inventory.artifacts.find(
        (artifact) => artifact.id === equippedId,
      )?.slot,
    ).toBe(slot);
  }
}

function expectProductModelAffixes(
  productModel: unknown,
  productType: 'gongfa' | 'skill' | 'artifact',
) {
  expect(productModel).toBeDefined();
  expect(productModel).toMatchObject({ productType });
  expect(
    (productModel as { affixes?: unknown[] }).affixes?.length ?? 0,
  ).toBeGreaterThan(0);
}

function stripEnemyLoadout(cultivator: Cultivator): Cultivator {
  return {
    ...cultivator,
    cultivations: [],
    skills: [],
    inventory: {
      ...cultivator.inventory,
      artifacts: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
  };
}

function skillFunctionTags(skill: Cultivator['skills'][number]): string[] {
  return skill.abilityConfig?.tags?.filter((tag) =>
    tag.startsWith(GameplayTags.ABILITY.FUNCTION.ROOT),
  ) ?? [];
}

function isPressureSkill(skill: Cultivator['skills'][number]): boolean {
  const abilityConfig = skill.abilityConfig;
  const tags = skillFunctionTags(skill);
  return Boolean(
    abilityConfig?.targetPolicy?.team === 'enemy' &&
      (tags.includes(GameplayTags.ABILITY.FUNCTION.DAMAGE) ||
        tags.includes(GameplayTags.ABILITY.FUNCTION.CONTROL)),
  );
}

function assertThreateningLoadout(
  draft: ReturnType<typeof enemyGenerator.buildDraft>,
) {
  const skills = draft.cultivator.skills;
  expect(skills.length).toBeGreaterThan(0);

  const skillCount = skills.length as 1 | 2 | 3 | 4;
  const policy = getEnemyCombatPolicy(draft.input.race);
  const pressureCount = skills.filter(isPressureSkill).length;
  const selfTargetCount = skills.filter(
    (skill) => skill.abilityConfig?.targetPolicy?.team === 'self',
  ).length;
  const allFunctionTags = skills.flatMap(skillFunctionTags);

  expect(pressureCount).toBeGreaterThanOrEqual(
    policy.minPressureBySkillCount[skillCount],
  );
  expect(selfTargetCount).toBeLessThanOrEqual(
    policy.maxSelfTargetBySkillCount[skillCount],
  );
  expect(selfTargetCount).toBeLessThan(skills.length);
  expect(
    allFunctionTags.every((tag) => tag === GameplayTags.ABILITY.FUNCTION.HEAL),
  ).toBe(false);
  expect(
    allFunctionTags.every((tag) => tag === GameplayTags.ABILITY.FUNCTION.BUFF),
  ).toBe(false);

  if (skills.length === 1) {
    expect(isPressureSkill(skills[0]!)).toBe(true);
  }
  if (skills.length >= 3) {
    expect(pressureCount).toBeGreaterThanOrEqual(2);
  }
}

describe('EnemyGenerator', () => {
  it.each([
    { difficulty: 0, factor: 0.6 },
    { difficulty: 25, factor: 0.8 },
    { difficulty: 50, factor: 1 },
    { difficulty: 70, factor: 1.2 },
    { difficulty: 85, factor: 1.5 },
    { difficulty: 100, factor: 2.0 },
  ])('maps difficulty $difficulty to factor $factor', ({ difficulty, factor }) => {
    const draft = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '中期',
      race: '人族',
      difficulty,
    });

    expect(draft.balance.difficultyFactor).toBeCloseTo(factor, 6);
    expect(draft.balance.totalAttributeBudget).toBe(
      Math.round(getRealmStageAttributeBudget('筑基', '中期') * factor),
    );
    expect(sumAttributes(draft.cultivator.attributes)).toBe(
      draft.balance.totalAttributeBudget,
    );
  });

  it('generates deterministic body cultivation condition without timestamp churn', () => {
    const input = {
      realm: '金丹' as const,
      realmStage: '后期' as const,
      race: '魔族' as const,
      difficulty: 88,
      isBoss: true,
      variantSeed: 'body-deterministic',
    };

    const left = enemyGenerator.buildDraft(input);
    const right = enemyGenerator.buildDraft(input);

    expect(left.cultivator.condition).toEqual(right.cultivator.condition);
    expect(left.cultivator.condition?.timestamps).toEqual({});
    expect(left.cultivator.condition?.tracks.bodyCultivation).toMatchObject({
      realm: left.balance.bodyCultivation.realm,
      tracks: {
        skin: { level: left.balance.bodyCultivation.trackLevels.skin },
        sinew_bone: {
          level: left.balance.bodyCultivation.trackLevels.sinew_bone,
        },
        organs: { level: left.balance.bodyCultivation.trackLevels.organs },
        qi_blood: { level: left.balance.bodyCultivation.trackLevels.qi_blood },
        primordial_spirit: {
          level: left.balance.bodyCultivation.trackLevels.primordial_spirit,
        },
      },
    });
    expect(left.copyFacts.bodyCultivation).toEqual(left.balance.bodyCultivation);
  });

  it('scales enemy body cultivation total level by difficulty and boss status', () => {
    const totals = [
      { difficulty: 10, isBoss: false },
      { difficulty: 50, isBoss: false },
      { difficulty: 90, isBoss: false },
      { difficulty: 90, isBoss: true },
    ].map(
      (input) =>
        enemyGenerator.buildDraft({
          realm: '筑基',
          realmStage: '中期',
          race: '妖族',
          ...input,
          variantSeed: `body-scale:${input.difficulty}:${input.isBoss}`,
        }).balance.bodyCultivation.totalLevel,
    );

    expect(totals[1]).toBeGreaterThan(totals[0]);
    expect(totals[2]).toBeGreaterThan(totals[1]);
    expect(totals[3]).toBeGreaterThan(totals[2]);
  });

  it('uses race preferences for enemy body cultivation focus tracks', () => {
    const expectedTopTracks: Record<EnemyRace, string[]> = {
      人族: ['organs', 'primordial_spirit'],
      妖族: ['qi_blood', 'sinew_bone', 'skin'],
      鬼魂: ['primordial_spirit', 'organs'],
      魔族: ['organs', 'qi_blood', 'skin'],
      古兽: ['sinew_bone', 'skin', 'qi_blood'],
      灵族: ['organs', 'primordial_spirit', 'skin'],
    };

    for (const race of ENEMY_RACE_VALUES) {
      const draft = enemyGenerator.buildDraft({
        realm: '元婴',
        realmStage: '后期',
        race,
        difficulty: 100,
        isBoss: true,
        variantSeed: `body-race:${race}`,
      });
      const trackLevels = draft.balance.bodyCultivation.trackLevels;
      const highestLevel = Math.max(...Object.values(trackLevels));
      const highestTracks = Object.entries(trackLevels)
        .filter(([, level]) => level === highestLevel)
        .map(([track]) => track);

      expect(
        highestTracks.some((track) => expectedTopTracks[race].includes(track)),
      ).toBe(true);
    }
  });

  it('starts generated enemy condition resources at display max resources', () => {
    const draft = enemyGenerator.buildDraft({
      realm: '元婴',
      realmStage: '后期',
      race: '古兽',
      difficulty: 95,
      isBoss: true,
      variantSeed: 'body-resources',
    });
    const display = getCultivatorDisplayAttributes(draft.cultivator);

    expect(draft.cultivator.condition?.resources.hp.current).toBe(display.maxHp);
    expect(draft.cultivator.condition?.resources.mp.current).toBe(display.maxMp);
    expect(sumAttributes(draft.cultivator.attributes)).toBe(
      draft.balance.totalAttributeBudget,
    );
  });

  it.each([
    {
      difficulty: 10,
      isBoss: false,
      expectedBand: 'core',
      expectedSkills: 1,
      expectedArtifacts: 0,
    },
    {
      difficulty: 50,
      isBoss: false,
      expectedBand: 'variant',
      expectedSkills: 2,
      expectedArtifacts: 1,
    },
    {
      difficulty: 70,
      isBoss: false,
      expectedBand: 'advanced',
      expectedSkills: 3,
      expectedArtifacts: 2,
    },
    {
      difficulty: 95,
      isBoss: false,
      expectedBand: 'legendary',
      expectedSkills: 4,
      expectedArtifacts: 3,
    },
    {
      difficulty: 8,
      isBoss: true,
      expectedBand: 'core',
      expectedSkills: 1,
      expectedArtifacts: 0,
    },
  ] as const)(
    'scales loadout for difficulty $difficulty boss=$isBoss',
    ({ difficulty, isBoss, expectedBand, expectedSkills, expectedArtifacts }) => {
      const draft = enemyGenerator.buildDraft({
        realm: '筑基',
        realmStage: '中期',
        race: '人族',
        difficulty,
        isBoss,
      });

      expect(draft.balance.band).toBe(expectedBand);
      expect(draft.cultivator.skills).toHaveLength(expectedSkills);
      expect(draft.cultivator.inventory.artifacts).toHaveLength(expectedArtifacts);
    },
  );

  it('redistributes attributes by race profile while preserving total budget', () => {
    const expectations: Record<
      EnemyRace,
      {
        top: string | string[];
        second?: string | string[];
      }
    > = {
      人族: { top: 'wisdom', second: 'spirit' },
      妖族: { top: 'vitality', second: 'speed' },
      鬼魂: { top: 'spirit', second: 'willpower' },
      魔族: { top: ['vitality', 'spirit'], second: ['vitality', 'spirit'] },
      古兽: { top: 'vitality', second: ['spirit', 'speed'] },
      灵族: { top: 'spirit', second: 'wisdom' },
    };

    for (const [race, expected] of Object.entries(expectations) as Array<
      [EnemyRace, (typeof expectations)[EnemyRace]]
    >) {
      const draft = enemyGenerator.buildDraft({
        realm: '金丹',
        realmStage: '中期',
        race,
        difficulty: 50,
      });
      const ordered = Object.entries(draft.cultivator.attributes)
        .sort((left, right) => right[1] - left[1])
        .map(([key]) => key);

      expect(sumAttributes(draft.cultivator.attributes)).toBe(
        draft.balance.totalAttributeBudget,
      );
      if (Array.isArray(expected.top)) {
        expect(expected.top).toContain(ordered[0]);
      } else {
        expect(ordered[0]).toBe(expected.top);
      }
      if (expected.second) {
        if (Array.isArray(expected.second)) {
          expect(expected.second).toContain(ordered[1]);
        } else {
          expect(ordered[1]).toBe(expected.second);
        }
      }
    }
  });

  it('builds deterministic stable snapshots for the same battle parameters', () => {
    const input = {
      realm: '金丹' as const,
      realmStage: '中期' as const,
      race: '灵族' as const,
      difficulty: 73,
      isBoss: true,
    };

    const left = enemyGenerator.buildDraft(input);
    const right = enemyGenerator.buildDraft(input);

    expect(snapshotEnemy(left)).toBe(snapshotEnemy(right));
  });

  it('keeps same-race variants from collapsing into one loadout signature', () => {
    const signatures = [18, 42, 68, 92].map((difficulty) => {
      const draft = enemyGenerator.buildDraft({
        realm: '元婴',
        realmStage: '中期',
        race: '妖族',
        difficulty,
      });
      return [
        draft.balance.primaryPersonaId,
        draft.balance.accentPersonaId ?? 'none',
        ...draft.cultivator.skills.map((skill) => skill.abilityConfig?.slug ?? skill.name),
        ...draft.cultivator.inventory.artifacts.map(
          (artifact) => artifact.abilityConfig?.slug ?? artifact.name,
        ),
      ].join('|');
    });

    expect(new Set(signatures).size).toBeGreaterThan(1);
  });

  it('keeps all race x band x boss combinations battle-ready', () => {
    const combinations = (
      [
        { difficulty: 10, isBoss: false },
        { difficulty: 40, isBoss: false },
        { difficulty: 70, isBoss: false },
        { difficulty: 95, isBoss: false },
        { difficulty: 95, isBoss: true },
      ] as const
    ).flatMap((config) =>
      (['人族', '妖族', '鬼魂', '魔族', '古兽', '灵族'] as const).map((race) => ({
        ...config,
        race,
      })),
    );

    for (const combo of combinations) {
      const draft = enemyGenerator.buildDraft({
        realm: combo.isBoss ? '元婴' : '金丹',
        realmStage: combo.isBoss ? '后期' : '中期',
        race: combo.race,
        difficulty: combo.difficulty,
        isBoss: combo.isBoss,
      });
      assertV5Compatible(draft);
    }
  });

  it('plans race-specific skill roles before crafting products', () => {
    for (const race of ENEMY_RACE_VALUES) {
      for (const difficulty of [10, 40, 70, 95] as const) {
        const draft = enemyGenerator.buildDraft({
          realm: '金丹',
          realmStage: '中期',
          race,
          difficulty,
        });
        const skillRoles = draft.copyFacts.products
          .filter((product) => product.productType === 'skill')
          .map((product) => product.role);
        const expectedRoles = getEnemyCombatPolicy(race).roleOrderBySkillCount[
          skillRoles.length as 1 | 2 | 3 | 4
        ];

        expect(skillRoles[0]).toBe(expectedRoles[0]);
        expect(validateEnemySkillRoles(getEnemyCombatPolicy(race), skillRoles)).toBe(
          true,
        );
      }
    }
  });

  it('keeps all race x band x boss skill loadouts threatening', () => {
    const combinations = (
      [
        { difficulty: 10, isBoss: false },
        { difficulty: 40, isBoss: false },
        { difficulty: 70, isBoss: false },
        { difficulty: 95, isBoss: false },
        { difficulty: 95, isBoss: true },
      ] as const
    ).flatMap((config) =>
      ENEMY_RACE_VALUES.map((race) => ({
        ...config,
        race,
      })),
    );

    for (const combo of combinations) {
      const draft = enemyGenerator.buildDraft({
        realm: combo.isBoss ? '元婴' : '金丹',
        realmStage: combo.isBoss ? '后期' : '中期',
        race: combo.race,
        difficulty: combo.difficulty,
        isBoss: combo.isBoss,
      });

      assertThreateningLoadout(draft);
    }
  });

  it('keeps enemy skill mp cost generated from pacing rules across difficulty bands', () => {
    for (const difficulty of [0, 25, 50, 70, 85, 95, 100] as const) {
      for (const isBoss of [false, true]) {
        for (const race of ENEMY_RACE_VALUES) {
          const draft = enemyGenerator.buildDraft({
            realm: '筑基',
            realmStage: '中期',
            race,
            difficulty,
            isBoss,
            variantSeed: 'quality-pacing',
          });
          const pressureSkills = draft.cultivator.skills.filter(isPressureSkill);

          expect(pressureSkills.length).toBeGreaterThanOrEqual(1);

          for (const skill of draft.cultivator.skills) {
            const mpCost = skill.abilityConfig?.mpCost ?? skill.cost ?? 0;
            expect(mpCost).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('can be materialized into combat units and run V5 battle smoke tests', () => {
    const player = createPlayerFixture();
    const normalEnemy = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '后期',
      race: '魔族',
      difficulty: 65,
    }).cultivator;
    const bossEnemy = enemyGenerator.buildDraft({
      realm: '金丹',
      realmStage: '后期',
      race: '古兽',
      difficulty: 95,
      isBoss: true,
    }).cultivator;

    expect(() => createCombatUnitFromCultivator(normalEnemy)).not.toThrow();
    expect(() => createCombatUnitFromCultivator(bossEnemy)).not.toThrow();

    const normalResult = simulateBattleV5(player, normalEnemy);
    const bossResult = simulateBattleV5(player, bossEnemy);
    expect(normalResult.winner).toBeDefined();
    expect(normalResult.logs.length).toBeGreaterThan(0);
    expect(bossResult.winner).toBeDefined();
    expect(bossResult.logs.length).toBeGreaterThan(0);
  });

  it('keeps early and mid difficulty enemies within baseline combat pressure', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const player = createPlayerFixture();

    const lowEnemy = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '中期',
      race: '人族',
      difficulty: 25,
    }).cultivator;
    const midEnemy = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '中期',
      race: '人族',
      difficulty: 50,
    }).cultivator;
    const eliteEnemy = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '中期',
      race: '人族',
      difficulty: 70,
    }).cultivator;
    const nakedLowEnemy = stripEnemyLoadout(lowEnemy);

    const playerPanel = getCultivatorDisplayAttributes(player).attrs;
    const nakedLowPanel = getCultivatorDisplayAttributes(nakedLowEnemy).attrs;
    const playerPrimaryOutput = Math.max(playerPanel.atk, playerPanel.magicAtk);
    const nakedLowPrimaryDefense = Math.max(
      nakedLowPanel.def,
      nakedLowPanel.magicDef,
    );

    expect(nakedLowPrimaryDefense).toBeLessThan(playerPrimaryOutput);
    expect(simulateBattleV5(player, lowEnemy).winner.id).toBe(player.id);
    expect(simulateBattleV5(player, midEnemy).turns).toBeGreaterThan(3);
    expect(simulateBattleV5(player, eliteEnemy).turns).toBeGreaterThan(1);
  });

  it('returns the same draft when shared uses the noop copy provider', async () => {
    const generator = new EnemyGenerator({
      copyProvider: new NoopEnemyCopyProvider(),
    });
    const draft = generator.buildDraft({
      realm: '筑基',
      realmStage: '中期',
      race: '灵族',
      difficulty: 55,
    });

    const enriched = await generator.enrichNarrative(draft);

    expect(enriched).toBe(draft);
  });

  it('builds a deterministic fallback title when no narrative override exists', () => {
    const draft = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '后期',
      race: '鬼魂',
      difficulty: 62,
    });

    expect(draft.cultivator.title).toBeTruthy();
    expect(draft.copyFacts.character.fallbackTitle).toBe(draft.cultivator.title);
  });

  it('only fills missing character narrative fields and rewrites product copy in one shot', async () => {
    const draft = enemyGenerator.buildDraft({
      realm: '金丹',
      realmStage: '中期',
      race: '灵族',
      name: '手填名字',
      title: '手填名号',
      background: '手填背景',
    });
    const enrich = vi.fn().mockResolvedValue({
      character: {
        name: '不应覆盖',
        title: '不应覆盖',
        background: '不应覆盖',
        description: '灵潮翻卷间，敌影似真似幻。',
      },
      products: draft.copyFacts.products.map((product, index) => ({
        id: product.id,
        name: `润色产物${index + 1}`,
        description: `润色描述${index + 1}`,
      })),
    });
    const generator = new EnemyGenerator({
      copyProvider: { enrich },
    });

    const enriched = await generator.enrichNarrative(draft);

    expect(enrich).toHaveBeenCalledTimes(1);
    expect(enriched.cultivator.name).toBe('手填名字');
    expect(enriched.cultivator.title).toBe('手填名号');
    expect(enriched.cultivator.background).toBe('手填背景');
    expect(enriched.cultivator.description).toBe('灵潮翻卷间，敌影似真似幻。');
    expect(enriched.cultivator.cultivations[0]?.name).toBe('润色产物1');
    expect(enriched.cultivator.cultivations[0]?.abilityConfig?.name).toBe('润色产物1');
    expect(enriched.cultivator.skills[0]?.name).toBe('润色产物2');
    expect(enriched.cultivator.skills[0]?.abilityConfig?.name).toBe('润色产物2');
    expect(enriched.cultivator.inventory.artifacts[0]?.name).toContain('润色产物');
  });

  it('rolls back the whole enrichment when product id sets do not match', async () => {
    const draft = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '后期',
      race: '鬼魂',
      difficulty: 62,
    });
    const enrich = vi.fn().mockResolvedValue({
      character: {
        name: '夜潮灵使',
        title: '镇潮灵卫',
        background: '其本体为潮汐灵物，久困古阵而化形。',
        description: '灵潮翻卷间，敌影似真似幻。',
      },
      products: [
        {
          id: 'wrong-id',
          name: '错误产物',
          description: '错误描述',
        },
      ],
    });
    const generator = new EnemyGenerator({
      copyProvider: { enrich },
    });

    const enriched = await generator.enrichNarrative(draft);

    expect(enriched).toBe(draft);
  });

  it('falls back to tier 3 safe recipes when intent crafting keeps failing', () => {
    const loadoutPlanner = new EnemyLoadoutPlanner();
    const executor = new EnemyCraftExecutor({
      craftFromIntent(input) {
        const session = new CreationSession({
          productType: input.productType,
          materials: [],
          slugSeed: input.slugSeed,
        });
        session.state.failureReason = 'forced failure';
        session.setPhase(CreationPhase.FAILED);
        return session;
      },
    });
    const input = {
      realm: '金丹' as const,
      realmStage: '后期' as const,
      race: '古兽' as const,
      difficulty: 95,
      isBoss: true,
    };
    const loadout = executor.execute({
      input: {
        ...input,
        name: undefined,
        background: undefined,
        description: undefined,
      },
      plan: loadoutPlanner.plan({
        ...input,
        name: undefined,
        background: undefined,
        description: undefined,
      }),
    });

    expect(loadout.recoveryTierUsed).toBe(3);
    expect(() => AbilityFactory.create(loadout.technique.item.abilityConfig!)).not.toThrow();
    for (const skill of loadout.skills) {
      expect(() => AbilityFactory.create(skill.item.abilityConfig!)).not.toThrow();
    }
    for (const artifact of loadout.artifacts) {
      expect(() => AbilityFactory.create(artifact.item.abilityConfig!)).not.toThrow();
    }

    const fallbackSkills = loadout.skills.map(
      (skill) => skill.item as Cultivator['skills'][number],
    );
    const policy = getEnemyCombatPolicy(input.race);
    const skillCount = fallbackSkills.length as 1 | 2 | 3 | 4;
    const pressureCount = fallbackSkills.filter(isPressureSkill).length;
    const selfTargetCount = fallbackSkills.filter(
      (skill) => skill.abilityConfig?.targetPolicy?.team === 'self',
    ).length;

    expect(pressureCount).toBeGreaterThanOrEqual(
      policy.minPressureBySkillCount[skillCount],
    );
    expect(selfTargetCount).toBeLessThanOrEqual(
      policy.maxSelfTargetBySkillCount[skillCount],
    );
    expect(
      fallbackSkills
        .filter(isPressureSkill)
        .every((skill) => (skill.abilityConfig?.mpCost ?? skill.cost ?? 0) === 80),
    ).toBe(false);

    for (const skill of fallbackSkills) {
      const model = skill.productModel as SkillProductModel | undefined;
      expect(model?.productType).toBe('skill');
      const rehydrated = deserializeAndRehydrate(
        serializeProductModel(model!),
      ) as SkillProductModel;
      expect(rehydrated.battleProjection.mpCost).toBe(
        model!.battleProjection.mpCost,
      );
      expect(rehydrated.battleProjection.cooldown).toBe(
        model!.battleProjection.cooldown,
      );
    }
  });

  it('keeps low-floor ghost drafts threatening even when safety fallback is needed', () => {
    const draft = enemyGenerator.buildDraft({
      realm: '筑基',
      realmStage: '初期',
      race: '鬼魂',
      difficulty: 1,
    });

    expect(draft.balance.recoveryTierUsed).toBe(3);
    assertThreateningLoadout(draft);
  });
});
