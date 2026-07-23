import { describe, expect, it } from 'vitest';
import { projectSectCombat, resolveSectAbilities, resolveSectAbility } from '../..';
import { YOUDU_DECREE_PATH_ID, YOUDU_MODULE, YOUDU_TIDE_PATH_ID } from '..';
import { youduState, type YouduPathId } from './testState';

function runtimeFingerprint(pathId: YouduPathId, nodes: string[]): string {
  const projection = projectSectCombat({
    sect: youduState(pathId, nodes),
    realm: '化神',
  })!;
  const abilities = resolveSectAbilities({
    sect: youduState(pathId, nodes),
    realm: '化神',
  });
  return JSON.stringify({
    defaultAttack: projection.defaultAttack,
    abilities: projection.abilities,
    resources: projection.resources,
    resolvedAbilities: abilities.map((ability) => ability.config),
  });
}

describe('幽都36参悟节点编译矩阵', () => {
  const finisherCoefficients = (pathId?: YouduPathId, nodes: string[] = []) => {
    const config = resolveSectAbility({
      sect: youduState(pathId, nodes),
      realm: '化神',
      abilityId: 'soul-shall-not-return',
    }).config;
    const coefficient = (layerId: string) => {
      const damage = config.effectLayers
        ?.find((layer) => layer.id === layerId)
        ?.effects?.find((effect) => effect.type === 'damage');
      if (damage?.type !== 'damage') {
        throw new Error(`幽都终结伤害层 ${layerId} 缺失`);
      }
      return damage.params.value.coefficient ?? 0;
    };
    if (!config.effectPlans?.some((plan) => plan.id === 'finish-five')) {
      throw new Error('幽都终结伤害配置缺失');
    }
    return {
      four: coefficient('finish-four'),
      five: coefficient('finish-five'),
    };
  };

  it.each(YOUDU_MODULE.definition.paths.flatMap((path) =>
    path.nodes.map((node) => ({ pathId: path.id as YouduPathId, nodeId: node.id }))))(
    '$pathId/$nodeId 对最终战斗投影产生可观察变化',
    ({ pathId, nodeId }) => {
      expect(runtimeFingerprint(pathId, [nodeId]))
        .not.toBe(runtimeFingerprint(pathId, []));
    },
  );

  it('招魂渡夜代表完整方案同时落实忘川、蚀魂曲线与终结倍率', () => {
    const nodes = [
      'tide-first-ripple',
      'tide-never-ebbs',
      'tide-three-souls-far',
      'tide-no-return-current',
      'tide-hundred-ghosts',
      'tide-lament-deepens',
    ];
    const state = youduState(YOUDU_TIDE_PATH_ID, nodes);
    const forget = resolveSectAbility({
      sect: state, realm: '化神', abilityId: 'forgetful-river-tide',
    }).config;
    const direct = forget.effects?.find((effect) => effect.type === 'damage');
    expect(direct?.type === 'damage' && direct.params.value.coefficient)
      .toBeCloseTo(0.184);
    const forgetBuff = forget.completionEffects?.find((effect) =>
      effect.type === 'apply_buff' && effect.params.buffConfig.id === 'sect.youdu.forgetful-river');
    expect(forgetBuff?.type === 'apply_buff' && forgetBuff.params.buffConfig.duration).toBe(3);

    const finish = resolveSectAbility({
      sect: state, realm: '化神', abilityId: 'soul-shall-not-return',
    }).config;
    const finishFour = finish.effectLayers?.find((layer) => layer.id === 'finish-four')
      ?.effects?.find((effect) => effect.type === 'damage');
    const finishFive = finish.effectLayers?.find((layer) => layer.id === 'finish-five')
      ?.effects?.find((effect) => effect.type === 'damage');
    expect(finishFour?.type === 'damage' && finishFour.params.value.coefficient)
      .toBe(1.66);
    expect(finishFive?.type === 'damage' && finishFive.params.value.coefficient)
      .toBe(1.9);
  });

  it('镇魄司命代表完整方案落实混合增伤、法力、抗性、控制与终结强化', () => {
    const nodes = [
      'decree-iron-enters-shadow',
      'decree-silent-nail',
      'decree-three-souls-leave',
      'decree-iron-law',
      'decree-five-souls-scattered',
      'decree-verdict',
    ];
    const state = youduState(YOUDU_DECREE_PATH_ID, nodes);
    const seize = resolveSectAbility({
      sect: state, realm: '化神', abilityId: 'seize-soul',
    }).config;
    const coefficients = seize.effects
      ?.filter((effect) => effect.type === 'damage')
      .map((effect) => effect.type === 'damage' ? effect.params.value.coefficient : undefined);
    expect(coefficients).toEqual([0.22, 0.22]);

    const pin = resolveSectAbility({
      sect: state, realm: '化神', abilityId: 'pin-soul',
    }).config;
    expect(pin.mpCost).toBe(45);
    const highPin = pin.effectLayers?.find((layer) => layer.id === 'pin-high')
      ?.completionEffects?.find((effect) => effect.type === 'apply_buff');
    expect(highPin?.type === 'apply_buff' && highPin.params.controlHitBonus).toBe(0.15);

    const finish = resolveSectAbility({
      sect: state, realm: '化神', abilityId: 'soul-shall-not-return',
    }).config;
    const damage = finish.effectLayers?.find((layer) => layer.id === 'finish-four')
      ?.effects?.find((effect) => effect.type === 'damage');
    expect(damage?.type === 'damage' && damage.params.value.coefficient).toBe(1.65);
  });

  it('基础与终极节点终结倍率保持在明确理论边界内', () => {
    expect(finisherCoefficients()).toEqual({ four: 1.5, five: 1.7 });
    expect(finisherCoefficients(YOUDU_TIDE_PATH_ID, ['tide-lament-deepens']))
      .toEqual({ four: 1.66, five: 1.9 });
    expect(finisherCoefficients(YOUDU_DECREE_PATH_ID, ['decree-verdict']))
      .toEqual({ four: 1.65, five: 1.85 });
    expect(finisherCoefficients(
      YOUDU_DECREE_PATH_ID,
      ['decree-bright-prison-fire', 'decree-seven-inch-severance'],
    )).toEqual({ four: 1.7, five: 1.95 });

    const theoreticalMaximum = 1.95 * 1.35;
    expect(theoreticalMaximum).toBeCloseTo(2.6325);
    expect(theoreticalMaximum).toBeLessThanOrEqual(2.65);
  });

  it('两条道途不会获得对方节点的数值效果', () => {
    const tideState = youduState(YOUDU_TIDE_PATH_ID, ['tide-first-ripple']);
    const decreeState = youduState(YOUDU_DECREE_PATH_ID, ['decree-iron-enters-shadow']);
    const tideSeize = resolveSectAbility({
      sect: tideState, realm: '化神', abilityId: 'seize-soul',
    }).config.effects?.filter((effect) => effect.type === 'damage');
    const decreeForget = resolveSectAbility({
      sect: decreeState, realm: '化神', abilityId: 'forgetful-river-tide',
    }).config.effects?.find((effect) => effect.type === 'damage');

    expect(tideSeize?.map((effect) => effect.type === 'damage'
      ? effect.params.value.coefficient
      : undefined)).toEqual([0.2, 0.2]);
    expect(decreeForget?.type === 'damage' && decreeForget.params.value.coefficient)
      .toBe(0.16);
  });
});
