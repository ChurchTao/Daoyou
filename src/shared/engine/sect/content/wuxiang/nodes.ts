import {
  ConfiguredSectNodePlugin,
  type SectMeridianNodeDefinition,
} from '../../core';
import { WUXIANG_FEATURES, type WuxiangFeatures } from './compiler';

type NodeSpec = SectMeridianNodeDefinition & { feature: string };

function node(spec: NodeSpec): ConfiguredSectNodePlugin {
  const { feature, ...definition } = spec;
  return new ConfiguredSectNodePlugin(definition, (_context, builder) => {
    builder
      .requireExtension<WuxiangFeatures>(WUXIANG_FEATURES, '无相道途循环规则')
      .add(feature);
  });
}

const mirrorSpecs: NodeSpec[] = [
  { id: 'mirror-vow-body', feature: 'mirror-vow-body', layerId: '1', name: '戒由身起', description: '每轮首次佛相气血成本提高2%，并额外获得1点战意。' },
  { id: 'mirror-guest-in-mirror', feature: 'mirror-guest-in-mirror', layerId: '1', name: '镜中留客', description: '每轮首次受到敌方直接伤害时，额外留下1层业痕。' },
  { id: 'mirror-fruit-in-time', feature: 'mirror-fruit-in-time', layerId: '1', name: '果不逾时', description: '同一敌方行动的宗门反伤上限由最大气血12%提高至16%。' },
  { id: 'mirror-loud-flower', feature: 'mirror-loud-flower', layerId: '2', name: '花落有声', description: '叩心戒的伤害衰减由10%提高至18%。' },
  { id: 'mirror-welcome-tide', feature: 'mirror-welcome-tide', layerId: '2', name: '潮来不拒', description: '血海听潮延后的直接伤害由30%提高至40%。' },
  { id: 'mirror-fourth-knock', feature: 'mirror-fourth-knock', layerId: '2', name: '门叩第四声', description: '三叩业门额外留下第四扇业门。' },
  { id: 'mirror-see-guest', feature: 'mirror-see-guest', layerId: '3', name: '闭目见客', description: '闭目观劫首次直接伤害减免由35%提高至50%。' },
  { id: 'mirror-skandhas-mark', feature: 'mirror-skandhas-mark', layerId: '3', name: '蕴去痕留', description: '照见五蕴成功化去增益时改为产生2层业痕。' },
  { id: 'mirror-carry-karma', feature: 'mirror-carry-karma', layerId: '3', name: '一苇载业', description: '一苇横江的单次直接受击上限由最大气血30%降至25%。' },
  { id: 'mirror-form-beyond', feature: 'mirror-form-beyond', layerId: '4', name: '相外有相', description: '魔相入身后的止观减伤由25%提高至35%。' },
  { id: 'mirror-back-demon', feature: 'mirror-back-demon', layerId: '4', name: '镜背生魔', description: '每次魔相第一门神通免费执行现报条款，不消耗业痕。' },
  { id: 'mirror-formless-two', feature: 'mirror-formless-two', layerId: '4', name: '一念两照', description: '无相式结算后留下2层业痕，但气血成本增加2%。' },
  { id: 'mirror-full-light', feature: 'mirror-full-light', layerId: '5', name: '业满成光', description: '业痕满层时，佛相即时反伤额外提高5%。' },
  { id: 'mirror-fast-fruit', feature: 'mirror-fast-fruit', layerId: '5', name: '现报无迟', description: '所有现报伤害系数提高0.20。' },
  { id: 'mirror-return-source', feature: 'mirror-return-source', layerId: '5', name: '照还来处', description: '每次消耗业痕恢复2%最大气血。' },
  { id: 'mirror-not-platform', feature: 'mirror-not-platform', layerId: 'ultimate', name: '明镜非台', description: '佛相且业痕满层时，受到的直接伤害降低10%。' },
  { id: 'mirror-all-karma', feature: 'mirror-all-karma', layerId: 'ultimate', name: '万业同门', description: '魔相现报可一次消耗至多2层业痕，并按消耗层数强化效果。' },
  { id: 'mirror-return-thought', feature: 'mirror-return-thought', layerId: 'ultimate', name: '来去一念', description: '无相结算后返还2点战意；下一门佛相神通成本提高3%。' },
];

