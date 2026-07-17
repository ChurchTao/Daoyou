import { describe, expect, it } from 'vitest';
import { LINGXIAO_MODULE } from '..';
import {
  productionSectRuntime,
  projectSectCombat,
  resolveSectAbility,
  resolveSectPathPreview,
} from '../..';
import type { CultivatorSectState } from '../../../core';
import { listUnlockedAbilityIds } from '../../../core';

function state(
  pathId?: 'swift-sword' | 'heavy-sword',
  nodes: string[] = [],
): CultivatorSectState {
  return {
    membershipId: 'm1',
    sectId: 'lingxiao',
    status: 'active',
    contribution: 0,
    configVersion: 4,
    activePathId: pathId,
    methods: {
      'lingxiao-canon': 100,
      'sword-guidance': 100,
      'void-step': 100,
      'edge-cleansing': 100,
      'origin-returning': 100,
      'sword-nurturing': 100,
    },
    paths: pathId
      ? [
          {
            pathId,
            unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'],
            tacticId: pathId === 'swift-sword' ? 'aggressive' : 'heavy-break',
            activeMeridianSlot: 1,
            meridianLoadouts: [
              { slot: 1, nodeIds: nodes, version: 1 },
              { slot: 2, nodeIds: [], version: 1 },
              { slot: 3, nodeIds: [], version: 1 },
            ],
          },
        ]
      : [],
    abilityLoadout: [
      'guiding-sword',
      'linked-edge',
      'breaking-edge',
      'sect-ultimate',
    ],
  };
}

function setMethodLevel(sect: CultivatorSectState, level: number): void {
  sect.methods = Object.fromEntries(
    Object.keys(sect.methods).map((methodId) => [methodId, level]),
  );
}

function findObjectById(
  value: unknown,
  id: string,
): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findObjectById(entry, id);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record.id === id) return record;
  for (const child of Object.values(record)) {
    const found = findObjectById(child, id);
    if (found) return found;
  }
  return undefined;
}

