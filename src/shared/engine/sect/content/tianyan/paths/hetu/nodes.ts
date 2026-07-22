import {
  ConfiguredSectNodePlugin,
  type SectMeridianNodeDefinition,
} from '../../../../core';
import {
  HETU_BUILD_FACADE,
  HetuBuildFacade,
} from '../../shared/buildFacades';

function hetuNode(
  definition: SectMeridianNodeDefinition,
  apply: (facade: HetuBuildFacade) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, (_context, builder) => {
    apply(
      builder.requireExtension<HetuBuildFacade>(
        HETU_BUILD_FACADE,
        '河图演生构筑',
      ),
    );
  });
}

export const TIANYAN_HETU_NODES = [
  hetuNode(
    { id: 'hetu-first-number', layerId: '1', name: '初数有应', description: '战斗开始时获得1点衍数。' },
    (facade) => facade.startWithOne(),
  ),
  hetuNode(
    { id: 'hetu-lasting-seal', layerId: '1', name: '印留三刻', description: '落印术施加的新法印基础持续时间提高至3回合。' },
    (facade) => facade.extendSeals(),
  ),
  hetuNode(
    { id: 'hetu-blank-breath', layerId: '1', name: '太初留白', description: '每回合首次以太初玄光命中带印目标时，回复4%最大法力。' },
    (facade) => facade.enableBlankBreath(),
  ),
  hetuNode(
    { id: 'hetu-flow-refund', layerId: '2', name: '法随气转', description: '成功触发反应后，返还本次落印术实际支付法力的20%。' },
    (facade) => facade.enableReactionRefund(),
  ),
  hetuNode(
    { id: 'hetu-shift-carries', layerId: '2', name: '移宫承流', description: '移宫换宿成功转化法印时获得1点衍数。' },
    (facade) => facade.enableShiftFlow(),
  ),
  hetuNode(
    { id: 'hetu-repository-remnant', layerId: '2', name: '归藏纳余', description: '五气归藏数值收益提高20%，并获得1点衍数。' },
    (facade) => facade.empowerRepository(1.2, 1),
  ),
  hetuNode(
    { id: 'hetu-verdant-endless', layerId: '3', name: '青华不竭', description: '木行治疗提高25%；首次令目标满血时获得护盾。' },
    (facade) => facade.strengthenWoodHealing(),
  ),
  hetuNode(
    { id: 'hetu-fire-earth-shelter', layerId: '3', name: '火土相庇', description: '降低火里种莲成本并强化地载无疆。' },
    (facade) => facade.strengthenFireEarthShelter(),
  ),
  hetuNode(
    { id: 'hetu-river-cleansing', layerId: '3', name: '天河洗尘', description: '天河洗心净化3个状态，回复17%最大法力并提高30%控制抗性。' },
    (facade) => facade.strengthenRiverCleansing(),
  ),
  hetuNode(
    { id: 'hetu-generation-gate', layerId: '4', name: '生门并开', description: '每次触发化生后回复2%最大气血。' },
    (facade) => facade.healOnGeneration(),
  ),
  hetuNode(
    { id: 'hetu-overcoming-harmony', layerId: '4', name: '克中留和', description: '每次触发冲克后获得3%最大气血护盾。' },
    (facade) => facade.shieldOnOvercoming(),
  ),
  hetuNode(
    { id: 'hetu-three-talents', layerId: '4', name: '三才合契', description: '以三种不同新元素触发反应时，第三术主伤害提高20%。' },
    (facade) => facade.enableThreeTalents(),
  ),
  hetuNode(
    { id: 'hetu-scroll-open', layerId: '5', name: '河图开卷', description: '河图周天主伤害增幅提高至35%。' },
    (facade) => facade.openScroll(),
  ),
  hetuNode(
    { id: 'hetu-number-remains', layerId: '5', name: '余数不尽', description: '河图周天结算后保留1点衍数。' },
    (facade) => facade.retainNumber(),
  ),
  hetuNode(
    { id: 'hetu-inner-outer', layerId: '5', name: '内外相养', description: '施展内景法后，下一次反应额外获得1点衍数。' },
    (facade) => facade.enableInnerOuter(),
  ),
  hetuNode(
    { id: 'hetu-one-line-opens', layerId: 'ultimate', name: '一画开天', description: '强化河图周天主伤害与非控制反应数值。' },
    (facade) => facade.drawFirstLine(),
  ),
  hetuNode(
    { id: 'hetu-endless-life', layerId: 'ultimate', name: '生生无穷', description: '河图周天额外回复气血与法力，并保留1点衍数。' },
    (facade) => facade.grantEndlessLife(),
  ),
  hetuNode(
    { id: 'hetu-escaped-one-returns', layerId: 'ultimate', name: '遁一归元', description: '每装备1门非落印主动神通，宗门直接伤害、治疗与护盾提高8%，最多2门。' },
    (facade) => facade.returnEscapedOne(),
  ),
] as const;
