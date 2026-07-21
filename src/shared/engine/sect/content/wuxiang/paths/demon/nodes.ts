import {
  ConfiguredSectNodePlugin,
  type SectMeridianNodeDefinition,
} from '../../../../core';
import {
  DEMON_BUILD_FACADE,
  DemonBuildFacade,
} from '../../shared/buildFacades';

function demonNode(
  definition: SectMeridianNodeDefinition,
  apply: (facade: DemonBuildFacade) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, (_context, builder) => {
    apply(builder.requireExtension<DemonBuildFacade>(DEMON_BUILD_FACADE, '魔心渡厄构筑'));
  });
}

export const WUXIANG_DEMON_NODES = [
  demonNode(
    { id: 'demon-blood-oil', layerId: '1', name: '血作灯油', description: '所有佛相神通气血成本提高1个百分点；成功施展后获得2%最大气血护盾。' },
    (demon) => demon.strengthenBuddhistBody(),
  ),
  demonNode(
    { id: 'demon-three-shores', layerId: '1', name: '三岸留痕', description: '每场战斗首次因自身神通成本降至35%气血以下时，获得8%最大气血护盾。' },
    (demon) => demon.addThresholdShield(),
  ),
  demonNode(
    { id: 'demon-bone-tide', layerId: '1', name: '潮伏骨中', description: '血海听潮获得的基础护盾由10%提高至15%最大气血。' },
    (demon) => demon.strengthenTideShield(),
  ),
  demonNode(
    { id: 'demon-flower-inward', layerId: '2', name: '花开向内', description: '心隙令下一次宗门直接伤害提高25%。' },
    (demon) => demon.strengthenHeartGap(),
  ),
  demonNode(
    { id: 'demon-no-return-tide', layerId: '2', name: '潮不回头', description: '血海听潮生成的下一门宗门直接伤害加成由20%提高至30%；无相仍以30%为准。' },
    (demon) => demon.strengthenTideDamage(),
  ),
  demonNode(
    { id: 'demon-third-outside', layerId: '2', name: '门外三声', description: '三叩业门强化第三击的气血线由45%提高至55%。' },
    (demon) => demon.raiseThirdHitThreshold(),
  ),
  demonNode(
    { id: 'demon-slow-fire', layerId: '3', name: '劫火缓行', description: '闭目观劫的直接伤害减免由40%提高至50%。' },
    (demon) => demon.strengthenObserveGuard(),
  ),
  demonNode(
    { id: 'demon-skandhas-fuel', layerId: '3', name: '五蕴作薪', description: '照见五蕴的佛相净化数量由1提高至2；无相追加后总净化数量为3。' },
    (demon) => demon.addCleanse(),
  ),
  demonNode(
    { id: 'demon-short-reed', layerId: '3', name: '苇短水长', description: '一苇横江的佛相直接伤害减免由20%提高至30%；魔相最终提高到40%。' },
    (demon) => demon.strengthenReedGuard(),
  ),
  demonNode(
    { id: 'demon-first-thought', layerId: '4', name: '第一念魔', description: '进入魔相或无相时获得第一念：下一门攻击神通追加0.35倍物攻伤害，防御神通获得5%最大气血护盾。' },
    (demon) => demon.grantFirstThought(),
  ),
  demonNode(
    { id: 'demon-second-shore', layerId: '4', name: '第二岸苦', description: '魔相期间每成功施展一门宗门神通，恢复2.5%最大气血；无相仅触发一次。' },
    (demon) => demon.healAfterDemonSkill(),
  ),
  demonNode(
    { id: 'demon-two-gates', layerId: '4', name: '两门同渡', description: '进入魔相时获得6%最大气血护盾。' },
    (demon) => demon.shieldOnDemonEntry(),
  ),
  demonNode(
    { id: 'demon-body-breaks', layerId: '5', name: '身坏心明', description: '每场战斗首次因自身神通成本降至30%气血以下时，获得1回合控制免疫。' },
    (demon) => demon.grantLowHpControlImmunity(),
  ),
  demonNode(
    { id: 'demon-blood-empty', layerId: '5', name: '血尽潮生', description: '每场战斗首次因自身神通成本降至25%气血以下时，恢复5%最大气血。' },
    (demon) => demon.healAtCriticalHp(),
  ),
  demonNode(
    { id: 'demon-leave-boat', layerId: '5', name: '渡后留舟', description: '魔相结束时获得6%最大气血护盾；无相结束不触发。' },
    (demon) => demon.shieldOnDemonExit(),
  ),
  demonNode(
    { id: 'demon-one-furnace', layerId: 'ultimate', name: '佛魔同炉', description: '逐门强化无相追加：收束伤害、恢复、护盾或净化获得明确提升。' },
    (demon) => demon.strengthenFormlessLayers(),
  ),
  demonNode(
    { id: 'demon-no-gap', layerId: 'ultimate', name: '一息无间', description: '魔相与无相的单行动吸血上限提高至12%最大气血，但失去公共20%直接伤害减免。' },
    (demon) => demon.tradeGuardForLifesteal(),
  ),
  demonNode(
    { id: 'demon-look-back', layerId: 'ultimate', name: '回首彼岸', description: '魔相或无相结束时，若存活且低于20%气血，恢复5%最大气血；每次转相最多一次。' },
    (demon) => demon.healAfterCrossing(),
  ),
];

