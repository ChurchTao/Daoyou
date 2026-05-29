import { renderPrompt } from '@server/lib/prompts';
import { describe, expect, it } from 'vitest';
import {
  buildDungeonRoundLlmContext,
  buildDungeonSettlementLlmContext,
} from './llmContext';
import type { DungeonState } from './types';

function buildDungeonState(): DungeonState {
  return {
    cultivatorId: 'cultivator-1',
    mapNodeId: 'map-1',
    theme: '古修遗府',
    currentRound: 4,
    maxRounds: 5,
    history: [
      {
        round: 1,
        scene:
          '你穿过残碑与断桥，见到旧时宗门留下的冷寂山门，风里仍有灰烬味道。',
        choice: '先探外围',
        outcome: '避开残阵，寻得一条偏僻山道。',
        gained_items: ['避尘符'],
      },
      {
        round: 2,
        scene: '你沿山道深入，岩壁上残留焦黑掌印与妖血痕迹。',
        choice: '追索妖气',
        outcome: '误入毒瘴，被迫耗费灵力护体。',
      },
      {
        round: 3,
        scene: '你在偏殿前撞见守陵阴魂，阴风卷起碎甲与白骨。',
        choice: '正面破敌',
        outcome: '历经苦战，你击败守陵阴魂，暂得喘息之机。',
        gained_items: ['阴玉', '残甲'],
      },
      {
        round: 4,
        scene: '阴魂散尽后，石门缓缓洞开，露出封尘已久的内库甬道。',
        gained_items: ['玄纹残卷'],
      },
    ],
    status: 'EXPLORING',
    dangerScore: 62,
    isFinished: false,
    currentOptions: [
      {
        id: 1,
        text: '试探前行',
        risk_level: 'low',
      },
    ],
    settlement: undefined,
    playerInfo: {
      name: '林秋',
      realm: '金丹 中期',
      gender: '男',
      age: 27,
      lifespan: 168,
      personality: '冷静谨慎，擅长后发制人',
      attributes: {
        vitality: 82,
        spirit: 91,
        wisdom: 76,
        speed: 68,
        willpower: 79,
      },
      spiritual_roots: ['火灵根（偏盛）', '木灵根'],
      fates: ['焚脉余烬（斗法后更易爆发）', '孤星照命（机缘多伴凶险）'],
      skills: ['离火御剑诀', '青木养元术', '玄光遁法'],
      spirit_stones: 1280,
      background:
        '出身边荒小宗，曾在矿脉争夺中失去师承，往后行事多半留有后手。',
      inventory_summary:
        '储物袋中尚有两件中品法器、若干疗伤丹与一批未鉴定矿料。',
      resourceCaps: {
        maxHp: 1200,
        maxMp: 900,
      },
    },
    location: {
      location: '古修遗府',
      location_tags: ['残阵', '阴魂', '内库', '秘道', '古战场', '禁制', '多余标签'],
      location_description:
        '这座遗府久无人烟，石壁满是裂痕与古篆，灵机时断时续，稍不留神便会引动旧禁与阴煞反噬。',
    },
    summary_of_sacrifice: [
      {
        type: 'hp_loss',
        value: 0.12,
        desc: '胸口被阴风撕裂',
      },
      {
        type: 'hp_loss',
        value: 0.08,
        desc: '强破残阵时再添伤势',
      },
      {
        type: 'material',
        value: 1,
        required_type: 'herb',
        required_quality: '灵品',
      },
    ],
    realGains: [],
    accumulatedRewards: [
      {
        name: '阴玉',
        description: '触之冰寒，可镇魂安魄。',
        material_type: 'monster',
        element: '水',
        reward_score: 44,
        quality_hint: { legacy: true },
      },
      {
        name: '玄纹残卷',
        description: '卷中残留古阵纹理，可供参悟。',
        material_type: 'gongfa_manual',
        reward_score: 63,
      },
    ],
    currentRoundItems: [],
    accumulatedHpLoss: 0.2333,
    accumulatedMpLoss: 0.4567,
    condition: {
      statuses: [
        {
          key: 'weakness',
          source: 'event',
          stacks: 2,
        },
      ],
    } as DungeonState['condition'],
  };
}

