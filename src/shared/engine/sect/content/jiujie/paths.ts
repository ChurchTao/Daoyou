import { BaseSectPathModule, STANDARD_PATH_LAYERS, type SectBuildBuilder, type SectPathCompileContext, type SectPathDefinitionWithoutNodes, type SectTacticId } from '../../core';
import { compileJiujieBase } from './base/JiujieBaseCompiler';
import { JIUJIE_CONDEMNATION_PATH_ID, JIUJIE_EYE_PATH_ID } from './ids';
import { JIUJIE_EYE_NODES } from './paths/eye/nodes';
import { JIUJIE_CONDEMNATION_NODES } from './paths/condemnation/nodes';
import { CONDEMNATION_BUILD_FACADE, EYE_BUILD_FACADE, JiujieCondemnationBuildFacade, JiujieEyeBuildFacade, createJiujieBuildSettings } from './shared/buildFacade';
import { JiujieCondemnationSelectionStrategy, JiujieEyeSelectionStrategy } from './strategy';

const eyeDefinition: SectPathDefinitionWithoutNodes = { id: JIUJIE_EYE_PATH_ID, name: '劫眼临身', description: '以身为劫眼，将敌人的来力、自己的伤势与天雷标记串成因果，再决定反击、护命或重开劫眼。', minRealm: '筑基', minRealmStage: '中期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'bear-and-return', tactics: [{ id: 'bear-and-return', name: '承灾归劫', description: '先开启劫眼承受爆发，积满劫数后立即清算。' }, { id: 'close-the-eye', name: '闭目守劫', description: '低血时借劫护身，其余时间保留劫数等待清算。' }, { id: 'eye-of-thunder', name: '劫眼照身', description: '开启劫眼后优先落印，持续追问照见者。' }], presentation: { highlights: [{ name: '照见来者', description: '第一次攻击劫眼者会被照见，并受到后续神通追究。' }, { name: '血甲同书', description: '承劫量可从伤势和护盾中积累，并转为伤害、治疗或护盾。' }, { name: '劫后再开', description: '清算可以结束一劫，也可以立即开启下一轮承灾。' }], abilityChanges: { 'receive-calamity': '节点改变开眼方式、承劫来源、受击反应与劫眼续期。', 'thunder-prison-question': '节点可追究照见目标并连接承劫循环。', 'borrow-calamity': '节点可延续劫眼或在破盾后回生标雷。', 'nine-sky-settlement': '节点决定承劫量转为真实伤害、治疗、护盾或下一轮劫眼。' } } };
const condemnationDefinition: SectPathDefinitionWithoutNodes = { id: JIUJIE_CONDEMNATION_PATH_ID, name: '天谴加身', description: '观察目标如何行动，在重复主罪、改变罪名与退回普通攻击之间立案、追责并终审。', minRealm: '筑基', minRealmStage: '中期', layers: [...STANDARD_PATH_LAYERS], defaultTacticId: 'record-and-judge', tactics: [{ id: 'record-and-judge', name: '记罪清算', description: '先施劫雷，再等待目标重复主罪后清算。' }, { id: 'heavy-statute', name: '重典', description: '优先催审满债目标，再以终式兑现判词。' }, { id: 'listen-to-heaven', name: '天听', description: '维持劫雷，积累劫数后执行终审。' }], presentation: { highlights: [{ name: '三类主罪', description: '伤罪、援罪与禁罪各自招致不同惩罚。' }, { name: '变招有责', description: '重复、变罪和连续普通攻击都可被不同参悟追究。' }, { name: '九霄判词', description: '终审可以速审、分类判罚，或清算后立即重新立案。' }], abilityChanges: { 'heaven-hearing': '节点可立案、维持劫雷并有限记录连续普通攻击。', 'calamity-seal': '节点可锁定主罪、追究变罪并加速问行。', 'thunder-prison-question': '节点可取得重犯证据或强制下一次行动候审。', 'nine-sky-settlement': '节点决定速审成本、分类判词、留案与重新立案。' } } };

class EyePathModule extends BaseSectPathModule {
  constructor() { super(eyeDefinition, JIUJIE_EYE_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void { builder.setExtension(EYE_BUILD_FACADE, new JiujieEyeBuildFacade(createJiujieBuildSettings(JIUJIE_EYE_PATH_ID))); }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void { compileJiujieBase(context, builder, builder.requireExtension<JiujieEyeBuildFacade>(EYE_BUILD_FACADE, '劫眼临身构筑').settings); }
  createSelectionStrategy(tacticId: SectTacticId) { return new JiujieEyeSelectionStrategy(tacticId); }
}
class CondemnationPathModule extends BaseSectPathModule {
  constructor() { super(condemnationDefinition, JIUJIE_CONDEMNATION_NODES); }
  protected initializeBuild(_context: SectPathCompileContext, builder: SectBuildBuilder): void { builder.setExtension(CONDEMNATION_BUILD_FACADE, new JiujieCondemnationBuildFacade(createJiujieBuildSettings(JIUJIE_CONDEMNATION_PATH_ID))); }
  protected finalizeBuild(context: SectPathCompileContext, builder: SectBuildBuilder): void { compileJiujieBase(context, builder, builder.requireExtension<JiujieCondemnationBuildFacade>(CONDEMNATION_BUILD_FACADE, '天谴加身构筑').settings); }
  createSelectionStrategy(tacticId: SectTacticId) { return new JiujieCondemnationSelectionStrategy(tacticId); }
}
export const JIUJIE_EYE_PATH_MODULE = new EyePathModule();
export const JIUJIE_CONDEMNATION_PATH_MODULE = new CondemnationPathModule();
