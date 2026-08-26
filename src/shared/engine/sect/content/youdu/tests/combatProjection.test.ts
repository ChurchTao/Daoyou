import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import {
  YOUDU_DECREE_PATH_ID,
  YOUDU_MODULE,
  YOUDU_SECT_PRESENTATION,
  YOUDU_SOUL_FIRE,
  YOUDU_TIDE_PATH_ID,
  YOUDU_VISIBLE_ABILITY_IDS,
} from '..';
import {
  PRODUCTION_SECT_IDS,
  projectSectCombat,
  resolveSectAbility,
} from '../..';
import {
  isListedSectAbility,
  sectAbilityMethodId,
  SectStateValidator,
} from '../../../core';
import { YOUDU_ORGANIZATION_THEME } from '../organization';
import { youduState } from './testState';

describe('幽都战斗与展示投影', () => {
  it('进入生产目录并满足六心法、七神通、双道途与36节点契约', () => {
    const definition = YOUDU_MODULE.definition;
    expect(PRODUCTION_SECT_IDS).toContain('youdu');
    expect(definition.methods).toHaveLength(6);
    expect(
      definition.methods.filter((method) => method.isPrimary),
    ).toHaveLength(1);
    expect(
      definition.abilities
        .filter(isListedSectAbility)
        .map((ability) => ability.id),
    ).toEqual(YOUDU_VISIBLE_ABILITY_IDS);
    expect(
      definition.abilities.filter((ability) => ability.kind === 'default'),
    ).toHaveLength(1);
    expect(definition.paths.map((path) => path.id)).toEqual([
      YOUDU_TIDE_PATH_ID,
      YOUDU_DECREE_PATH_ID,
    ]);
    for (const path of definition.paths) {
      expect(path.nodes).toHaveLength(18);
      expect(path.tactics).toHaveLength(3);
      for (const layer of path.layers) {
        expect(
          path.nodes.filter((node) => node.layerId === layer.id),
        ).toHaveLength(3);
      }
    }
    const ids = definition.paths.flatMap((path) =>
      path.nodes.map((node) => node.id),
    );
    expect(new Set(ids).size).toBe(36);
  });

  it('入门状态、五幕演出、地图资源与15个热点完整', () => {
    expect(YOUDU_MODULE.definition.onboarding).toEqual({
      initialContribution: 30,
      initialMethods: {
        'youdu-canon': 5,
        'three-souls-separation': 1,
        'forgetful-river-record': 1,
        'seven-souls-seizure': 1,
        'soul-pinning-ironbook': 1,
        'dead-heart-living-spirit': 1,
      },
      initialAbilityLoadout: ['soul-severing-call', null, null, null],
    });
    expect(YOUDU_SECT_PRESENTATION.onboarding?.script?.acts).toHaveLength(5);
    expect(YOUDU_SECT_PRESENTATION.onboarding?.script?.backdrop.src).toBe(
      '/assets/sect/onboarding/youdu.webp',
    );
    expect(YOUDU_SECT_PRESENTATION.map?.image).toBe(
      '/assets/sect/youdu-map.webp',
    );
    expect(YOUDU_SECT_PRESENTATION.map?.hotspots).toHaveLength(15);
    expect(
      YOUDU_SECT_PRESENTATION.map?.hotspots?.find(
        (spot) => spot.id === 'formation',
      ),
    ).toMatchObject({ locked: true, facility: 'formation' });
    expect(YOUDU_SECT_PRESENTATION.facilityLabels).toMatchObject({
      alchemy: '还魂药庐',
      refinery: '镇铁炉',
    });
  });

  it.each([YOUDU_TIDE_PATH_ID, YOUDU_DECREE_PATH_ID])(
    '%s 可通过标准状态校验并投影唯一魂火资源',
    (pathId) => {
      const state = youduState(pathId);
      expect(() =>
        new SectStateValidator().validate(YOUDU_MODULE, state),
      ).not.toThrow();
      const projection = projectSectCombat({ sect: state, realm: '化神' })!;
      expect(projection.resources).toEqual([
        {
          id: YOUDU_SOUL_FIRE,
          name: '魂火',
          icon: '🔥',
          initial: 0,
          max: 3,
        },
      ]);
      expect(projection.selectionStrategy).toBeDefined();
      expect(projection.abilities.map((ability) => ability.slug)).not.toContain(
        `sect.youdu.${pathId}-runtime`,
      );
    },
  );

  it('魂灯初照将魂火入场值设为1，不改变资源上限', () => {
    const projection = projectSectCombat({
      sect: youduState(YOUDU_TIDE_PATH_ID, ['tide-soul-lantern']),
      realm: '化神',
    })!;

    expect(projection.resources).toContainEqual({
      id: YOUDU_SOUL_FIRE,
      name: '魂火',
      icon: '🔥',
      initial: 1,
      max: 3,
    });
  });

  it('心死神活入宗即解锁、保留来源心法且不携带流派标签', () => {
    const definition = YOUDU_MODULE.definition.abilities.find(
      (ability) => ability.id === YOUDU_MODULE.definition.foundationPassiveId,
    )!;
    expect(YOUDU_MODULE.definition.foundationPassiveId).toBe('youdu-runtime');
    expect(definition.unlock).toEqual({ type: 'always' });
    expect(sectAbilityMethodId(definition)).toBe('dead-heart-living-spirit');

    for (const pathId of [YOUDU_TIDE_PATH_ID, YOUDU_DECREE_PATH_ID]) {
      const sect = youduState(pathId);
      sect.methods['dead-heart-living-spirit'] = 0;
      const detail = resolveSectAbility({
        sect,
        realm: '化神',
        abilityId: 'youdu-runtime',
      });
      expect(detail.unlocked).toBe(true);
      expect(detail.config.tags).not.toContain(
        GameplayTags.ABILITY.SECT.path('youdu', pathId),
      );
      const projection = projectSectCombat({ sect, realm: '化神' })!;
      expect(
        projection.abilities.filter(
          (ability) => ability.slug === 'sect.youdu.youdu-runtime',
        ),
      ).toHaveLength(1);
    }
  });

  it('七门神通的消耗、冷却、终结条件与照影命中策略符合设计', () => {
    const state = youduState();
    const expected = {
      'one-sigh': [0, 0],
      'soul-severing-call': [80, 1],
      'reveal-shadow': [140, 4],
      'forgetful-river-tide': [160, 3],
      'seize-soul': [140, 2],
      'pin-soul': [180, 4],
      'soul-shall-not-return': [200, 5],
    } as const;
    for (const [abilityId, [mpCost, cooldown]] of Object.entries(expected)) {
      const config = resolveSectAbility({
        sect: state,
        realm: '化神',
        abilityId,
      }).config;
      expect(config.mpCost ?? 0).toBe(mpCost);
      expect(config.cooldown ?? 0).toBe(cooldown);
    }
    const shadow = resolveSectAbility({
      sect: state,
      realm: '化神',
      abilityId: 'reveal-shadow',
    }).config;
    expect(shadow.hitPolicy).toBe('guaranteed');
    const finish = resolveSectAbility({
      sect: state,
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    }).config;
    expect(finish.castConditions).toContainEqual(
      expect.objectContaining({
        type: 'buff_layer_at_least',
        params: expect.objectContaining({ value: 4 }),
      }),
    );
    expect(finish.tags).toContain(GameplayTags.ABILITY.CHANNEL.TRUE);
    const sever = resolveSectAbility({
      sect: state,
      realm: '化神',
      abilityId: 'soul-severing-call',
    }).config;
    const severLow = sever.effectLayers
      ?.find((layer) => layer.id === 'sever-low')
      ?.effects?.find((effect) => effect.type === 'damage');
    expect(severLow?.type === 'damage' && severLow.params.value.coefficient)
      .toBeCloseTo(0.6024);
  });

  it('分层技能与节点强化详情只展示玩家语义和最终数值', () => {
    const decree = youduState(YOUDU_DECREE_PATH_ID, [
      'decree-iron-enters-shadow',
      'decree-bright-prison-fire',
      'decree-three-souls-leave',
      'decree-iron-law',
    ]);
    const sever = resolveSectAbility({
      sect: decree,
      realm: '化神',
      abilityId: 'soul-severing-call',
    }).detailRows.join('；');
    const seize = resolveSectAbility({
      sect: decree,
      realm: '化神',
      abilityId: 'seize-soul',
    }).detailRows.join('；');
    const pin = resolveSectAbility({
      sect: decree,
      realm: '化神',
      abilityId: 'pin-soul',
    }).detailRows.join('；');
    const heart = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-guard-the-spirit']),
      realm: '化神',
      abilityId: 'youdu-runtime',
    }).detailRows.join('；');
    const slowPin = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-four-gates-closed']),
      realm: '化神',
      abilityId: 'pin-soul',
    }).detailRows.join('；');

    expect(sever).toContain('施法前至少3层蚀魂时魂伤提高70%');
    expect(sever).toContain('命中后增加2层蚀魂');
    expect(sever).toContain('本次魂伤提高35%');
    expect(sever).toContain('拥有3点魂火时');
    expect(seize).toContain('术伤与魂伤各0.24 × 法术攻击');
    expect(pin).toContain('命中后增加2层蚀魂');
    expect(pin).toContain('本次控制命中提高15%');
    expect(pin).toContain('受到的气血治疗降低100%');
    expect(slowPin).toContain('目标速度降低20%');
    expect(heart).toContain('控制抗性 +40%');
    expect([sever, seize, pin].join('；')).not.toMatch(
      /佛相|sever-high|sever-low|pin-high|pin-low/,
    );
  });

  it('终结与忘川详情完整展示节点条件，且不生成无条件或重复事实', () => {
    const finish = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, [
        'decree-one-name-one-judgment',
        'decree-name-in-youdu',
      ]),
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    }).detailRows.join('；');
    const forget = resolveSectAbility({
      sect: youduState(YOUDU_TIDE_PATH_ID, [
        'tide-black-water',
        'tide-no-return-current',
      ]),
      realm: '化神',
      abilityId: 'forgetful-river-tide',
    }).detailRows.join('；');

    expect(finish).toContain('目标至少4层蚀魂');
    expect(finish).toContain('受到的气血治疗降低80%');
    expect(finish).toContain('速度降低30%');
    expect(finish).toContain(
      '目标每场首次进入4层时获得标记；下一次终结命中后返还60点已支付法力并消耗标记',
    );
    expect(finish).toContain('目标气血低于35%');
    expect(finish).toContain('每场一次');
    expect(finish).not.toContain('伤害：相当于70%法攻');
    expect(finish).not.toContain('施展后：魂火：获得3点');
    expect(forget).toContain('忘川期间速度降低8%');
    expect(forget).toContain('至少4层蚀魂时持续魂伤总计提高45%');
  });

  it('司命判词独立开放三层终结计划', () => {
    const verdict = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-verdict']),
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    }).config;
    const ordinary = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-seven-inch-severance']),
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    }).config;

    expect(verdict.castConditions).toContainEqual(expect.objectContaining({
      type: 'buff_layer_at_least',
      params: expect.objectContaining({ value: 3 }),
    }));
    expect(verdict.effectPlans?.map((plan) => plan.id)).toContain('finish-three');
    expect(ordinary.effectPlans?.map((plan) => plan.id)).not.toContain('finish-three');
  });

  it('重平节点投影出攻击、控制与续火的最终数值', () => {
    const seize = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-first-soul-taken']),
      realm: '化神',
      abilityId: 'seize-soul',
    });
    const pin = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID, ['decree-four-gates-closed']),
      realm: '化神',
      abilityId: 'pin-soul',
    });
    const shoreless = resolveSectAbility({
      sect: youduState(YOUDU_TIDE_PATH_ID, ['tide-shoreless']),
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    });

    expect(seize.detailRows.join('；')).toContain('攻击降低25%，持续3回合');
    expect(pin.detailRows.join('；')).toContain('追加0.20 × 法术攻击（魂伤）');
    expect(shoreless.detailRows.join('；')).toContain('命中后额外获得1点魂火');
  });

  it('新三行动名义伤害预算与旧基准偏差不超过5%', () => {
    const state = youduState();
    const coefficientOf = (abilityId: string, layerId?: string) => {
      const ability = resolveSectAbility({
        sect: state,
        realm: '化神',
        abilityId,
      }).config;
      const effects = layerId
        ? ability.effectLayers?.find((layer) => layer.id === layerId)?.effects
        : ability.effects;
      return effects
        ?.filter((effect) => effect.type === 'damage')
        .reduce((sum, effect) => sum + (
          effect.type === 'damage' ? effect.params.value.coefficient ?? 0 : 0
        ), 0) ?? 0;
    };
    const nominal = coefficientOf('soul-severing-call', 'sever-low')
      + coefficientOf('seize-soul')
      + coefficientOf('soul-shall-not-return', 'finish-four');

    expect(nominal).toBeCloseTo(2.5099);
    expect(Math.abs(nominal - 2.54) / 2.54).toBeLessThanOrEqual(0.05);
  });

  it('蚀魂详情展示完整五层曲线、逐层驱散且不出现零值占位', () => {
    const sigh = resolveSectAbility({
      sect: youduState(),
      realm: '化神',
      abilityId: 'one-sigh',
    }).detailRows.join('；');

    expect(sigh).toContain(
      '气血上限、物攻、法攻、物防、法防：1层-3%，2层-5%，3层-8%，4～5层-12%',
    );
    expect(sigh).toContain(
      '受治疗削弱：1层0%，2层15%，3层30%，4层50%，5层100%',
    );
    expect(sigh).toContain('普通驱散每次只移除1层');
    expect(sigh).not.toContain('+0');
  });

  it('照影分别说明通用承伤与敕魂魂伤增幅，不合并成错误倍率', () => {
    const shadow = resolveSectAbility({
      sect: youduState(YOUDU_DECREE_PATH_ID),
      realm: '化神',
      abilityId: 'reveal-shadow',
    }).detailRows.join('；');

    expect(shadow).toContain('所有伤害提高2%');
    expect(shadow).toContain('自身魂伤额外提高1%');
    expect(shadow).not.toContain('受到伤害提高3%');
  });

  it('手写详情完整列出幽都运行时与五层节点效果', () => {
    const decree = youduState(YOUDU_DECREE_PATH_ID, [
      'decree-punishment-measured',
      'decree-five-souls-scattered',
    ]);
    const tideRuntime = resolveSectAbility({
      sect: youduState(YOUDU_TIDE_PATH_ID),
      realm: '化神',
      abilityId: 'youdu-runtime',
    }).detailRows.join('；');
    const tideSigh = [
      'tide-cleanse-toll',
      'tide-hundred-ghosts',
      'tide-dream-invasion',
      'tide-last-ferry',
    ]
      .flatMap(
        (nodeId) =>
          resolveSectAbility({
            sect: youduState(YOUDU_TIDE_PATH_ID, [nodeId]),
            realm: '化神',
            abilityId: 'one-sigh',
          }).detailRows,
      )
      .join('；');
    const decreeRuntime = resolveSectAbility({
      sect: decree,
      realm: '化神',
      abilityId: 'youdu-runtime',
    }).detailRows.join('；');

    expect(tideRuntime).toContain('每回合首次忘川有效伤害获得1点魂火');
    expect(tideSigh).toContain('驱散蚀魂后受到0.12 × 法术攻击魂伤，自身获得1点魂火');
    expect(tideSigh).toContain('目标进入5层时追加0.30 × 法术攻击魂伤');
    expect(tideSigh).toContain('目标进入5层时刷新忘川');
    expect(tideSigh).toContain('带有忘川的目标进入5层时失去10%最大法力');
    expect(decreeRuntime).toContain('3层及以上时，自身直接魂伤提高10%');
    expect(decreeRuntime).toContain('失魂被抵抗或控制免疫阻止时，目标攻击与速度降低20%');
    expect(decreeRuntime).toContain('失魂结束或被主动解除时，目标攻击降低15%');
  });

  it('运行时 listener ID 唯一，共享触发次数只通过预算组表达', () => {
    const projection = projectSectCombat({
      sect: youduState(YOUDU_DECREE_PATH_ID),
      realm: '化神',
    })!;
    const listeners = projection.abilities.flatMap(
      (ability) => ability.listeners ?? [],
    );
    const ids = listeners.map((listener) => listener.id).filter(Boolean);

    expect(new Set(ids).size).toBe(ids.length);
    expect(
      listeners.filter(
        (listener) =>
          listener.triggerPolicy?.group === 'sect.youdu.decree-control-response-fire',
      ),
    ).toHaveLength(4);
  });

  it('组织主题只覆盖非任务展示内容', () => {
    expect(YOUDU_ORGANIZATION_THEME).not.toHaveProperty('taskPresentation');
    expect(YOUDU_ORGANIZATION_THEME).not.toHaveProperty('opponents');
    expect(YOUDU_ORGANIZATION_THEME.facilityNames).toMatchObject({
      archive: '三魂阁',
      cultivation_room: '返照室',
      workshop: '镇铁炉',
      spirit_vein: '黑水阴脉',
      herb_garden: '返照香圃',
    });
  });
});