describe('dungeon llm context', () => {
  it('buildDungeonRoundLlmContext only exposes the compact fields needed for narration', () => {
    const state = buildDungeonState();
    state.history = state.history.slice(0, 3);

    const context = buildDungeonRoundLlmContext({
      state,
      mapRealm: '金丹',
      realmGap: 0,
      phase: '夺宝期：副本高潮，风险应显著抬升。',
    });

    expect(Object.keys(context)).toEqual([
      'round',
      'maxRounds',
      'phase',
      'realmGap',
      'dangerScore',
      'map',
      'player',
      'history',
      'resourcePressure',
      'battleAftermath',
      'accumulatedRewardNames',
    ]);
    expect(Object.keys(context.map)).toEqual([
      'name',
      'realmRequirement',
      'tags',
      'descriptionSummary',
    ]);
    expect(context.map.tags).toHaveLength(6);
    expect(context.map.descriptionSummary.length).toBeLessThanOrEqual(80);

    expect(Object.keys(context.player)).toEqual([
      'name',
      'realm',
      'age',
      'lifespan',
      'coreTraits',
      'rootsSummary',
      'fatesSummary',
      'techniqueNames',
      'combatStyleSummary',
    ]);
    expect((context.player as Record<string, unknown>).attributes).toBeUndefined();
    expect((context.player as Record<string, unknown>).background).toBeUndefined();
    expect((context.player as Record<string, unknown>).spirit_stones).toBeUndefined();

    expect(context.history).toHaveLength(3);
    expect(context.history[0]?.round).toBe(1);
    expect(context.history[2]?.gainedItemNames).toEqual(['阴玉', '残甲']);
    expect(context.resourcePressure).toEqual({
      hpLossRatio: 0.233,
      mpLossRatio: 0.457,
      hasWeakness: true,
    });
    expect(context.battleAftermath).toContain('历经苦战');
    expect(context.accumulatedRewardNames).toEqual([
      '阴玉[monster]',
      '玄纹残卷[gongfa_manual]',
    ]);
  });

  it('buildDungeonSettlementLlmContext removes verbose state but keeps reward inheritance inputs', () => {
    const context = buildDungeonSettlementLlmContext({
      state: buildDungeonState(),
      mapRealm: '金丹',
      endDisposition: 'retreated_after_battle',
    });

    expect(Object.keys(context)).toEqual([
      'map',
      'player',
      'journeySummary',
      'dangerScore',
      'sacrificeSummary',
      'accumulatedRewards',
      'endDisposition',
    ]);
    expect(context.map).toEqual({
      name: '古修遗府',
      realmRequirement: '金丹',
    });
    expect(context.player).toEqual({
      name: '林秋',
      realm: '金丹 中期',
    });
    expect(context.journeySummary).toHaveLength(4);
    expect(context.journeySummary[0]).toContain('第1轮');
    expect(context.sacrificeSummary).toEqual(
      expect.arrayContaining([
        {
          type: 'hp_loss',
          count: 2,
          totalValue: 0.2,
          sample: '胸口被阴风撕裂',
        },
        {
          type: 'material',
          count: 1,
          totalValue: 1,
          sample: '灵品 herb',
        },
      ]),
    );
    expect(context.accumulatedRewards).toEqual([
      {
        name: '阴玉',
        description: '触之冰寒，可镇魂安魄。',
        material_type: 'monster',
        element: '水',
        reward_score: 44,
      },
      {
        name: '玄纹残卷',
        description: '卷中残留古阵纹理，可供参悟。',
        material_type: 'gongfa_manual',
        reward_score: 63,
      },
    ]);
    expect(context.endDisposition).toBe('retreated_after_battle');
  });

  it('dungeon prompts keep system text stable across different runtime payloads', () => {
    const firstRoundSystem = renderPrompt('dungeon-round', {
      materialTypeTable: '| herb | 草药 |',
      userContextJson: '{"round":1}',
    }).system;
    const secondRoundSystem = renderPrompt('dungeon-round', {
      materialTypeTable: '| herb | 草药 |',
      userContextJson: '{"round":5,"dangerScore":99}',
    }).system;
    const firstSettlementSystem = renderPrompt('dungeon-settlement', {
      materialTypeTable: '| ore | 矿石 |',
      settlementContextJson: '{"player":{"name":"林秋"}}',
    }).system;
    const secondSettlementSystem = renderPrompt('dungeon-settlement', {
      materialTypeTable: '| ore | 矿石 |',
      settlementContextJson: '{"endDisposition":"abandoned_before_battle"}',
    }).system;

    expect(firstRoundSystem).toBe(secondRoundSystem);
    expect(firstSettlementSystem).toBe(secondSettlementSystem);
  });
});
