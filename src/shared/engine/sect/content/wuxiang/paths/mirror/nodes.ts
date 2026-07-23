import {
  ConfiguredSectNodePlugin,
  type SectMeridianNodeDefinition,
} from '../../../../core';
import {
  MIRROR_BUILD_FACADE,
  MirrorBuildFacade,
} from '../../shared/buildFacades';

function mirrorNode(
  definition: SectMeridianNodeDefinition,
  apply: (facade: MirrorBuildFacade) => void,
): ConfiguredSectNodePlugin {
  return new ConfiguredSectNodePlugin(definition, (_context, builder) => {
    apply(
      builder.requireExtension<MirrorBuildFacade>(
        MIRROR_BUILD_FACADE,
        '明镜照业构筑',
      ),
    );
  });
}

export const WUXIANG_MIRROR_NODES = [
  mirrorNode(
    {
      id: 'mirror-vow-body',
      layerId: '1',
      name: '戒由身起',
      description:
        '所有佛相神通气血成本提高1个百分点；成功施展后获得2%最大气血护盾。',
    },
    (mirror) => mirror.strengthenBuddhistBody(),
  ),
  mirrorNode(
    {
      id: 'mirror-guest-in-mirror',
      layerId: '1',
      name: '镜中留客',
      description: '每轮首次受到敌方直接伤害时，额外留下1层业痕。',
    },
    (mirror) => mirror.addGuestKarma(),
  ),
  mirrorNode(
    {
      id: 'mirror-fruit-in-time',
      layerId: '1',
      name: '果不逾时',
      description: '每层业痕提供的佛相反伤比例由3%提高至4%。',
    },
    (mirror) => mirror.strengthenKarmaReflection(),
  ),
  mirrorNode(
    {
      id: 'mirror-loud-flower',
      layerId: '2',
      name: '花落有声',
      description: '叩心戒的伤害衰减由10%提高至18%。',
    },
    (mirror) => mirror.strengthenHeartVow(),
  ),
  mirrorNode(
    {
      id: 'mirror-welcome-tide',
      layerId: '2',
      name: '潮来不拒',
      description: '血海听潮的直接伤害减免由15%提高至25%。',
    },
    (mirror) => mirror.strengthenTideGuard(),
  ),
  mirrorNode(
    {
      id: 'mirror-fourth-knock',
      layerId: '2',
      name: '门叩第四声',
      description: '三叩业门额外留下第四层业门；倒叩时允许追加第四段明确伤害。',
    },
    (mirror) => mirror.addFourthKarmaDoor(),
  ),
  mirrorNode(
    {
      id: 'mirror-see-guest',
      layerId: '3',
      name: '闭目见客',
      description: '闭目观劫首次直接伤害减免由35%提高至50%。',
    },
    (mirror) => mirror.strengthenObserveGuard(),
  ),
  mirrorNode(
    {
      id: 'mirror-skandhas-mark',
      layerId: '3',
      name: '蕴去痕留',
      description: '照见五蕴成功驱散增益时获得2层业痕。',
    },
    (mirror) => mirror.gainTwoKarmaOnDispel(),
  ),
  mirrorNode(
    {
      id: 'mirror-carry-karma',
      layerId: '3',
      name: '一苇载业',
      description: '一苇横江的直接伤害减免由40%提高至50%。',
    },
    (mirror) => mirror.strengthenReedGuard(),
  ),
  mirrorNode(
    {
      id: 'mirror-form-beyond',
      layerId: '4',
      name: '相外有相',
      description: '魔相止观的直接伤害减免由20%提高至30%。',
    },
    (mirror) => mirror.strengthenDemonGuard(),
  ),
  mirrorNode(
    {
      id: 'mirror-back-demon',
      layerId: '4',
      name: '镜背生魔',
      description:
        '每次进入魔相时，第一门神通无需消耗业痕，也能触发一次现报；无相不受影响。',
    },
    (mirror) => mirror.grantFreeFirstPresent(),
  ),
  mirrorNode(
    {
      id: 'mirror-formless-two',
      layerId: '4',
      name: '一念两照',
      description:
        '成功施展无相神通后额外获得2层业痕；《一念无间》气血成本增加2个百分点。',
    },
    (mirror) => mirror.strengthenFormlessKarma(),
  ),
  mirrorNode(
    {
      id: 'mirror-full-light',
      layerId: '5',
      name: '业满成光',
      description: '业痕满层时，佛相即时反伤额外提高5%。',
    },
    (mirror) => mirror.addFullKarmaReflection(),
  ),
  mirrorNode(
    {
      id: 'mirror-fast-fruit',
      layerId: '5',
      name: '现报无迟',
      description:
        '现报成功后，攻击神通额外造成0.20倍物攻伤害；自身防御神通额外获得4%最大气血护盾。',
    },
    (mirror) => mirror.strengthenPresent(),
  ),
  mirrorNode(
    {
      id: 'mirror-return-source',
      layerId: '5',
      name: '照还来处',
      description:
        '每次实际消耗1层业痕触发现报时，恢复2%最大气血；免费现报不触发。',
    },
    (mirror) => mirror.healOnPaidPresent(),
  ),
  mirrorNode(
    {
      id: 'mirror-not-platform',
      layerId: 'ultimate',
      name: '明镜非台',
      description: '佛相且业痕满层时，受到的直接伤害降低10%。',
    },
    (mirror) => mirror.reduceDamageAtFullKarma(),
  ),
  mirrorNode(
    {
      id: 'mirror-all-karma',
      layerId: 'ultimate',
      name: '万业同门',
      description:
        '无相现报实际消耗业痕后，会再尝试消耗1层；成功时攻击神通额外造成0.60倍物攻伤害，防御神通获得8%最大气血护盾。',
    },
    (mirror) => mirror.addSecondFormlessPresent(),
  ),
  mirrorNode(
    {
      id: 'mirror-return-thought',
      layerId: 'ultimate',
      name: '来去一念',
      description: '成功施展无相神通后返还2点心念。',
    },
    (mirror) => mirror.refundWarAfterFormless(),
  ),
];
