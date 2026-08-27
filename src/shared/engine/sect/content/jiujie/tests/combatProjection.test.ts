import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { describe, expect, it } from 'vitest';
import { JIUJIE_BASE_DEFINITION } from '../definition';
import { JIUJIE_CALAMITY, JIUJIE_CONDEMNATION_PATH_ID, JIUJIE_EYE_PATH_ID, JIUJIE_THUNDER, JIUJIE_DEBT } from '../ids';
import { JIUJIE_MODULE } from '../JiujieSectModule';
import { JIUJIE_CONDEMNATION_NODES } from '../paths/condemnation/nodes';
import { JIUJIE_EYE_NODES } from '../paths/eye/nodes';
import { JIUJIE_SECT_PRESENTATION } from '../presentation';
import { JiujieCondemnationBuildFacade, JiujieEyeBuildFacade, createJiujieBuildSettings } from '../shared/buildFacade';
import { projectSectCombat, productionSectRuntime, PRODUCTION_SECT_IDS, resolveSectAbility } from '../..';
import type { CultivatorSectState } from '../../../core';

function state(pathId: string, nodeIds: string[] = []): CultivatorSectState {
  return {
    membershipId: 'jiujie-test-membership', sectId: 'jiujie', status: 'active', contribution: 0, configVersion: 1,
    activePathId: pathId,
    methods: { 'jiujie-canon': 10, 'calamity-eye': 5, 'heavenly-record': 5, 'thunder-prison': 5, 'cause-judgment': 5, 'crossing-calamity': 5 },
    paths: [{ pathId, unlockedLayerIds: ['1', '2', '3', '4', '5', 'ultimate'], tacticId: pathId === JIUJIE_EYE_PATH_ID ? 'bear-and-return' : 'record-and-judge', activeMeridianSlot: 1, meridianLoadouts: [{ slot: 1, nodeIds, version: 1 }, { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 }] }],
    abilityLoadout: ['heaven-hearing', 'calamity-seal', 'receive-calamity', 'nine-sky-settlement'],
  };
}

