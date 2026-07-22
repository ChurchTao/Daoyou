import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_SECT_IDS,
  projectSectCombat,
  resolveSectAbility,
  resolveSectAbilities,
} from '../..';
import { SectStateValidator, isListedSectAbility } from '../../../core';
import {
  TIANYAN_HETU_PATH_ID,
  TIANYAN_LANDING_ABILITY_IDS,
  TIANYAN_LUOSHU_PATH_ID,
  TIANYAN_METHOD_IDS,
  TIANYAN_MODULE,
  TIANYAN_ORGANIZATION_THEME,
  TIANYAN_SECT_PRESENTATION,
  TIANYAN_VISIBLE_ABILITY_IDS,
} from '..';
import { tianyanState } from './testState';

describe('天衍圣地战斗投影', () => {
  it('进入生产目录并满足六心法、13门可见神通、双道途与36节点契约', () => {
    const definition = TIANYAN_MODULE.definition;
    expect(PRODUCTION_SECT_IDS).toContain('tianyan');
    expect(definition.configVersion).toBe(1);
    expect(definition.methods.map((method) => method.id)).toEqual(TIANYAN_METHOD_IDS);
    expect(definition.abilities.filter(isListedSectAbility).map((ability) => ability.id))
      .toEqual(TIANYAN_VISIBLE_ABILITY_IDS);
    expect(definition.abilities.filter((ability) => ability.kind === 'default')).toHaveLength(1);
    expect(definition.paths.map((path) => path.id)).toEqual([
      TIANYAN_HETU_PATH_ID,
      TIANYAN_LUOSHU_PATH_ID,
    ]);
    for (const path of definition.paths) {
      expect(path.layers).toHaveLength(6);
      expect(path.nodes).toHaveLength(18);
      expect(path.tactics).toHaveLength(3);
      for (const layer of path.layers) {
        expect(path.nodes.filter((node) => node.layerId === layer.id)).toHaveLength(3);
      }
    }
  });

  it('宗门定义、初始构筑与全部持久化内容ID稳定', () => {
    const definition = TIANYAN_MODULE.definition;
    const localId = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    expect(definition.id).toBe('tianyan');
    expect(definition.name).toBe('天衍圣地');
    expect(definition.raceIds).toEqual(['human']);
    expect(definition.combatResource).toMatchObject({
      id: 'sect.tianyan.derivation',
      name: '衍数',
      max: 3,
    });
    expect(definition.onboarding).toMatchObject({
      initialContribution: 30,
      initialMethods: {
        'tianyan-canon': 5,
        'wood-vitality': 1,
        'fire-illumination': 1,
        'earth-bearing': 1,
        'metal-severing': 1,
        'water-flowing': 1,
      },
      initialAbilityLoadout: [
        'verdant-pulse',
        'flowing-flame',
        'dark-water-return',
        'shift-palace',
      ],
    });

    const ids = [
      definition.id,
      ...definition.methods.map((entry) => entry.id),
      ...definition.abilities.map((entry) => entry.id),
      ...definition.paths.flatMap((path) => [
        path.id,
        ...path.tactics.map((entry) => entry.id),
        ...path.nodes.map((entry) => entry.id),
      ]),
    ];
    expect(ids.every((id) => localId.test(id))).toBe(true);
    expect(new Set(definition.methods.map((entry) => entry.slot)).size).toBe(6);
    expect(definition.onboarding.initialAbilityLoadout).toHaveLength(4);
    for (const abilityId of definition.onboarding.initialAbilityLoadout) {
      const ability = definition.abilities.find((entry) => entry.id === abilityId);
      expect(ability).toBeDefined();
      expect(ability?.kind).toBe('active');
    }
  });

  it('五幕入门、15个标准地图热点与组织展示主题完整', () => {
    expect(TIANYAN_SECT_PRESENTATION.sectId).toBe('tianyan');
    expect(TIANYAN_SECT_PRESENTATION.onboarding?.script?.acts).toHaveLength(5);
    expect(TIANYAN_SECT_PRESENTATION.onboarding?.script?.backdrop.src)
      .toBe('/assets/sect/onboarding/tianyan.webp');
    expect(TIANYAN_SECT_PRESENTATION.map?.image)
      .toBe('/assets/sect/tianyan-map.webp');
    expect(TIANYAN_SECT_PRESENTATION.map?.hotspots?.map((spot) => spot.id))
      .toEqual([
        'hall', 'archive', 'cliff', 'arena', 'affairs', 'treasury',
        'industries', 'cultivation', 'alchemy', 'refinery', 'vein',
        'garden', 'gate', 'cave', 'formation',
      ]);
    expect(TIANYAN_SECT_PRESENTATION.map?.hotspots?.find(
      (spot) => spot.id === 'formation',
    )).toMatchObject({ locked: true, facility: 'formation' });
    expect(TIANYAN_ORGANIZATION_THEME.taskPresentation).toMatchObject({
      gate_sweep: { actionLabel: '前往观象阶校正地刻' },
      weekly_tournament: { actionLabel: '参加中宫衍法' },
      elder_trial: { actionLabel: '应对河洛问局' },
    });
    expect(TIANYAN_ORGANIZATION_THEME.opponents).toMatchObject({
      weekly_tournament: { name: '同门推演傀儡' },
      elder_trial: { name: '河洛长老法影' },
    });
  });

  it.each([TIANYAN_HETU_PATH_ID, TIANYAN_LUOSHU_PATH_ID])(
    '%s 状态可通过标准校验并生成唯一衍数资源',
    (pathId) => {
      const sect = tianyanState(pathId);
      expect(() => new SectStateValidator().validate(TIANYAN_MODULE, sect)).not.toThrow();
      const projection = projectSectCombat({ sect, realm: '化神' });
      expect(projection).not.toBeNull();
      expect(projection?.resources).toEqual([
        { id: 'sect.tianyan.derivation', name: '衍数', icon: '✦', initial: 0, max: 3 },
      ]);
      expect(projection?.selectionStrategy).toBeDefined();
    },
  );

  it('六门落印术共享无印与五旧印六分支，并携带元素及灵根失配豁免', () => {
    const sect = tianyanState(TIANYAN_HETU_PATH_ID);
    for (const abilityId of TIANYAN_LANDING_ABILITY_IDS) {
      const config = resolveSectAbility({ sect, realm: '化神', abilityId }).config;
      expect(config.effectLayers?.map((layer) => layer.id)).toEqual([
        'no-seal', 'old-wood', 'old-fire', 'old-earth', 'old-metal', 'old-water',
      ]);
      expect(config.effectPlans).toHaveLength(6);
      expect(config.tags).toContain(
        GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
      );
      expect(
        config.tags?.some((tag) => tag.startsWith(`${GameplayTags.ABILITY.ELEMENT.ROOT}.`)),
      ).toBe(true);
    }
  });

  it('太初玄光是无属性、零耗且不具备落印或灵根失配豁免标签', () => {
    const config = resolveSectAbility({
      sect: tianyanState(), realm: '化神', abilityId: 'primordial-ray',
    }).config;
    expect(config.mpCost).toBe(0);
    expect(config.cooldown).toBe(0);
    expect(config.tags).not.toContain(
      GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
    );
    expect(
      config.tags?.some((tag) => tag.startsWith(`${GameplayTags.ABILITY.ELEMENT.ROOT}.`)),
    ).toBe(false);
  });

  it('灼烧与熔岩来源Buff携带火元素及异灵根失配豁免标签', () => {
    const sect = tianyanState(TIANYAN_HETU_PATH_ID);
    const buffTags = (abilityId: string, layerId: string, buffId: string) => {
      const config = resolveSectAbility({ sect, realm: '化神', abilityId }).config;
      const effect = config.effectLayers
        ?.find((layer) => layer.id === layerId)
        ?.effects.find((entry) =>
          entry.type === 'apply_buff' && entry.params.buffConfig.id === buffId,
        );
      return effect?.type === 'apply_buff' ? effect.params.buffConfig.tags ?? [] : [];
    };

    const burnTags = buffTags(
      'flowing-flame',
      'no-seal',
      'sect.tianyan.burn',
    );
    const lavaTags = buffTags(
      'earth-bearing-seal',
      'old-fire',
      'sect.tianyan.lava',
    );
    for (const tags of [burnTags, lavaTags]) {
      expect(tags).toContain(GameplayTags.ABILITY.ELEMENT.FIRE);
      expect(tags).toContain(
        GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH,
      );
    }
    expect(burnTags).toContain(GameplayTags.BUFF.DOT.BURN);
    expect(lavaTags).not.toContain(GameplayTags.BUFF.DOT.BURN);
  });

  it('基础态可完整解析全部定义能力且只有13门列入玩家列表', () => {
    const resolved = resolveSectAbilities({ sect: tianyanState(), realm: '化神' });
    expect(resolved).toHaveLength(TIANYAN_MODULE.definition.abilities.length - 2);
    expect(resolved.filter((ability) => TIANYAN_VISIBLE_ABILITY_IDS.includes(
      ability.id as (typeof TIANYAN_VISIBLE_ABILITY_IDS)[number],
    ))).toHaveLength(13);
  });

  it('技能详情区分落印术、内景法与天衍秘法', () => {
    const sect = tianyanState(TIANYAN_HETU_PATH_ID);
    const notes = (abilityId: string) =>
      resolveSectAbility({ sect, realm: '化神', abilityId }).notes;

    expect(notes('verdant-pulse')).toContain('落印术·木');
    expect(notes('myriad-wood-renewal')).toContain('内景法·木');
    expect(notes('lotus-in-fire')).toContain('内景法·火');
    expect(notes('boundless-earth')).toContain('内景法·土');
    expect(notes('heavenly-river-cleansing')).toContain('内景法·水');
    expect(notes('shift-palace')).toContain('天衍秘法');
    expect(notes('five-qi-repository')).toContain('天衍秘法');
  });
});
