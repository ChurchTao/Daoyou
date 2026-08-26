import { describe, expect, it } from 'vitest';
import {
  STANDARD_SECT_PRESENTATION,
  StandardSectOrganizationModule,
  type SectPresentationTheme,
} from '../core';
import { LINGXIAO_SECT_PRESENTATION } from './lingxiao';
import {
  PRODUCTION_SECT_PRESENTATIONS,
  PRODUCTION_SECTS,
} from './productionRuntime';
import { TIANYAN_SECT_PRESENTATION } from './tianyan';
import { WUXIANG_SECT_PRESENTATION } from './wuxiang';
import { YOUDU_SECT_PRESENTATION } from './youdu';
import { JIUJIE_SECT_PRESENTATION } from './jiujie';

const taskIds = [
  'gate_sweep',
  'mine_patrol',
  'spirit_mining',
  'pill_delivery',
  'artifact_delivery',
  'weekly_diligence',
  'weekly_tournament',
  'weekly_bounty_battle',
  'weekly_bounty_material',
  'elder_trial',
] as const;

const canonicalNpcRoles = [
  {
    sigil: '执',
    identity: '值日执事',
    responsibility: '负责日常委托。',
  },
  {
    sigil: '簿',
    identity: '功簿执事',
    responsibility: '负责周常委托。',
  },
  {
    sigil: '传',
    identity: '传功长老',
    responsibility: '负责晋升试炼。',
  },
] as const;

const facilityActorKeys = [
  ['hall', 'registry'],
  ['hall', 'stipend'],
  ['treasury', 'keeper'],
  ['industries', 'construction'],
  ['industries', 'donation'],
  ['archive', 'keeper'],
  ['paths', 'guide'],
  ['arena', 'instructor'],
  ['arena', 'marshal'],
  ['cultivation', 'keeper'],
  ['alchemy', 'keeper'],
  ['refinery', 'keeper'],
  ['spiritVein', 'keeper'],
  ['herbGarden', 'keeper'],
  ['gate', 'keeper'],
  ['spiritVein', 'facility'],
  ['herbGarden', 'facility'],
  ['gate', 'facility'],
] as const;

const expectedFacilityNames: Readonly<Record<string, readonly string[]>> = {
  [LINGXIAO_SECT_PRESENTATION.sectId]: [
    '顾怀真',
    '柳七',
    '叶归鸿',
    '杜长庚',
    '苗小满',
    '温不言',
    '祝平生',
    '霍千钧',
    '苏放鹤',
    '晏无声',
    '程晚照',
    '谭折柳',
    '邵沉川',
    '秦晚晴',
    '骆长亭',
    '灵脉矿场',
    '宗门药田',
    '山门',
  ],
  [TIANYAN_SECT_PRESENTATION.sectId]: [
    '含章真人',
    '清和',
    '怀谷道人',
    '鸣谦道人',
    '履霜',
    '既白真人',
    '观复真人',
    '玄同道人',
    '景初',
    '抱一真人',
    '允中道人',
    '松乔道人',
    '见素',
    '元吉',
    '望舒',
    '坤元地脉',
    '长生圃',
    '观象门',
  ],
  [WUXIANG_SECT_PRESENTATION.sectId]: [
    '慧澄',
    '明济',
    '寂照禅师',
    '行深',
    '明简',
    '空渡禅师',
    '慧照',
    '法忍禅师',
    '行觉',
    '寂然禅师',
    '明恕',
    '法圆',
    '慧海',
    '行愿',
    '道安禅师',
    '骨玉窟',
    '血莲池',
    '不二门',
  ],
  [YOUDU_SECT_PRESENTATION.sectId]: [
    '沈故衣',
    '温婆婆',
    '阮秋声',
    '戚百岁',
    '阿七',
    '褚先生',
    '商无咎',
    '迟归鹤',
    '桑小满',
    '宁无恙',
    '白蘅',
    '祝余',
    '贺寒川',
    '柳十三',
    '顾长夜',
    '黑水阴脉',
    '彼岸圃',
    '无日关',
  ],
  [JIUJIE_SECT_PRESENTATION.sectId]: [
    '司雷', '听劫', '衡天', '营造监', '捐献使', '掌卷', '引路天官', '演武教习', '执刑', '守静', '听雷丹师', '断劫使', '雷髓监', '守园', '守天阶', '中天雷池', '天听木圃', '九劫天阶',
  ],
};

const productionThemes: readonly SectPresentationTheme[] = [
  LINGXIAO_SECT_PRESENTATION,
  TIANYAN_SECT_PRESENTATION,
  WUXIANG_SECT_PRESENTATION,
  YOUDU_SECT_PRESENTATION,
  JIUJIE_SECT_PRESENTATION,
];

const canonicalMapNotes: Readonly<Record<string, string>> = {
  hall: '身份 · 同门 · 周俸',
  archive: '心法研习',
  cliff: '流派 · 参悟',
  arena: '神通 · 战术 · 小比',
  affairs: '日常 · 周常 · 晋升',
  treasury: '贡献兑换',
  industries: '设施建设 · 灵石捐献',
  cultivation: '闭关修炼 · 设施灵效',
  alchemy: '炼丹 · 设施灵效',
  refinery: '炼器 · 设施灵效',
  vein: '矿场巡视 · 灵石收益 · 采矿',
  garden: '草木长势 · 产出待开放',
  gate: '山门动态 · 清扫差事',
  cave: '弟子居所',
  formation: '宗门战后续开放',
};

