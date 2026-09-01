import {
  ConfiguredSectNodePlugin,
  type SectAbilityId,
  type SectBuildBuilder,
} from '../../../../core';
import {
  EYE_BUILD_FACADE,
  type JiujieEyeBuildFacade,
  type JiujieEyeFeatures,
} from '../../shared/buildFacade';

const node = (
  id: string,
  layerId: string,
  name: string,
  description: string,
  feature: keyof JiujieEyeFeatures,
  abilities: SectAbilityId[],
) => new ConfiguredSectNodePlugin(
  { id, layerId, name, description },
  (_context, builder: SectBuildBuilder) => {
    builder.requireExtension<JiujieEyeBuildFacade>(
      EYE_BUILD_FACADE,
      '劫眼临身构筑',
    ).enable(feature);
    for (const abilityId of abilities) {
      builder.addAbilityPresentationModifier({
        sourceId: id,
        abilityId,
        factRows: [`参悟·${name}：${description}`],
      });
    }
  },
);

export const JIUJIE_EYE_NODES = [
  node('eye-open', '1', '开门迎劫', '施展《承天受劫》时获得8%最大气血护盾；该护盾在承劫期间破裂时获得1点劫数，每次施法最多一次。', 'openingShield', ['receive-calamity']),
  node('eye-bear', '1', '承灾留名', '劫眼第一次照见攻击者时额外反击0.15倍法攻雷伤；若其没有劫雷则施加劫雷，若已有劫雷则增加1层劫债。', 'bearingMark', ['receive-calamity']),
  node('eye-first-light', '1', '雷光护心', '每次劫眼存续期间第一次受到直接伤害后，获得5%最大气血护盾，并额外获得1点劫数。', 'firstLight', ['receive-calamity']),
  node('eye-record', '2', '血甲同书', '承劫量可以记录护盾吸收的直接伤害；记录上限提高至自身最大气血的70%。', 'armorMemory', ['receive-calamity']),
  node('eye-question', '2', '问劫寻隙', '《雷狱问行》命中照见目标时，额外推进1层劫债，并使《承天受劫》当前冷却减少1回合。', 'questionBeheld', ['thunder-prison-question']),
  node('eye-return', '2', '借劫续门', '《借劫回身》令当前劫眼和承天受劫各延长1回合；没有对应状态时不补开状态。', 'borrowExtendsEye', ['borrow-calamity']),
  node('eye-guard', '3', '不退天门', '承天受劫期间，气血低于40%时首次受到直接伤害，消耗1点劫数使该次伤害额外降低20%；每回合最多一次。', 'lowHpGate', ['receive-calamity']),
  node('eye-deep-return', '3', '劫威反震', '劫眼期间每回合第一次受到直接伤害后，对攻击者造成0.20倍法攻的雷属性反击伤害。', 'counterThunder', ['receive-calamity']),
  node('eye-still', '3', '静候雷来', '若一整个回合内劫眼没有记录到直接伤害，则回合结束时获得1点劫数，并使《承天受劫》冷却减少1回合。', 'quietCalamity', ['receive-calamity']),
  node('eye-long-gaze', '4', '众劫归一', '《因果回响》命中照见目标时，额外释放当前承劫量的20%作为追击雷伤，但不消耗承劫量；每回合最多一次。', 'echoMemory', ['causal-echo']),
  node('eye-heavy-thunder', '4', '雷狱追身', '《雷狱问行》命中照见目标时追加0.25倍法攻雷伤，并将劫眼刷新1回合。', 'questionPursuit', ['thunder-prison-question']),
  node('eye-shelter', '4', '劫甲回生', '《借劫回身》的护盾破裂时，恢复6%最大气血，并为破盾者施加或刷新劫雷；每个护盾最多触发一次。', 'shieldRebirth', ['borrow-calamity']),
  node('eye-true-record', '5', '真劫入簿', '《九霄清算》的承劫量以45%比例转为无属性真实伤害。', 'trueMemory', ['nine-sky-settlement']),
  node('eye-returning-law', '5', '劫尽身还', '《九霄清算》除造成承劫伤害外，再将承劫量的25%转为自身治疗。', 'memoryHeal', ['nine-sky-settlement']),
  node('eye-after-rain', '5', '清算留门', '消耗3点劫数施展《九霄清算》后，重新获得1回合劫眼和基础承天受劫。', 'settlementReopen', ['nine-sky-settlement']),
  node('eye-nine-gates', 'ultimate', '九门归劫', '《九霄清算》以100%比例释放承劫量；若承劫量达到记录上限，额外推进目标1层劫债。', 'fullMemory', ['nine-sky-settlement']),
  node('eye-heavenly-shield', 'ultimate', '身为天门', '《九霄清算》释放承劫伤害的同时，将承劫量的60%转为护盾，持续2回合。', 'memoryShield', ['nine-sky-settlement']),
  node('eye-calamity-without-end', 'ultimate', '劫后再开', '《九霄清算》后获得2回合劫眼和1回合承天受劫；期间首次受击返还1点劫数，每3回合最多一次。', 'calamityCycle', ['nine-sky-settlement']),
] as const;
