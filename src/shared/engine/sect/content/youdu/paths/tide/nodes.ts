import {
  ConfiguredSectNodePlugin,
  type SectBuildBuilder,
} from '../../../../core';
import { TIDE_BUILD_FACADE, type TideBuildFacade } from '../../shared/buildFacade';

const node = (
  id: string,
  layerId: string,
  name: string,
  description: string,
  apply: (facade: TideBuildFacade) => void,
) => new ConfiguredSectNodePlugin(
  { id, layerId, name, description },
  (_context, builder: SectBuildBuilder) =>
    apply(builder.requireExtension<TideBuildFacade>(TIDE_BUILD_FACADE, '招魂渡夜构筑')),
);

export const YOUDU_TIDE_NODES = [
  node('tide-first-ripple', '1', '一水忘川', '忘川的直接魂伤与每次持续魂伤提高15%。', (f) => f.empowerForget()),
  node('tide-call-the-name', '1', '唤名成痕', '一叹命中带有忘川的目标时，术伤提高20%。', (f) => f.empowerSigh()),
  node('tide-soul-lantern', '1', '魂灯初照', '每场第一次施加蚀魂时，额外获得1点魂火。', (f) => f.enableFirstLantern()),
  node('tide-never-ebbs', '2', '潮声不歇', '忘川持续时间由2回合提高到3回合。', (f) => f.extendForget()),
  node('tide-no-medicine', '2', '彼岸无医', '忘川的受治疗削弱由20%提高到30%。', (f) => f.deepenHealSuppression()),
  node('tide-black-water', '2', '黑水浸魄', '带有忘川的目标速度额外降低8%。', (f) => f.slowBlackWater()),
  node('tide-three-souls-far', '3', '三魂皆远', '蚀魂3层与4层的攻防速削弱提高到10%与15%。', (f) => f.deepenAttributeCurve()),
  node('tide-herbs-fail', '3', '药石难入', '蚀魂3层与4层的受治疗削弱提高到40%与60%。', (f) => f.deepenHealCurve()),
  node('tide-crossing-echo', '3', '渡口回声', '每回合第一次对至少4层目标结算忘川时，追加0.12倍法攻魂伤。', (f) => f.enableCrossingEcho()),
  node('tide-no-return-current', '4', '江流不返', '忘川对至少4层目标造成的持续魂伤总计提高30%。', (f) => f.empowerFourLayerForget()),
  node('tide-cleanse-toll', '4', '洗魂有价', '敌人驱散蚀魂层数后受到0.12倍法攻魂伤，每次行动最多一次。', (f) => f.enableCleanseToll()),
  node('tide-shoreless', '4', '两岸俱失', '不归的速度降低由30%提高到40%。', (f) => f.deepenNoReturnSlow()),
  node('tide-hundred-ghosts', '5', '百鬼同哭', '每场第一次尝试施加失魂时，对当前目标追加0.30倍法攻魂伤。', (f) => f.enableHundredGhosts()),
  node('tide-dream-invasion', '5', '魂梦相侵', '失魂触发时，将目标的忘川刷新到完整持续时间。', (f) => f.enableDreamInvasion()),
  node('tide-last-ferry', '5', '末渡无舟', '带有忘川的目标进入5层时，额外失去10%最大法力。', (f) => f.enableLastFerry()),
  node('tide-embers-remain', 'ultimate', '不归亦不散', '魂兮不归结算后保留2层蚀魂。', (f) => f.retainTwoLayers()),
  node('tide-lament-deepens', 'ultimate', '楚些成悲', '魂兮不归每层追加魂伤由0.20提高到0.24。', (f) => f.deepenLament()),
  node('tide-burial-current', 'ultimate', '黑潮送行', '魂兮不归结算后给目标施加2回合忘川。', (f) => f.enableBurialCurrent()),
] as const;
