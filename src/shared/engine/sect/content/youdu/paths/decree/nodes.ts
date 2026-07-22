import {
  ConfiguredSectNodePlugin,
  type SectBuildBuilder,
} from '../../../../core';
import { DECREE_BUILD_FACADE, type DecreeBuildFacade } from '../../shared/buildFacade';

const node = (
  id: string,
  layerId: string,
  name: string,
  description: string,
  apply: (facade: DecreeBuildFacade) => void,
) => new ConfiguredSectNodePlugin(
  { id, layerId, name, description },
  (_context, builder: SectBuildBuilder) =>
    apply(builder.requireExtension<DecreeBuildFacade>(DECREE_BUILD_FACADE, '镇魄司命构筑')),
);

export const YOUDU_DECREE_NODES = [
  node('decree-iron-enters-shadow', '1', '铁入其影', '夺魄与镇魂的术伤、魂伤各提高10%。', (f) => f.empowerMixedStrikes()),
  node('decree-see-true-name', '1', '见影知名', '照影持续时间提高到4回合。', (f) => f.extendShadow()),
  node('decree-guard-the-spirit', '1', '守神如城', '控制抗性额外提高10个百分点。', (f) => f.guardSpirit()),
  node('decree-first-soul-taken', '2', '一魄先夺', '夺魄的降攻持续时间提高到3回合。', (f) => f.extendSeize()),
  node('decree-silent-nail', '2', '钉下无声', '镇魂法力消耗降低10点。', (f) => f.quietNail()),
  node('decree-bright-prison-fire', '2', '狱火照名', '三点魂火的直接魂伤增幅由25%提高到35%。', (f) => f.brightenSoulFire()),
  node('decree-three-souls-leave', '3', '三魂离座', '离魂引对至少3层目标的增伤由50%提高到70%。', (f) => f.deepenSevering()),
  node('decree-fix-form-first', '3', '先定其形', '每场首次命中照影目标的幽都神通额外增加1层蚀魂。', (f) => f.enableFirstShadowLayer()),
  node('decree-dead-heart-counter', '3', '心寂反照', '心死神活首次解控触发时获得2点魂火。', (f) => f.deepenHeartReflection()),
  node('decree-four-gates-closed', '4', '四门皆闭', '镇魂命中施法前至少4层目标时，令其速度降低20%两回合。', (f) => f.enableFourGatesSlow()),
  node('decree-punishment-measured', '4', '魂刑有度', '失魂被抵抗时，目标攻击与速度仍降低20%一回合。', (f) => f.enableMeasuredPunishment()),
  node('decree-iron-law', '4', '幽都铁律', '对至少4层目标施加镇魂时，控制命中提高15个百分点。', (f) => f.enforceIronLaw()),
  node('decree-five-souls-scattered', '5', '五魄俱散', '目标从失魂回落后，攻击额外降低15%一回合。', (f) => f.enableFiveSoulsPenalty()),
  node('decree-returning-barrier', '5', '神归有垣', '心死神活首次解控后，获得10%最大气血护盾。', (f) => f.enableReturningBarrier()),
  node('decree-one-name-one-judgment', '5', '一名一判', '目标首次进入4层后获得标记；下一次终结命中返还20法力。', (f) => f.enableOneNameJudgment()),
  node('decree-verdict', 'ultimate', '司命判词', '魂兮不归基础魂伤由0.70提高到0.85。', (f) => f.strengthenVerdict()),
  node('decree-seven-inch-severance', 'ultimate', '七寸断魂', '魂兮不归每层追加魂伤由0.20提高到0.25。', (f) => f.severSevenInches()),
  node('decree-name-in-youdu', 'ultimate', '名落幽都', '终结后目标低于20%气血时获得3魂火并返还2回合冷却，每场一次。', (f) => f.enableNameInYoudu()),
] as const;