const demonSpecs: NodeSpec[] = [
  { id: 'demon-blood-oil', feature: 'demon-blood-oil', layerId: '1', name: '血作灯油', description: '每轮首次佛相气血成本提高2%，并额外获得1点战意。' },
  { id: 'demon-three-shores', feature: 'demon-three-shores', layerId: '1', name: '三岸留痕', description: '首次跨越70%、45%、25%气血线时，分别获得2%最大气血护盾。' },
  { id: 'demon-bone-tide', feature: 'demon-bone-tide', layerId: '1', name: '潮伏骨中', description: '血潮储存上限由15%提高至22%最大气血。' },
  { id: 'demon-flower-inward', feature: 'demon-flower-inward', layerId: '2', name: '花开向内', description: '心隙令下一次宗门直接伤害提高25%。' },
  { id: 'demon-no-return-tide', feature: 'demon-no-return-tide', layerId: '2', name: '潮不回头', description: '血潮转为伤害的倍率由2倍提高至2.5倍。' },
  { id: 'demon-third-outside', feature: 'demon-third-outside', layerId: '2', name: '门外三声', description: '三叩业门强化第三击的气血线由45%提高至55%。' },
  { id: 'demon-slow-fire', feature: 'demon-slow-fire', layerId: '3', name: '劫火缓行', description: '闭目观劫延后的直接伤害由40%提高至50%。' },
  { id: 'demon-skandhas-fuel', feature: 'demon-skandhas-fuel', layerId: '3', name: '五蕴作薪', description: '焚尽五蕴可焚烧的负面状态上限提高至3个。' },
  { id: 'demon-short-reed', feature: 'demon-short-reed', layerId: '3', name: '苇短水长', description: '一苇横江的单次直接受击上限由最大气血35%降至30%。' },
  { id: 'demon-first-thought', feature: 'demon-first-thought', layerId: '4', name: '第一念魔', description: '所有入魔条款强度提高15%。' },
  { id: 'demon-second-shore', feature: 'demon-second-shore', layerId: '4', name: '第二岸苦', description: '所有渡厄条款强度提高20%。' },
  { id: 'demon-two-gates', feature: 'demon-two-gates', layerId: '4', name: '两门同渡', description: '两次魔相使用不同神通时，第二门气血成本减半。' },
  { id: 'demon-body-breaks', feature: 'demon-body-breaks', layerId: '5', name: '身坏心明', description: '佛相低于30%气血时获得30%控制抗性。' },
  { id: 'demon-blood-empty', feature: 'demon-blood-empty', layerId: '5', name: '血尽潮生', description: '首次由自身成本跨越25%气血线时，额外获得6%最大气血护盾。' },
  { id: 'demon-leave-boat', feature: 'demon-leave-boat', layerId: '5', name: '渡后留舟', description: '魔相结束后下一门佛相神通成本减半，但不产生战意。' },
  { id: 'demon-one-furnace', feature: 'demon-one-furnace', layerId: 'ultimate', name: '佛魔同炉', description: '无相式的入魔、渡厄条款由80%提高至完整强度。' },
  { id: 'demon-no-gap', feature: 'demon-no-gap', layerId: 'ultimate', name: '一息无间', description: '魔相吸血单行动上限提高至12%，但失去转相减伤。' },
  { id: 'demon-look-back', feature: 'demon-look-back', layerId: 'ultimate', name: '回首彼岸', description: '渡厄结算后若存活且低于20%气血，恢复5%最大气血；每次转相一次。' },
];

export const WUXIANG_MIRROR_NODES = mirrorSpecs.map(node);
export const WUXIANG_DEMON_NODES = demonSpecs.map(node);
