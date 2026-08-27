import {
  ConfiguredSectNodePlugin,
  type SectAbilityId,
  type SectBuildBuilder,
} from '../../../../core';
import {
  CONDEMNATION_BUILD_FACADE,
  type JiujieCondemnationBuildFacade,
  type JiujieCondemnationFeatures,
} from '../../shared/buildFacade';

const node = (
  id: string,
  layerId: string,
  name: string,
  description: string,
  feature: keyof JiujieCondemnationFeatures,
  abilities: SectAbilityId[],
) => new ConfiguredSectNodePlugin(
  { id, layerId, name, description },
  (_context, builder: SectBuildBuilder) => {
    builder.requireExtension<JiujieCondemnationBuildFacade>(
      CONDEMNATION_BUILD_FACADE,
      '天谴加身构筑',
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

export const JIUJIE_CONDEMNATION_NODES = [
  node('condemnation-record', '1', '天听记名', '《天听引雷》命中已有劫雷的目标时增加1层劫债；每个目标每回合最多一次。', 'hearingRecords', ['heaven-hearing']),
  node('condemnation-question', '1', '问行取证', '《雷狱问行》命中已有主罪的目标时增加1层重犯并追加0.15倍法攻雷伤，但不触发主罪的即时惩罚；每回合最多一次。', 'questionEvidence', ['thunder-prison-question']),
  node('condemnation-first-crime', '1', '初罪立案', '目标每次新获得劫雷后，第一次使用非普通攻击的主动神通时，额外给予天宫弟子1点劫数。', 'firstCrime', ['heaven-hearing']),
  node('condemnation-repeat', '2', '伤罪加刑', '目标重复伤罪时，其造成的直接伤害降低12%，持续1回合。', 'damagePunishment', ['nine-sky-settlement']),
  node('condemnation-heavy-debt', '2', '援罪断供', '目标重复援罪时，失去6%最大法力，并受到25%受治疗削弱，持续2回合。', 'supportPunishment', ['nine-sky-settlement']),
  node('condemnation-long-record', '2', '禁罪反照', '目标重复禁罪时，天宫弟子获得30%控制抗性1回合，目标速度降低10%两回合。', 'controlPunishment', ['nine-sky-settlement']),
  node('condemnation-no-pardon', '3', '易罪不赦', '目标在劫雷期间改变主罪类别时增加1层劫债，然后记录新主罪。', 'changingCrimePunished', ['calamity-seal']),
  node('condemnation-debt-book', '3', '定罪成册', '《劫簿落印》命中已有主罪的目标时将该主罪定案；下一次其他类别神通不会替换主罪。', 'lockCrime', ['calamity-seal']),
  node('condemnation-heaven-hearing', '3', '庶行有录', '普通攻击仍不增加劫债和重犯，但会令劫雷延长1回合，并使本次基础雷罚提高30%。', 'basicRecorded', ['heaven-hearing']),
  node('condemnation-heavy-statute', '4', '重法催审', '《因果回响》命中3层劫债目标时，消耗1层劫债，获得1点劫数并追加0.30倍法攻雷伤。', 'echoExpedites', ['causal-echo']),
  node('condemnation-quick-record', '4', '疾书追罪', '《劫簿落印》命中已有主罪的目标后，《雷狱问行》冷却减少1回合；每回合最多一次。', 'sealQuickensQuestion', ['calamity-seal']),
  node('condemnation-three-questions', '4', '三问成案', '《雷狱问行》命中至少2层劫债目标后施加候审；下一次非普通主动神通按重复主罪结算。', 'pendingTrial', ['thunder-prison-question']),
  node('condemnation-reoffend', '5', '再犯从重', '《九霄清算》每层重犯的结算伤害额外计入50%强度的劫雷。', 'repeatedThunder', ['nine-sky-settlement']),
  node('condemnation-clear-book', '5', '清册留案', '《九霄清算》消费劫债和重犯，但保留当前主罪与劫雷。', 'preserveCrime', ['nine-sky-settlement']),
  node('condemnation-no-escape', '5', '两避成罪', '同一目标在劫雷期间连续两次使用普通攻击时，第二次额外增加1层劫债。', 'twoBasicsCrime', ['heaven-hearing']),
  node('condemnation-final-verdict', 'ultimate', '三债终审', '对3层劫债目标施展《九霄清算》时只消耗2点劫数，但按3点劫数计算基础清算伤害。', 'fullDebtSettlement', ['nine-sky-settlement']),
  node('condemnation-nine-crimes', 'ultimate', '九罪同科', '《九霄清算》根据清算前的主罪追加伤罪、援罪或禁罪判词。', 'crimeVerdict', ['nine-sky-settlement']),
  node('condemnation-heavenly-punishment', 'ultimate', '天谴不绝', '《九霄清算》后重新施加2回合劫雷和1层劫债，并重新开启立案。', 'endlessCondemnation', ['nine-sky-settlement']),
] as const;