describe('九劫天宫宗门投影', () => {
  const expectedEyeNodes = [
    ['eye-open', '开门迎劫'], ['eye-bear', '承灾留名'], ['eye-first-light', '雷光护心'],
    ['eye-record', '血甲同书'], ['eye-question', '问劫寻隙'], ['eye-return', '借劫续门'],
    ['eye-guard', '不退天门'], ['eye-deep-return', '劫威反震'], ['eye-still', '静候雷来'],
    ['eye-long-gaze', '众劫归一'], ['eye-heavy-thunder', '雷狱追身'], ['eye-shelter', '劫甲回生'],
    ['eye-true-record', '真劫入簿'], ['eye-returning-law', '劫尽身还'], ['eye-after-rain', '清算留门'],
    ['eye-nine-gates', '九门归劫'], ['eye-heavenly-shield', '身为天门'], ['eye-calamity-without-end', '劫后再开'],
  ] as const;
  const expectedCondemnationNodes = [
    ['condemnation-record', '天听记名'], ['condemnation-question', '问行取证'], ['condemnation-first-crime', '初罪立案'],
    ['condemnation-repeat', '伤罪加刑'], ['condemnation-heavy-debt', '援罪断供'], ['condemnation-long-record', '禁罪反照'],
    ['condemnation-no-pardon', '易罪不赦'], ['condemnation-debt-book', '定罪成册'], ['condemnation-heaven-hearing', '庶行有录'],
    ['condemnation-heavy-statute', '重法催审'], ['condemnation-quick-record', '疾书追罪'], ['condemnation-three-questions', '三问成案'],
    ['condemnation-reoffend', '再犯从重'], ['condemnation-clear-book', '清册留案'], ['condemnation-no-escape', '两避成罪'],
    ['condemnation-final-verdict', '三债终审'], ['condemnation-nine-crimes', '九罪同科'], ['condemnation-heavenly-punishment', '天谴不绝'],
  ] as const;

  it('注册六本心法、两道途与每道途18个节点', () => {
    expect(PRODUCTION_SECT_IDS).toContain('jiujie');
    expect(JIUJIE_BASE_DEFINITION.methods).toHaveLength(6);
    expect(JIUJIE_MODULE.definition.paths).toHaveLength(2);
    for (const path of JIUJIE_MODULE.definition.paths) {
      expect(path.nodes).toHaveLength(18);
      expect(new Set(path.nodes.map((node) => node.id)).size).toBe(18);
    }
  });

  it('保留36个稳定节点ID并投影裁定后的节点名称', () => {
    expect(JIUJIE_EYE_NODES.map((item) => [item.definition.id, item.definition.name])).toEqual(expectedEyeNodes);
    expect(JIUJIE_CONDEMNATION_NODES.map((item) => [item.definition.id, item.definition.name])).toEqual(expectedCondemnationNodes);
  });

  it('五本心法投影到现有面板基础数值，主心法不提供面板加成', () => {
    expect(JIUJIE_BASE_DEFINITION.methods.map((method) => method.growthProfile.panelModifier)).toEqual([
      undefined,
      { attrType: 'maxHp', type: 'add', maxValue: 0.12 },
      { attrType: 'magicAtk', type: 'add', maxValue: 0.15 },
      { attrType: 'magicPenetration', type: 'fixed', maxValue: 0.08 },
      { attrType: 'maxMp', type: 'add', maxValue: 0.18 },
      { attrType: 'magicDef', type: 'add', maxValue: 0.14 },
    ]);
  });

  it('天谴录与雷狱镇魂采用前期更平滑的成长曲线', () => {
    const methods = Object.fromEntries(JIUJIE_BASE_DEFINITION.methods.map((method) => [
      method.id,
      method.growthProfile.curve,
    ]));
    expect(methods['heavenly-record']).toBe('early');
    expect(methods['thunder-prison']).toBe('balanced');
  });

  it('构筑门面以语义特性记录节点能力', () => {
    const eyeSettings = createJiujieBuildSettings(JIUJIE_EYE_PATH_ID);
    const eye = new JiujieEyeBuildFacade(eyeSettings);
    eye.enable('openingShield');
    eye.enable('memoryHeal');
    expect(eyeSettings.eye.openingShield).toBe(true);
    expect(eyeSettings.eye.memoryHeal).toBe(true);

    const condemnationSettings = createJiujieBuildSettings(JIUJIE_CONDEMNATION_PATH_ID);
    const condemnation = new JiujieCondemnationBuildFacade(condemnationSettings);
    condemnation.enable('lockCrime');
    condemnation.enable('crimeVerdict');
    expect(condemnationSettings.condemnation.lockCrime).toBe(true);
    expect(condemnationSettings.condemnation.crimeVerdict).toBe(true);
  });

  it('关键节点修改与节点描述一致的编译字段', () => {
    const eyeState = state(JIUJIE_EYE_PATH_ID, ['eye-open']);
    const receive = resolveSectAbility({ sect: eyeState, realm: '化神', abilityId: 'receive-calamity' }).config;
    const receiveBuff = receive.effects?.find((effect) => effect.type === 'apply_buff');
    expect(receiveBuff).toMatchObject({ params: { buffConfig: { duration: 2 } } });
    expect(receive.effects).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'shield' }),
      expect.objectContaining({ type: 'apply_buff' }),
    ]));

    const condemnationState = state(JIUJIE_CONDEMNATION_PATH_ID, ['condemnation-first-crime']);
    const runtime = resolveSectAbility({ sect: condemnationState, realm: '化神', abilityId: 'jiujie-law-runtime' }).config;
    const activeTrigger = runtime.listeners?.find((listener) => listener.id === 'jiujie.law.active-trigger');
    const baselineRuntime = resolveSectAbility({ sect: state(JIUJIE_CONDEMNATION_PATH_ID), realm: '化神', abilityId: 'jiujie-law-runtime' }).config;
    const baselineTrigger = baselineRuntime.listeners?.find((listener) => listener.id === 'jiujie.law.active-trigger');
    expect(activeTrigger).not.toEqual(baselineTrigger);
    expect(JSON.stringify(activeTrigger)).toContain('first-crime-ready');
  });

  it('问行取证在已有主罪时追加0.15倍法攻雷伤', () => {
    const question = resolveSectAbility({
      sect: state(JIUJIE_CONDEMNATION_PATH_ID, ['condemnation-question']),
      realm: '筑基',
      abilityId: 'thunder-prison-question',
    }).config;
    const damageEffects = question.effects?.filter((effect) => effect.type === 'damage') ?? [];
    const evidence = damageEffects.find((effect) =>
      effect.type === 'damage' && effect.params.damageSource === 'follow_up');
    expect(evidence?.type === 'damage' && evidence.params.value.coefficient).toBeCloseTo(0.15, 2);
    expect(evidence?.conditions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'has_tag' }),
    ]));
  });

  it('承灾留名使首次受击反击额外增加0.15倍法攻', () => {
    const counterCoefficients = (nodeIds: string[]) => {
      const receive = resolveSectAbility({
        sect: state(JIUJIE_EYE_PATH_ID, nodeIds), realm: '筑基', abilityId: 'receive-calamity',
      }).config;
      const eye = receive.effects?.find((effect) =>
        effect.type === 'apply_buff' && effect.params.buffConfig.id === 'sect.jiujie.eye');
      const firstHit = eye?.type === 'apply_buff'
        ? eye.params.buffConfig.listeners?.find((listener) => listener.id === 'jiujie.eye.mark-attacker')
        : undefined;
      return firstHit?.effects
        .filter((effect) => effect.type === 'damage')
        .map((effect) => effect.type === 'damage' ? effect.params.value.coefficient : undefined);
    };

    expect(counterCoefficients([])).toHaveLength(1);
    const enhanced = counterCoefficients(['eye-bear']) ?? [];
    expect(enhanced).toHaveLength(2);
    for (const coefficient of enhanced) expect(coefficient).toBeCloseTo(0.15, 2);
  });

  it.each([
    [JIUJIE_EYE_PATH_ID, JIUJIE_EYE_NODES],
    [JIUJIE_CONDEMNATION_PATH_ID, JIUJIE_CONDEMNATION_NODES],
  ] as const)('%s 的18个节点均会改变共通底板且不更换技能或资源ID', (pathId, nodes) => {
    const behaviorOnly = (abilities: Record<string, { description?: string }>) =>
      Object.fromEntries(Object.entries(abilities).map(([id, config]) => [
        id,
        { ...config, description: undefined },
      ]));
    const baseline = productionSectRuntime.compiler.compile(JIUJIE_MODULE, {
      sect: state(pathId),
      realm: '化神',
    });
    for (const node of nodes) {
      const compiled = productionSectRuntime.compiler.compile(JIUJIE_MODULE, {
        sect: state(pathId, [node.definition.id]),
        realm: '化神',
      });
      expect(compiled, node.definition.id).not.toEqual(baseline);
      expect(behaviorOnly(compiled.abilities), node.definition.id).not.toEqual(behaviorOnly(baseline.abilities));
      expect(Object.keys(compiled.abilities), node.definition.id).toEqual(Object.keys(baseline.abilities));
      expect(compiled.resources.map((resource) => resource.id), node.definition.id).toEqual(baseline.resources.map((resource) => resource.id));
      expect(JSON.stringify(compiled.abilities), node.definition.id).toContain(`参悟·${node.definition.name}`);
    }
  });

  it.each([JIUJIE_EYE_PATH_ID, JIUJIE_CONDEMNATION_PATH_ID])('以共通资源和共通技能底板编译 %s', (pathId) => {
    const projection = projectSectCombat({ sect: state(pathId), realm: '化神' })!;
    expect(projection.resources).toEqual([{ id: JIUJIE_CALAMITY, name: '劫数', icon: '⚡', initial: 0, max: 3 }]);
    expect(projection.defaultAttack?.tags).toContain(GameplayTags.ABILITY.KIND.BASIC);
    expect(projection.abilities.map((ability) => ability.slug)).toEqual(expect.arrayContaining([
      'sect.jiujie.heaven-hearing', 'sect.jiujie.calamity-seal', 'sect.jiujie.jiujie-tianwei-runtime',
    ]));
  });

  it('天威裁决只匹配法术或负面技能，劫雷和劫债独立使用protected规则', () => {
    const passive = resolveSectAbility({ sect: state(JIUJIE_EYE_PATH_ID), realm: '化神', abilityId: 'jiujie-tianwei-runtime' });
    expect(passive.config.listeners).toHaveLength(1);
    expect(passive.config.listeners?.[0]).toMatchObject({
      eventType: GameplayTags.EVENT.SKILL_PRE_CAST,
      conditions: expect.arrayContaining([
        { type: 'ability_has_not_tag', params: { tag: GameplayTags.ABILITY.KIND.BASIC } },
        { type: 'ability_has_any_tag', params: { tags: [GameplayTags.ABILITY.CHANNEL.MAGIC, GameplayTags.ABILITY.FUNCTION.DEBUFF] } },
        { type: 'chance', params: { value: 0.20 } },
      ]),
      effects: [{ type: 'skill_immunity', params: { reason: '天威裁决' } }],
    });
    const hearing = resolveSectAbility({ sect: state(JIUJIE_EYE_PATH_ID), realm: '化神', abilityId: 'heaven-hearing' });
    const thunderConfig = hearing.config.effects?.find((effect) => effect.type === 'apply_buff');
    expect(thunderConfig).toMatchObject({ params: { buffConfig: { id: JIUJIE_THUNDER, dispelPolicy: 'protected', duration: 3 } } });
    expect(JIUJIE_DEBT).toBe('sect.jiujie.debt');
  });

  it('前期共享神通具有足够的直接伤害系数', () => {
    const coefficientOf = (abilityId: string) => {
      const ability = resolveSectAbility({
        sect: state(JIUJIE_EYE_PATH_ID),
        realm: '筑基',
        abilityId,
      });
      const directDamage = ability.config.effects?.find((effect) =>
        effect.type === 'damage' && effect.params.damageSource === 'direct');
      return directDamage?.type === 'damage'
        ? directDamage.params.value.coefficient
        : undefined;
    };

    const growthScalar = (coefficientOf('thunder-finger') ?? 0) / 0.8;
    expect(coefficientOf('heaven-hearing')).toBeCloseTo(0.55 * growthScalar);
    expect(coefficientOf('calamity-seal')).toBeCloseTo(0.25 * growthScalar);
    expect(coefficientOf('thunder-prison-question')).toBeCloseTo(0.65 * growthScalar);
  });

  it('承劫记忆只投影到劫眼道途', () => {
    const listenerIds = (pathId: string | undefined) => {
      const sect = state(pathId ?? JIUJIE_EYE_PATH_ID);
      sect.activePathId = pathId;
      const receive = resolveSectAbility({ sect, realm: '化神', abilityId: 'receive-calamity' }).config;
      const buff = receive.effects?.find((effect) => effect.type === 'apply_buff');
      if (!buff || buff.type !== 'apply_buff') return [];
      return buff.params.buffConfig.listeners?.map((listener) => listener.id) ?? [];
    };
    expect(listenerIds(JIUJIE_EYE_PATH_ID)).toContain('jiujie.eye.remember');
    expect(listenerIds(JIUJIE_CONDEMNATION_PATH_ID)).not.toContain('jiujie.eye.remember');
    expect(listenerIds(undefined)).not.toContain('jiujie.eye.remember');
    const condemnationReceive = resolveSectAbility({
      sect: state(JIUJIE_CONDEMNATION_PATH_ID),
      realm: '化神',
      abilityId: 'receive-calamity',
    });
    expect(condemnationReceive.detailRows.join('')).not.toContain('承劫量');
  });

  it('地图素材与节点主题已挂载', () => {
    expect(JIUJIE_SECT_PRESENTATION.map?.image).toBe('/assets/sect/jiujie-map.webp');
    expect(JIUJIE_SECT_PRESENTATION.map?.aspectRatio).toBe(1.5);
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots).toHaveLength(16);
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots?.map((spot) => spot.label)).toEqual(expect.arrayContaining(['劫眼峰', '天谴司']));
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots?.find((spot) => spot.id === 'formation')).toMatchObject({ locked: true });
    expect(JIUJIE_SECT_PRESENTATION.facilityLabels).toMatchObject({
      alchemy: '听雷丹房',
      herb_garden: '天听木圃',
      formation: '渡厄天梯',
    });
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots?.find((spot) => spot.id === 'alchemy')?.label).toBe('听雷丹房');
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots?.find((spot) => spot.id === 'alchemy')?.facility).toBe('workshop');
    expect(JIUJIE_SECT_PRESENTATION.map?.hotspots?.find((spot) => spot.id === 'refinery')?.facility).toBe('workshop');
  });

  it('入门演出使用独立的天宫叙事素材，并完整呈现两道途', () => {
    const onboarding = JIUJIE_SECT_PRESENTATION.onboarding;
    expect(onboarding?.script.backdrop.src).toBe('/assets/sect/onboarding/jiujie.webp');
    expect(onboarding?.script.acts.map((act) => act.id)).toEqual([
      'ascend-heaven-stair',
      'thunder-pool-verdict',
      'calamity-eye',
      'heavenly-condemnation',
      'nine-gates-entry',
    ]);
    expect(onboarding?.script.acts.every((act) => act.backgroundPosition)).toBe(true);
  });
});