describe('宗门注册投影', () => {
  it('九个神通跨境界保持固定蓝耗且基础剑式始终免费', () => {
    const expected = new Map([
      ['plain-sword', 0],
      ['guiding-sword', 30],
      ['linked-edge', 50],
      ['turning-body', 45],
      ['shadow-step', 40],
      ['breaking-edge', 50],
      ['sword-aegis', 45],
      ['nurturing-sword', 50],
      ['sect-ultimate', 75],
    ]);
    for (const realm of ['炼气', '化神', '渡劫'] as const) {
      for (const [abilityId, mpCost] of expected) {
        expect(
          resolveSectAbility({
            sect: state('swift-sword'),
            realm,
            abilityId,
          }).manaCost,
        ).toBe(mpCost);
      }
    }
  });

  it.each([
    [60, 3],
    [120, 4],
    [180, 5],
  ])(
    '可成长BUFF在%i级投影为%i回合，蓄势机制仍固定1回合',
    (level, expectedDuration) => {
      const sect = state('heavy-sword');
      sect.methods = Object.fromEntries(
        Object.keys(sect.methods).map((methodId) => [methodId, level]),
      );
      const shadow = resolveSectAbility({
        sect,
        realm: '化神',
        abilityId: 'shadow-step',
      }).config.effects?.find((effect) => effect.type === 'apply_buff');
      expect(
        shadow?.type === 'apply_buff'
          ? shadow.params.buffConfig.duration
          : undefined,
      ).toBe(expectedDuration);
      const charge = resolveSectAbility({
        sect,
        realm: '化神',
        abilityId: 'turning-body',
      }).config.castEffects?.find((effect) => effect.type === 'apply_buff');
      expect(
        charge?.type === 'apply_buff'
          ? charge.params.buffConfig.duration
          : undefined,
      ).toBe(1);
    },
  );

  it.each([
    [0, 1],
    [1, 1],
    [29, 1],
    [30, 2],
    [60, 3],
    [90, 4],
    [120, 5],
    [150, 6],
    [180, 7],
    [999, 7],
  ])('一剑破妄在%i级驱散%i个正面状态', (level, expectedCount) => {
    for (const pathId of [undefined, 'swift-sword', 'heavy-sword'] as const) {
      const sect = state(pathId);
      sect.methods['edge-cleansing'] = level;
      sect.abilityLoadout = [
        'guiding-sword',
        'linked-edge',
        null,
        'sect-ultimate',
      ];
      const ability = resolveSectAbility({
        sect,
        realm: '化神',
        abilityId: 'breaking-edge',
      });
      const dispel = ability.config.effects?.find(
        (effect) => effect.type === 'dispel',
      );
      expect(
        dispel?.type === 'dispel' ? dispel.params.maxCount : undefined,
      ).toBe(expectedCount);
      expect(ability.detailRows).toContain(
        `命中后：驱散：目标${expectedCount}个正面状态`,
      );
    }
  });

  it('炼气初期心法上限可解锁除绝式外全部基础神通，10级开放剑破万法', () => {
    const early = state();
    early.methods = Object.fromEntries(
      Object.keys(early.methods).map((methodId) => [methodId, 5]),
    );
    expect(
      listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early),
    ).toHaveLength(8);
    expect(
      listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early),
    ).not.toContain('sect-ultimate');
    early.methods['lingxiao-canon'] = 10;
    expect(listUnlockedAbilityIds(LINGXIAO_MODULE.definition, early)).toContain(
      'sect-ultimate',
    );
  });

  it('凌霄两条流派各自保持六层且每层三个节点', () => {
    for (const path of LINGXIAO_MODULE.definition.paths) {
      expect(path.layers).toHaveLength(6);
      expect(path.presentation?.highlights).toHaveLength(3);
      expect(Object.keys(path.presentation?.abilityChanges ?? {})).toHaveLength(
        9,
      );
      for (const layer of path.layers) {
        expect(
          path.nodes.filter((node) => node.layerId === layer.id),
        ).toHaveLength(3);
      }
    }
    const swift = LINGXIAO_MODULE.definition.paths.find(
      (path) => path.id === 'swift-sword',
    )!;
    const heavy = LINGXIAO_MODULE.definition.paths.find(
      (path) => path.id === 'heavy-sword',
    )!;
    expect(swift.name).toBe('疾风骤雨');
    expect(swift.description).toBe(
      '剑随疾风而起，锋如骤雨倾落；一痕未消，一痕又生，于连绵不绝之间决胜。',
    );
    expect(heavy.name).toBe('重剑无锋');
    expect(heavy.description).toBe(
      '重剑无锋，大巧不工；以身承势，以守养锋，待千钧尽聚，一剑自可开山。',
    );
    expect(
      swift.nodes.find((node) => node.id === 'swift-returning-swallow')?.name,
    ).toBe('燕返');
    expect(swift.tactics.find((tactic) => tactic.id === 'counter')?.name).toBe(
      '回燕',
    );
    expect(
      heavy.nodes.find((node) => node.id === 'heavy-heaven-cleaving')?.name,
    ).toBe('开天');
    expect(
      heavy.tactics.find((tactic) => tactic.id === 'heavy-full')?.name,
    ).toBe('极势');
  });

  it('未激活流派使用基础剑势和基础法术', () => {
    const projection = projectSectCombat({ sect: state(), realm: '筑基' })!;
    expect(projection.resources[0]).toMatchObject({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      icon: '🗡️',
      max: 6,
    });
    expect(projection.defaultAttack?.name).toBe('基础剑式');
  });

  it('疾风骤雨通过统一解析器生成变体与节点效果', () => {
    const sect = state('swift-sword', ['swift-opening', 'swift-split-light']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({
      name: '剑势',
      initial: 2,
      max: 6,
    });
    expect(projection.selectionStrategy).toBeDefined();
    const detail = resolveSectAbility({
      sect,
      realm: '化神',
      abilityId: 'linked-edge',
    });
    expect(detail.name).toBe('剑荡山河');
    expect(detail.summary).toBe(
      '剑锋纵横，如长河奔涌；所过之处，山河亦为之震荡。',
    );
    expect(detail.detailRows).toContain('伤害：7段 × 26.25%物攻');
    expect(
      projection.abilities.find(
        (ability) => ability.slug === detail.config.slug,
      ),
    ).toEqual(detail.config);
  });

  it('重剑无锋沿用宗门剑势并生成独立技能变体和策略', () => {
    const sect = state('heavy-sword', ['heavy-opening', 'heavy-triple-ridge']);
    const projection = projectSectCombat({ sect, realm: '化神' })!;
    expect(projection.resources[0]).toMatchObject({
      id: 'sect.lingxiao.sword-momentum',
      name: '剑势',
      initial: 1,
      max: 6,
    });
    expect(projection.selectionStrategy).toBeDefined();
    expect(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'linked-edge' })
        .name,
    ).toBe('剑荡山河');
    expect(
      resolveSectAbility({ sect, realm: '化神', abilityId: 'sect-ultimate' })
        .name,
    ).toBe('剑破万法');
  });

  it('流派基础变体不再随已解锁层数改变倍率', () => {
    for (const pathId of ['swift-sword', 'heavy-sword'] as const) {
      const firstLayer = state(pathId);
      firstLayer.paths[0].unlockedLayerIds = ['1'];
      const allLayers = state(pathId);
      expect(
        productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
          sect: firstLayer,
          realm: '化神',
        }),
      ).toEqual(
        productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
          sect: allLayers,
          realm: '化神',
        }),
      );
    }
  });

  it.each(['swift-sword', 'heavy-sword'] as const)(
    '%s 的729套六层参悟组合全部通过最终编译与能力契约校验',
    (pathId) => {
      const path = LINGXIAO_MODULE.definition.paths.find(
        (entry) => entry.id === pathId,
      )!;
      const layers = [...path.layers].sort((a, b) => a.order - b.order);
      const choices = layers.map((layer) =>
        path.nodes.filter((node) => node.layerId === layer.id),
      );
      let compiledCount = 0;
      const compile = (layerIndex: number, nodeIds: string[]): void => {
        if (layerIndex === choices.length) {
          const compiled = productionSectRuntime.compiler.compile(
            LINGXIAO_MODULE,
            {
              sect: state(pathId, nodeIds),
              realm: '渡劫',
            },
          );
          for (const ability of Object.values(compiled.abilities)) {
            expect(ability.detailRows.join('；')).not.toMatch(
              /sect\.|Status\.|Ability\.|GameplayTag/,
            );
            expect(JSON.stringify(ability.config)).not.toContain(
              '__sectMethodGrowth',
            );
          }
          for (const passive of compiled.passives) {
            expect(JSON.stringify(passive)).not.toContain('__sectMethodGrowth');
          }
          compiledCount += 1;
          return;
        }
        for (const node of choices[layerIndex]) {
          compile(layerIndex + 1, [...nodeIds, node.id]);
        }
      };
      compile(0, []);
      expect(compiledCount).toBe(729);
    },
    30_000,
  );

  it.each([
    [60, 4, 0.0227],
    [120, 5, 0.0253],
    [180, 6, 0.028],
  ])(
    '探虚被动在%i级投影为%i行动、每层%s增伤且不泄漏成长元数据',
    (level, duration, value) => {
      const sect = state('swift-sword', ['swift-probing-edge']);
      setMethodLevel(sect, level);
      const compiled = productionSectRuntime.compiler.compile(LINGXIAO_MODULE, {
        sect,
        realm: '化神',
      });
      const probing = compiled.passives.find((passive) =>
        passive.slug.endsWith('.swift-probing-edge'),
      );
      const swordMark = findObjectById(probing, 'sect.lingxiao.sword-mark');
      expect(swordMark?.duration).toBe(duration);
      expect(JSON.stringify(swordMark?.listeners)).toContain(
        `"value":${value}`,
      );
      expect(JSON.stringify(compiled)).not.toContain('__sectMethodGrowth');
    },
  );

  it('基础与重剑藏锋为自身蓄势，快剑藏锋仍是命中后获得姿态', () => {
    for (const pathId of [undefined, 'heavy-sword'] as const) {
      const ability = resolveSectAbility({
        sect: state(pathId),
        realm: '化神',
        abilityId: 'turning-body',
      });
      expect(ability.config.targetPolicy?.team).toBe('self');
      expect(ability.detailRows).toEqual(
        expect.arrayContaining([
          '施展后：蓄势：下一次自身行动发动《听雷》',
          '后发：必然命中',
          '蓄势：除自身死亡外不可打断',
        ]),
      );
    }

    const swift = resolveSectAbility({
      sect: state('swift-sword'),
      realm: '化神',
      abilityId: 'turning-body',
    });
    expect(swift.config.targetPolicy?.team).toBe('enemy');
    expect(
      swift.detailRows.some((row) => row.startsWith('命中后：状态：')),
    ).toBe(true);
  });

  it.each([
    [1, '60%', '36%'],
    [60, '70%', '42%'],
    [100, '75%', '45%'],
    [120, '80%', '48%'],
    [180, '90%', '54%'],
  ])(
    '%i级节点卡片展示当前实际成长数值',
    (level, returningSwallow, guardedShield) => {
      const swiftSect = state('swift-sword');
      const heavySect = state('heavy-sword');
      setMethodLevel(swiftSect, level);
      setMethodLevel(heavySect, level);
      if (level < 10) {
        swiftSect.abilityLoadout = ['guiding-sword', null, null, null];
        heavySect.abilityLoadout = ['guiding-sword', null, null, null];
      }
      const swiftNodes = resolveSectPathPreview({
        sect: swiftSect,
        realm: '化神',
        pathId: 'swift-sword',
      }).nodes;
      const heavyNodes = resolveSectPathPreview({
        sect: heavySect,
        realm: '化神',
        pathId: 'heavy-sword',
      }).nodes;
      expect(
        swiftNodes.find((node) => node.id === 'swift-returning-swallow')
          ?.description,
      ).toContain(returningSwallow);
      expect(
        heavyNodes.find((node) => node.id === 'heavy-retained-frame')
          ?.description,
      ).toContain(guardedShield);
    },
  );

  it('成长节点卡片复用当前心法实际值而非静态1级数值', () => {
    const sect = state('swift-sword');
    const heavyPath = state('heavy-sword').paths[0];
    sect.paths.push(heavyPath);
    const swiftNodes = resolveSectPathPreview({
      sect,
      realm: '化神',
      pathId: 'swift-sword',
    }).nodes;
    const heavyNodes = resolveSectPathPreview({
      sect,
      realm: '化神',
      pathId: 'heavy-sword',
    }).nodes;
    const descriptions = new Map(
      [...swiftNodes, ...heavyNodes].map((node) => [node.id, node.description]),
    );
    expect(descriptions.get('swift-mountain-breaking')).toContain('15%物攻');
    expect(descriptions.get('swift-sheathing')).toContain('60%物攻');
    expect(descriptions.get('swift-endless-flow')).toContain('40%物攻');
    expect(descriptions.get('swift-unending-wind')).toContain('50%物攻');
    expect(descriptions.get('heavy-heaven-cleaving')).toContain('350%物攻');
    expect(descriptions.get('heavy-immovable-mountain')).toContain('70%物攻');
    expect(descriptions.get('heavy-immovable-mountain')).toContain('45%物攻');
    expect(descriptions.get('heavy-mountain-river-echo')).toContain(
      '5%最大气血',
    );
    expect(descriptions.get('heavy-mountain-river-echo')).toContain('80%物攻');
  });

  it('最终神通事实正确合并节点倍率、门槛与跨神通被动', () => {
    const shadow = resolveSectAbility({
      sect: state('swift-sword', ['swift-shadow-line']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(shadow.cooldown).toBe(5);
    expect(shadow.detailRows).toContain('施放条件：至少6点剑势');
    expect(shadow.detailRows).toContain('暴击：整次施法全部伤害段必定暴击');

    const returningPeak = resolveSectAbility({
      sect: state('heavy-sword', ['heavy-steady-mountain']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(returningPeak.detailRows).toEqual(
      expect.arrayContaining([
        '伤害：基础相当于93.5%物攻，每点剑势增加30.81%物攻',
        '命中后：剑势：返还2点',
        '命中后：护盾：相当于45%物攻',
      ]),
    );

    const returningHeaven = resolveSectAbility({
      sect: state('heavy-sword', [
        'heavy-steady-mountain',
        'heavy-heaven-cleaving',
      ]),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(returningHeaven.detailRows).toContain(
      '6点剑势时总倍率：297.49%物攻',
    );
    expect(returningHeaven.detailRows).not.toContain(
      '6点剑势时总倍率：400%物攻',
    );

    const mountainBreaking = resolveSectAbility({
      sect: state('swift-sword', ['swift-mountain-breaking']),
      realm: '化神',
      abilityId: 'sect-ultimate',
    });
    expect(mountainBreaking.detailRows).toEqual(
      expect.arrayContaining([
        '命中后：状态：消耗全部剑痕',
        '命中后：每层追加：相当于15%物攻',
      ]),
    );

    const passiveFacts = resolveSectAbility({
      sect: state('swift-sword', [
        'swift-life-chasing',
        'swift-still-tide',
        'swift-endless-flow',
      ]),
      realm: '化神',
      abilityId: 'sect-ultimate',
    }).detailRows.join('；');
    expect(passiveFacts).toContain('参悟·追命');
    expect(passiveFacts).toContain('参悟·静潮');
    expect(passiveFacts).toContain('参悟·无间');
  });

  it.each([undefined, 'swift-sword', 'heavy-sword'] as const)(
    '%s 始终使用九个统一神通名称与固定摘要',
    (pathId) => {
      const sect = state(pathId);
      for (const definition of LINGXIAO_MODULE.definition.abilities) {
        const detail = resolveSectAbility({
          sect,
          realm: '化神',
          abilityId: definition.id,
        });
        expect(detail.name).toBe(definition.baseName);
        expect(detail.summary).toBe(definition.description);
      }
    },
  );

  it.each(['swift-sword', 'heavy-sword'] as const)(
    '%s 使用统一的神通姿态与增益名称',
    (pathId) => {
      const sect = state(pathId);
      const expectedBuffNames = {
        'turning-body': '藏锋听雷',
        'shadow-step': '踏雪无痕',
        'sword-aegis': '剑心通明',
        'nurturing-sword': '人剑合一',
      } as const;
      for (const [abilityId, buffName] of Object.entries(expectedBuffNames)) {
        const config = resolveSectAbility({
          sect,
          realm: '化神',
          abilityId,
        }).config;
        const buff = [
          ...(config.effects ?? []),
          ...(config.castEffects ?? []),
        ].find((effect) => effect.type === 'apply_buff');
        expect(
          buff?.type === 'apply_buff' ? buff.params.buffConfig.name : undefined,
        ).toBe(buffName);
      }
    },
  );

  it.each([undefined, 'heavy-sword'] as const)(
    '%s 的藏锋听雷后发攻击统一名为听雷',
    (pathId) => {
      const config = resolveSectAbility({
        sect: state(pathId),
        realm: '化神',
        abilityId: 'turning-body',
      }).config;
      const queued = config.castEffects?.find(
        (effect) => effect.type === 'queue_action',
      );
      expect(
        queued?.type === 'queue_action' ? queued.params.name : undefined,
      ).toBe('听雷');
    },
  );

  it('未习得流派也可预览且不会修改原宗门状态', () => {
    const sect = state();
    const before = structuredClone(sect);
    const preview = resolveSectPathPreview({
      sect,
      realm: '化神',
      pathId: 'swift-sword',
    });

    expect(preview.learned).toBe(false);
    expect(preview.active).toBe(false);
    expect(preview.abilities).toHaveLength(9);
    expect(
      preview.abilities.every((ability) => ability.changeSummary.length > 0),
    ).toBe(true);
    expect(
      preview.abilities.find((ability) => ability.id === 'linked-edge')
        ?.pathBase.detailRows,
    ).toEqual(
      expect.arrayContaining([
        '伤害：5段 × 36.25%物攻',
        '命中后：剑痕：向目标施加1层，持续目标未来4次行动',
      ]),
    );
    expect(sect).toEqual(before);
  });

  it('流派预览区分基础变化与该流派当前参悟方案', () => {
    const sect = state('swift-sword');
    const heavy = state('heavy-sword', ['heavy-crossing-pass']).paths[0];
    sect.paths.push(heavy);
    const preview = resolveSectPathPreview({
      sect,
      realm: '化神',
      pathId: 'heavy-sword',
    });
    const shadow = preview.abilities.find(
      (ability) => ability.id === 'shadow-step',
    )!;

    expect(preview.learned).toBe(true);
    expect(preview.active).toBe(false);
    expect(preview.activeMeridianSlot).toBe(1);
    expect(shadow.baseline.detailRows).not.toContain(
      '施展后：护盾：相当于65%物攻',
    );
    expect(shadow.pathBase.detailRows).toContain('施展后：护盾：相当于65%物攻');
    expect(shadow.pathBase.detailRows).not.toContain(
      '施展后：护盾：相当于97.5%物攻',
    );
    expect(shadow.current?.detailRows).toContain(
      '施展后：护盾：相当于97.5%物攻',
    );
  });

  it('动态详情保留条件、目标、触发次数与统一术语', () => {
    const swift = state('swift-sword');
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'guiding-sword',
      }).detailRows,
    ).toEqual(
      expect.arrayContaining([
        '伤害：相当于97.5%物攻',
        '追击：自身身法高于目标时，追加相当于32.5%物攻',
      ]),
    );
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'turning-body',
      }).detailRows,
    ).toContain(
      '命中后：触发：持续期间首次闪避时，反击造成相当于50%物攻的伤害，并获得1点剑势',
    );
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'shadow-step',
      }).detailRows,
    ).toContain('施展后：触发：持续期间首次闪避时，获得1点剑势');
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'sect-ultimate',
      }).detailRows,
    ).toContain('命中后：消耗全部剑势');
  });

  it('动态详情聚合剑痕并完整描述节点触发效果', () => {
    const swift = state('swift-sword', [
      'swift-retained-force',
      'swift-unending-wind',
    ]);
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'linked-edge',
      }).detailRows,
    ).toContain('命中后：剑痕：向目标施加2层，持续目标未来4次行动');
    const swordMarkRows = resolveSectAbility({
      sect: swift,
      realm: '化神',
      abilityId: 'linked-edge',
    }).detailRows;
    expect(swordMarkRows).toContain('命中后：剑痕：最多3层');
    expect(swordMarkRows).toContain(
      '命中后：每层：受到的直接、反击和追击伤害提高2.4%',
    );
    expect(
      resolveSectAbility({
        sect: swift,
        realm: '化神',
        abilityId: 'turning-body',
      }).detailRows,
    ).toContain(
      '命中后：触发：持续期间首次闪避时，反击造成相当于50%物攻的伤害、获得1点剑势、向目标施加1层剑痕，持续目标未来4次行动，并获得相当于50%物攻的护盾',
    );

    const heavy = state('heavy-sword', ['heavy-immovable-mountain']);
    const armorRendRows = resolveSectAbility({
      sect: heavy,
      realm: '化神',
      abilityId: 'linked-edge',
    }).detailRows;
    expect(armorRendRows).toContain('命中后：裂甲：最多3层');
    expect(armorRendRows).toContain('命中后：每层：物防-3.6%');
    expect(
      resolveSectAbility({
        sect: heavy,
        realm: '化神',
        abilityId: 'sword-aegis',
      }).detailRows,
    ).toContain(
      '施展后：触发：持续期间每回合首次受到直接伤害时，反击造成相当于45%物攻的伤害',
    );
  });

  it('冷却、治疗与小数详情使用统一玩家文案', () => {
    const stacking = state('swift-sword', ['swift-stacking-waves']);
    expect(
      resolveSectAbility({
        sect: stacking,
        realm: '化神',
        abilityId: 'linked-edge',
      }).detailRows,
    ).toContain('命中后：冷却：当前冷却减少1回合');

    const echo = state('heavy-sword', ['heavy-mountain-river-echo']);
    const echoRows = resolveSectAbility({
      sect: echo,
      realm: '化神',
      abilityId: 'sect-ultimate',
    }).detailRows;
    expect(echoRows).toEqual(
      expect.arrayContaining([
        '命中后：恢复：5%自身最大气血',
        '命中后：护盾：相当于80%物攻',
        '参悟·山河回响：每3回合最多触发一次',
      ]),
    );
    expect(echoRows.join('；')).not.toContain('回复气血 目标气血');
  });
});
