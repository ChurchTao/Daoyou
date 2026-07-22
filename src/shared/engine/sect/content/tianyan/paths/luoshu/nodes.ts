import {
  ConfiguredSectNodePlugin,
  type SectMeridianNodeDefinition,
} from '../../../../core';
import {
  LUOSHU_BUILD_FACADE,
  LuoshuBuildFacade,
} from '../../shared/buildFacades';

function luoshuNode(
  definition: SectMeridianNodeDefinition,
  apply: (facade: LuoshuBuildFacade) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, (_context, builder) => {
    apply(
      builder.requireExtension<LuoshuBuildFacade>(
        LUOSHU_BUILD_FACADE,
        '洛书制化构筑',
      ),
    );
  });
}

export const TIANYAN_LUOSHU_NODES = [
  luoshuNode(
    { id: 'luoshu-first-number', layerId: '1', name: '一数先立', description: '战斗开始时获得1点衍数。' },
    (facade) => facade.startWithOne(),
  ),
  luoshuNode(
    { id: 'luoshu-observe-gap', layerId: '1', name: '观印知隙', description: '宗门直接伤害对带有天衍法印的目标提高8%。' },
    (facade) => facade.observeSealGap(),
  ),
  luoshuNode(
    { id: 'luoshu-first-change', layerId: '1', name: '第一变', description: '每场战斗首次落印命中无印目标后返还全部实付法力，并使新印持续3回合。' },
    (facade) => facade.enableFirstChange(),
  ),
  luoshuNode(
    { id: 'luoshu-fast-shift', layerId: '2', name: '移宫疾算', description: '移宫换宿消耗降至10，冷却降至1回合。' },
    (facade) => facade.quickenShift(),
  ),
  luoshuNode(
    { id: 'luoshu-reverse-two', layerId: '2', name: '倒演两宫', description: '移宫换宿改为移动两位；下一次反应主伤害提高20%。' },
    (facade) => facade.reverseTwoPalaces(),
  ),
  luoshuNode(
    { id: 'luoshu-hidden-counter', layerId: '2', name: '藏印为筹', description: '五气归藏数值收益提高25%，并获得1点衍数。' },
    (facade) => facade.empowerRepository(1.25, 1),
  ),
  luoshuNode(
    { id: 'luoshu-flame-flow', layerId: '3', name: '炎流相激', description: '强化燎原、蒸发与熔金。' },
    (facade) => facade.strengthenFlameFlow(),
  ),
  luoshuNode(
    { id: 'luoshu-mountain-wood', layerId: '3', name: '山木倾覆', description: '强化熔岩、泥沼与崩根。' },
    (facade) => facade.strengthenMountainWood(),
  ),
  luoshuNode(
    { id: 'luoshu-metal-water', layerId: '3', name: '金水决机', description: '强化锻锋、寒泉与断脉。' },
    (facade) => facade.strengthenMetalWater(),
  ),
  luoshuNode(
    { id: 'luoshu-lock-position', layerId: '4', name: '定势锁机', description: '提高泥沼与断脉控制命中，并强化抵抗后的替代削弱。' },
    (facade) => facade.lockPosition(),
  ),
  luoshuNode(
    { id: 'luoshu-exploit-weakness', layerId: '4', name: '乘虚而入', description: '目标拥有普通减益或控制时，宗门直接伤害提高15%。' },
    (facade) => facade.exploitWeakness(),
  ),
  luoshuNode(
    { id: 'luoshu-dispel-truth', layerId: '4', name: '斩护见真', description: '每3回合首次触发冲克时，在主伤害前驱散1个普通增益。' },
    (facade) => facade.dispelTruth(),
  ),
  luoshuNode(
    { id: 'luoshu-chain-control', layerId: '5', name: '连环制化', description: '连续反应令后续落印术主伤害提高8%，最多3层。' },
    (facade) => facade.enableChainControl(),
  ),
  luoshuNode(
    { id: 'luoshu-shatter-seal', layerId: '5', name: '碎印夺机', description: '目标低于40%气血时粉碎新印，并追加主伤害45%的无属性伤害。' },
    (facade) => facade.enableShatterSeal(),
  ),
  luoshuNode(
    { id: 'luoshu-save-error', layerId: '5', name: '失算犹存', description: '每回合首次无反应覆盖时保留旧印。' },
    (facade) => facade.preserveMiscalculation(),
  ),
  luoshuNode(
    { id: 'luoshu-nine-changes', layerId: 'ultimate', name: '洛书九变', description: '洛书断局追伤提高至100%，非控制削弱增幅提高至35%。' },
    (facade) => facade.grantNineChanges(),
  ),
  luoshuNode(
    { id: 'luoshu-guest-becomes-host', layerId: 'ultimate', name: '反客为主', description: '洛书断局后保留1点衍数，并使本次新印持续3回合。' },
    (facade) => facade.guestBecomesHost(),
  ),
  luoshuNode(
    { id: 'luoshu-heaven-ends', layerId: 'ultimate', name: '天机尽处', description: '目标低于35%气血时，冲克主伤害获得按已损气血缩放的法攻系数。' },
    (facade) => facade.enableHeavenEnds(),
  ),
] as const;