describe('production sect affairs presentations', () => {
  it('keeps map notes aligned with current facility responsibilities', () => {
    for (const theme of productionThemes) {
      const notes = Object.fromEntries(
        theme.map?.hotspots?.map((hotspot) => [hotspot.id, hotspot.note]) ?? [],
      );
      expect(notes).toEqual(
        theme.sectId === 'jiujie'
          ? { ...canonicalMapNotes, cliff: '劫眼临身 · 流派参悟', condemnation: '天谴加身 · 流派参悟' }
          : canonicalMapNotes,
      );
    }
  });

  it('provides twelve named NPCs with canonical roles', () => {
    const expectedNames = [
      ['陆青崖', '裴守拙', '听剑老人'],
      ['法明', '慧觉', '空慈方丈'],
      ['知微', '玄衡道人', '观澜真人'],
      ['照灯', '守簿翁', '归魂婆婆'],
      ['照雷执事', '守簿翁', '九门长老'],
    ];
    const presentations = Object.values(PRODUCTION_SECT_PRESENTATIONS);

    expect(presentations).toHaveLength(5);
    expect(
      presentations.map((presentation) =>
        presentation.rooms.affairs.actors.map((npc) => npc.name),
      ),
    ).toEqual(expectedNames);
    for (const presentation of presentations) {
      const npcs = presentation.rooms.affairs.actors;
      expect(new Set(npcs.map((npc) => npc.id)).size).toBe(3);
      expect(npcs).toMatchObject(canonicalNpcRoles);
      for (const npc of npcs) expect(npc.greeting.trim()).not.toBe('');
      expect(presentation.terms.sweepActivity).toBe('清扫山门');
      expect(presentation.terms.sweepCanvasLabel).toBe('清扫山门游戏画布');
    }
  });

  it('uses one canonical presentation for every standard task', () => {
    const standard = new StandardSectOrganizationModule();

    for (const { module } of PRODUCTION_SECTS) {
      for (const taskId of taskIds) {
        expect(module.organization.tasks.get(taskId)?.presentation).toEqual(
          standard.tasks.get(taskId)?.presentation,
        );
      }
    }
  });

  it('keeps the tournament entrance on the arena facility', () => {
    for (const presentation of Object.values(PRODUCTION_SECT_PRESENTATIONS)) {
      expect(
        presentation.rooms.arena.actors.find(
          (actor) => actor.roleKey === 'ring',
        ),
      ).toMatchObject({
        sigil: '⚔️',
        name: '宗门擂台',
        identity: '宗门设施',
        appearance: 'facility',
        conversation: {
          renderer: 'sect.arena.tournament',
          parameters: { locationKey: 'sect.arena' },
        },
      });
      expect(
        presentation.rooms.arena.actors.find(
          (actor) => actor.roleKey === 'marshal',
        )?.conversation.renderer,
      ).toBe('sect.arena.marshal');
    }
  });

  it('uses the exact themed facility names without changing role semantics', () => {
    for (const [sectId, expectedNames] of Object.entries(
      expectedFacilityNames,
    )) {
      const presentation = PRODUCTION_SECT_PRESENTATIONS[sectId];
      const actors = facilityActorKeys.map(([roomKey, roleKey]) =>
        presentation.rooms[roomKey].actors.find(
          (actor) => actor.roleKey === roleKey,
        ),
      );

      expect(actors.map((actor) => actor?.name)).toEqual(expectedNames);
      for (const [index, actor] of actors.entries()) {
        const [roomKey, roleKey] = facilityActorKeys[index];
        const standardActor = STANDARD_SECT_PRESENTATION.rooms[
          roomKey
        ].actors.find((candidate) => candidate.roleKey === roleKey);
        expect(actor).toBeDefined();
        expect(actor).toMatchObject({
          sigil: standardActor?.sigil,
          identity: standardActor?.identity,
          responsibility: standardActor?.responsibility,
          conversation: standardActor?.conversation,
        });
        expect(actor?.greeting.trim()).not.toBe('');
      }

      const affairsNames = presentation.rooms.affairs.actors.map(
        (actor) => actor.name,
      );
      const allNames = [...affairsNames, ...expectedNames];
      expect(new Set(allNames).size).toBe(21);
      expect(expectedNames.slice(0, 15).join('')).not.toMatch(
        /[籍禄库仓材门脉药炉铸场魂鬼阴灯影]/u,
      );
    }
  });

  it('requires every production theme to explicitly name facility actors', () => {
    for (const theme of productionThemes) {
      const expectedNames = expectedFacilityNames[theme.sectId];
      const overrides = facilityActorKeys.map(([roomKey, roleKey]) => {
        const actor = theme.rooms?.[roomKey]?.actors?.[roleKey];
        expect(actor?.id?.trim()).not.toBe('');
        expect(actor?.name?.trim()).not.toBe('');
        expect(actor?.greeting?.trim()).not.toBe('');
        return actor;
      });

      expect(overrides.map((actor) => actor?.name)).toEqual(expectedNames);
    }
  });
});
