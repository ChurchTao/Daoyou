import { evalExpr } from '@daoyou/combat-core/expr';
import { createUnit } from '@daoyou/combat-core/units';
import type { CombatResourceState, SkillDef, StatusDef, Unit } from '@daoyou/combat-core/types';
import { REALM_STAGE_VALUES, REALM_VALUES } from '@daoyou/constants/realms';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import type { CombatV6SectId, SectCombatProgressV6, SectDefinitionV6, SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { combatV6SkillDetails } from '../combat/skill-details.js';
import { schoolTermValue } from '../combat/daoyou/formulas.js';
import { formatRatioPercent } from '../presentation/numbers.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileCurrentSectCombatV6 } from './index.js';
import { canSelectMeridianNode, connectedMeridianSelection, toggleMeridianNode } from './meridian-selection.js';
import { MERIDIAN_LEVELS } from './progression.js';
import { methodLevelCap, SECT_PROGRESSION } from './progression-pack.js';

export type SectAtlasSource = {
  type: 'base' | 'path-foundation' | 'path-grant' | 'node-passive' | 'node-grant' | 'path-patch' | 'node-patch';
  label: string;
  pathId?: string;
  nodeId?: string;
};
export type SectAtlasNumericField = {
  path: string;
  label: string;
  contextLabel: string;
  value: number | string;
  display: string;
  resolved: number | null;
  resolvedDisplay: string | null;
  variables: Array<{ name: string; label: string }>;
};
export type SectAtlasSkill = {
  id: string;
  name: string;
  kind: SectSkillDefV6['kind'];
  sourceMethodId: string;
  unlockMethodLevel: number;
  description: string;
  definition: SkillDef;
  sources: SectAtlasSource[];
  numericFields: SectAtlasNumericField[];
};
export type SectAtlasStatus = {
  id: string;
  name: string;
  description: string;
  definition: StatusDef;
  referencedBySkillIds: string[];
  numericFields: SectAtlasNumericField[];
};
export type SectAtlasEntry = {
  id: CombatV6SectId;
  name: string;
  methods: SectDefinitionV6['methods'];
  paths: SectDefinitionV6['paths'];
  skills: SectAtlasSkill[];
  statuses: SectAtlasStatus[];
  resources: CombatResourceState[];
};
export type SectAtlasData = {
  formatVersion: 1;
  limits: { maxCharacterLevel: number; maxMethodLevel: number; meridianCharacterLevels: number[] };
  sects: SectAtlasEntry[];
};
export type SectAtlasBuildInput = {
  sectId: CombatV6SectId;
  pathId: string;
  characterLevel: number;
  methods?: Record<string, number>;
  nodeIds?: string[];
};
export type SectAtlasSkillInput = {
  sectId: CombatV6SectId;
  skillId: string;
  methodLevel: number;
};
export type SectAtlasSkillPreview = {
  skillId: string;
  sourceMethodId: string;
  methodLevel: number;
  unlockMethodLevel: number;
  unlocked: boolean;
  numericFields: SectAtlasNumericField[];
};
export type SectAtlasDiagnostic = { severity: 'info' | 'warning' | 'error'; code: string; message: string; path?: string };
export type SectAtlasBuildPreview = {
  ok: boolean;
  characterLevel: number;
  progress: SectCombatProgressV6;
  selectedNodeIds: string[];
  automaticNodeIds: string[];
  nodeOptions: Array<{ id: string; selected: boolean; automatic: boolean; selectable: boolean; requirement: string }>;
  diagnostics: SectAtlasDiagnostic[];
  skills: Array<SectAtlasSkill & { available: boolean; requirement: string; skillLevel: number; changedFields: string[]; changeSources: SectAtlasSource[] }>;
  panel: import('@daoyou/game-domain/combat').CombatV6PanelContribution[];
  resources: CombatResourceState[];
};

const maxCharacterLevel = getRealmStageLevel(REALM_VALUES.at(-1)!, REALM_STAGE_VALUES.at(-1)!);
const expressionFields = new Set(('add aimCount allDamageTakenBonus amount barrierDamageBonus barrierDrainBonus chance chanceFactor costHp costMp count critChanceAdd critMultiplierAdd damageAdd damageBonus damageResultFactor damageTakenAdd damageTakenBonus defenseIgnore defenseIgnoreAdd defenseSubtract duration durationAdd expression extraChance extraCount factor finalAdd healingPerRound hitAdd hits hp hpCap hpPower hpRatio magicDefenseAdd maxCount maxGainPerAction maxGainPerRound maxPower mpCap mpPower ownedPetHpCostRatio physicalAttackAdd physicalDefenseAdd physicalFuryChanceAdd power priority protectedDamageBonus recoverySkipChance requirement sealChanceAdd sealChanceCeilAdd sealChanceCeilTakenAdd sealChanceFactor sealHitAdd sealResistanceAdd speedMod successCostHp successCostMp targetCount targetCountAdd value').split(' '));
const labels: Record<string, string> = {
  costMp: '法力消耗', costHp: '气血消耗', successCostMp: '成功后法力消耗', successCostHp: '成功后气血消耗',
  cooldownRounds: '冷却回合', initialCooldownRounds: '开场冷却', requireHpRatio: '最低气血比例', requireHpAboveRatio: '气血须高于', requireHpBelowRatio: '气血须低于',
  count: '目标数量', targetCount: '目标数量', targetCountAdd: '增加目标数', hits: '攻击段数', coeff: '伤害系数', resultFactors: '伤害结果倍率',
  power: '效果威力', maxPower: '效果威力上限', duration: '持续回合', durationAdd: '增加持续回合', chance: '触发概率', chanceFactor: '概率倍率',
  min: '最低值', max: '最高值', amount: '变化量', factor: '效果倍率', add: '额外加值', finalAdd: '结果加值', value: '效果数值', expression: '生效条件', requirement: '施放条件',
  maxHp: '气血上限', hp: '气血', maxMp: '法力上限', mp: '法力', physicalAtk: '物理攻击', physicalDef: '物理防御', magicAtk: '法术攻击', magicDef: '法术防御',
  speed: '速度', hit: '命中', dodge: '躲避', healPower: '治疗强度', sealHit: '封印命中', sealResist: '封印抵抗',
  damageBonus: '伤害加成', damageAdd: '伤害加值', damageResultFactor: '伤害结果倍率', damageTakenBonus: '承伤加成', damageTakenAdd: '承伤加值', allDamageTakenBonus: '全部承伤加成',
  critChanceAdd: '暴击率加值', physicalFuryChanceAdd: '物理狂暴率加值', critMultiplierAdd: '暴击倍率加值', defenseIgnore: '忽视防御', defenseIgnoreAdd: '忽视防御加值', defenseSubtract: '防御扣除值',
  sealBase: '封印基础概率', sealChanceCeil: '封印概率上限', sealChanceAdd: '封印概率加值', sealChanceCeilAdd: '封印概率上限加值', sealChanceCeilTakenAdd: '所受封印的概率上限加值', sealChanceFactor: '封印概率倍率', sealHitAdd: '封印命中加值', sealResistanceAdd: '封印抵抗加值',
  perTarget: '每目标分灵衰减', floor: '分灵倍率下限', quad: '心法二次项系数', linear: '心法一次项系数', intercept: '心法常数项',
  healingPerRound: '每回合治疗', hpPower: '每回合气血变化', mpPower: '每回合法力变化', ratioOfMaxHp: '气血上限比例', ratioOfMaxMp: '法力上限比例',
  maxStacks: '最大层数', damageTakenPhysical: '物理承伤倍率', damageTakenSpell: '法术承伤倍率', damageDealtPhysical: '物理伤害倍率', damageDealtSpell: '法术伤害倍率',
  healTaken: '受到治疗倍率', healDealt: '施放治疗倍率', mpShieldRatio: '法力抵伤比例', breakOnDamageAbove: '受伤解除门槛', priority: '同类状态强度',
  current: '初始层数', speedMod: '速度修正', maxCount: '最多处理数量', physicalAttackAdd: '物攻加值', physicalDefenseAdd: '物防加值', magicDefenseAdd: '法防加值', recoverySkipChance: '免休息概率',
};
const variables: Record<string, string> = {
  skillLevel: '所属心法等级', level: '人物战斗等级', targets: '实际目标数', round: '当前回合', damage: '本次伤害', hpDamage: '实际气血损失',
  actionTargetCount: '本次出手目标数', actionTargetIndex: '本次出手目标序号', injuredAllyCount: '可恢复伤员数',
  impactDamage: '本次攻击伤害', resourceCost: '本次资源消耗', originalResourceCost: '折扣前资源消耗', statusDuration: '状态持续回合', statusChance: '状态命中概率',
  removedStatusRounds: '被移除状态的剩余回合数', removedStatusSkillLevel: '被移除状态的施放心法等级',
  ownStandingPet: '本人灵兽是否在场', ownPetHp: '本人灵兽气血', ownPetMaxHp: '本人灵兽气血上限', enemyCount: '存活敌人数', enemyPlayers: '敌方人物数',
};
const referenceNames = new Map(Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap(sect => [
  ...sect.methods, ...sect.statuses, ...sect.paths.flatMap(path => path.resources ?? []),
  ...authoredSkills(sect).map(({ skill, source }) => ({ id: skill.definition.id, name: source.pathId ? `${sect.paths.find(path => path.id === source.pathId)!.name}·${skill.definition.name}` : skill.definition.name })),
]).map(entry => [entry.id, entry.name]));
const statusNames = new Map<string, string>();
const statusKindNames = new Map<string, string>();
for (const status of Object.values(COMBAT_V6_SECT_DEFINITIONS).flatMap(sect => sect.statuses)) {
  statusNames.set(status.id, status.name);
  const names = new Set([...(statusKindNames.get(status.kind)?.split('／') ?? []), status.name]);
  statusKindNames.set(status.kind, [...names].join('／'));
}
const statusVariables: Array<[string, (name: string) => string]> = [
  ['hasStatus.', name => `是否处于「${name}」`],
  ['statusRounds.', name => `自身「${name}」剩余回合数`],
  ['targetStatusRounds.', name => `目标「${name}」剩余回合数`],
  ['statusAge.', name => `自身由本人施加的「${name}」已持续回合数`],
  ['targetStatusAge.', name => `目标身上本人施加的「${name}」已持续回合数`],
  ['ownedTargetStatus.', name => `目标是否带有本人施加的「${name}」`],
  ['ownedTargetStatusStacks.', name => `目标身上本人施加的「${name}」层数`],
  ['ownedTargetStatusRounds.', name => `目标身上本人施加的「${name}」剩余回合数`],
  ['ownedTargetStatusSkillLevel.', name => `目标身上本人施加的「${name}」所用心法等级`],
  ['ownedEnemyStatusCount.', name => `带有本人施加「${name}」的敌方人物数`],
  ['enemyStatus.', name => `带有「${name}」的敌方单位数`],
  ['allyStatus.', name => `带有「${name}」的友方单位数`],
];
function variableLabel(name: string): string {
  if (variables[name]) return variables[name];
  if (labels[name]) return `自身${labels[name]}`;
  if (name.startsWith('source.')) return `自身${labels[name.slice(7)] ?? '战斗属性'}`;
  if (name.startsWith('target.')) return `目标${labels[name.slice(7)] ?? '战斗属性'}`;
  if (name.startsWith('knownSkillLevel.')) return `已学「${referenceNames.get(name.slice(16)) ?? '指定技能'}」等级`;
  if (name.startsWith('known.')) return `是否已学「${referenceNames.get(name.slice(6)) ?? '指定技能'}」`;
  if (name.startsWith('resource.')) {
    const resource = referenceNames.get(name.slice(9));
    return resource ? `「${resource}」层数` : '当前战斗资源';
  }
  for (const [prefix, label] of statusVariables) {
    if (!name.startsWith(prefix)) continue;
    const reference = name.slice(prefix.length);
    const status = prefix === 'hasStatus.' ? statusNames.get(reference) : statusKindNames.get(reference);
    if (status) return label(status);
  }
  if (name.startsWith('fact.')) return '战斗记录与装备条件';
  if (/status|Status/.test(name)) return '状态及其来源、层数或持续条件';
  return '战斗现场条件';
}
const functionLabels: Record<string, string> = { floor: '向下取整', min: '较小值', max: '较大值', if: '条件选择' };
const ratioFields = new Set(('chance extraChance recoverySkipChance sealChanceCeil damageBonus damageTakenBonus allDamageTakenBonus defenseIgnore defenseIgnoreAdd protectedDamageBonus barrierDamageBonus barrierDrainBonus ratioOfMaxHp ratioOfMaxMp hpRatio ownedPetHpCostRatio mpShieldRatio requireHpRatio requireHpAboveRatio requireHpBelowRatio perTarget sourceHpRatioBelow sourceHpRatioAbove targetHpRatioBelow targetHpRatioAbove sourceInitialHpRatioMin sourceInitialHpRatioBelow sourceMpRatioBelow sourceMpRatioAbove').split(' '));
const probabilityDeltaFields = new Set(['critChanceAdd', 'physicalFuryChanceAdd', 'sealChanceAdd', 'sealChanceCeilAdd', 'sealChanceCeilTakenAdd']);
const multiplierFields = new Set(('factor chanceFactor coeff resultFactors damageResultFactor critMultiplierAdd damageTakenPhysical damageTakenSpell damageDealtPhysical damageDealtSpell healTaken healDealt sealChanceFactor sealHitTakenFactor floor').split(' '));
function displayValue(value: number | string, key: string): string {
  const number = (value: number) => String(Number(value.toFixed(6)));
  const expression = typeof value === 'number' ? number(value) : value.replace(/[A-Za-z_][A-Za-z0-9_.]*/g, token => functionLabels[token] ?? variableLabel(token));
  const probabilityDelta = probabilityDeltaFields.has(key);
  if (ratioFields.has(key) || probabilityDelta)
    return typeof value === 'number'
      ? `${probabilityDelta && value > 0 ? '+' : ''}${formatRatioPercent(value, 6)}`
      : `(${expression}) × 100%`;
  if (key === 'sealBase') return `${expression}%`;
  if (multiplierFields.has(key)) return `${expression}倍`;
  if (['duration', 'durationAdd', 'cooldownRounds', 'initialCooldownRounds', 'immunityRounds', 'minDuration', 'maxDuration'].includes(key)) return `${expression}回合`;
  if (['count', 'targetCount', 'targetCountAdd', 'aimCount'].includes(key)) return `${expression}个目标`;
  if (key === 'hits') return `${expression}段`;
  if (key === 'maxStacks') return `${expression}层`;
  if (key === 'costMp' || key === 'successCostMp') return `${expression}点法力`;
  if (key === 'costHp' || key === 'successCostHp') return `${expression}点气血`;
  return expression;
}
const expressionSource = createUnit({ id: 'sect-atlas', name: '图鉴预览', side: 0, kind: 'player', attrs: { hp: 1, speed: 0, physicalAtk: 0, physicalDef: 0 } }, 0);
const sectionLabels: Record<string, string> = { effects: '效果', successEffects: '成功效果', failureEffects: '失败效果', hooks: '触发规则', modifiers: '条件修正', resourceCosts: '资源费用', resourceRequirements: '资源门槛', countByResource: '资源目标门槛', coeff: '攻击段系数', resultFactors: '攻击段倍率' };
const eventLabels: Record<string, string> = { beforeAction: '行动前', afterAction: '行动后', afterHit: '命中后', afterStrike: '打击后', onHitCalc: '命中结算时', onDeath: '倒地时', roundStart: '回合开始', roundEnd: '回合结束' };
const effectLabels: Record<string, string> = { physicalHit: '物理伤害', spellHit: '法术伤害', fixedHit: '固定伤害', applyStatus: '施加状态', removeStatus: '移除状态', restoreHp: '恢复气血', restoreMp: '恢复法力', heal: '治疗', applyBarrier: '护盾', modifyResource: '调整资源', randomBranch: '随机分支', wound: '伤势', repeat: '连续效果' };

/** Resolve only expressions whose complete input is known; absent battle facts never become zero. */
function numericFields(value: unknown, skillLevel?: number, path = '', parent = '', source?: Unit, contextLabel = '基础参数'): SectAtlasNumericField[] {
  if (Array.isArray(value)) return value.flatMap((child, index) => {
    const section = sectionLabels[path.split('.').at(-1)!] ?? '规则';
    const detail = child && typeof child === 'object' ? child as Record<string, unknown> : {};
    const name = typeof detail.on === 'string' ? eventLabels[detail.on] : typeof detail.type === 'string' ? effectLabels[detail.type] : undefined;
    return numericFields(child, skillLevel, `${path}[${index}]`, parent, source, `${contextLabel} / ${section}第${index + 1}项${name ? `·${name}` : ''}`);
  });
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => numericFields(child, skillLevel, path ? `${path}.${key}` : key, path.split('.').at(-1) ?? '', source,
    key === 'when' ? `${contextLabel} / 生效条件` : key === 'schoolTerm' ? '心法附加威力' : key === 'targeting' ? `${contextLabel} / 作用目标` : key === 'attrMods' ? `${contextLabel} / 属性修正` : contextLabel));
  const key = path.replace(/\[\d+\]$/g, '').split('.').at(-1)!;
  if (typeof value !== 'number' && !(typeof value === 'string' && (expressionFields.has(key) || parent === 'attrMods'))) return [];
  const names = typeof value === 'string' ? [...new Set(value.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? [])].filter(name => !['floor', 'min', 'max', 'if'].includes(name)) : [];
  const known = names.every(name => (name === 'skillLevel' && skillLevel !== undefined) || (source !== undefined && (name === 'level' || name.startsWith('known.') || name.startsWith('knownSkillLevel.'))));
  const resolved = typeof value === 'number' ? value : known ? evalExpr(value, { source: source ?? expressionSource, skillLevel: skillLevel ?? 0, targets: 0 }) : null;
  return [{ path, label: labels[key] ?? '规则数值', contextLabel, value, display: displayValue(value, key), resolved, resolvedDisplay: resolved === null ? null : displayValue(resolved, key), variables: names.map(name => ({ name, label: variableLabel(name) })) }];
}

function statusDescription(status: StatusDef, fields: SectAtlasNumericField[]): string {
  if (status.description) return status.description;
  const flags: Array<[boolean | undefined, string]> = [
    [status.blocksAction, '无法行动'], [status.blocksSpell, '无法使用法术'], [status.blocksDamagingSpells, '无法使用伤害法术'],
    [status.blocksPhysical, '无法普通攻击或使用物理技能'], [status.blocksArts, '无法使用器诀'], [status.blocksNonArtSkills, '无法使用非器诀技能'],
    [status.blocksRevive, '无法复活'], [status.immuneToSeal, '免疫封印'], [status.untilBattleEnd, '持续至战斗结束'], [status.dispellable === false, '不可被普通驱散移除'],
    [status.persistWhenDowned, '倒地后保留'], [status.breakOnDamage, '受到符合门槛的气血伤害后解除'],
  ];
  const rules = fields.map(field => `${field.label}：${field.display}`);
  return [...flags.filter(([enabled]) => enabled).map(([, text]) => text), ...rules].join('；') || '用于记录技能的触发、消耗或后续变化；具体条件见关联技能。';
}

function authoredSkills(definition: SectDefinitionV6): Array<{ skill: SectSkillDefV6; source: SectAtlasSource }> {
  return [
    ...definition.skills.map(skill => ({ skill, source: { type: 'base' as const, label: '宗门心法' } })),
    ...definition.paths.flatMap(path => [
      ...(path.foundationPassives ?? []).map(skill => ({ skill, source: { type: 'path-foundation' as const, pathId: path.id, label: `${path.name}·流派根基` } })),
      ...(path.grantSkills ?? []).map(skill => ({ skill, source: { type: 'path-grant' as const, pathId: path.id, label: `${path.name}·流派神通` } })),
      ...path.nodes.flatMap(node => [
        ...(node.passives ?? []).map(skill => ({ skill, source: { type: 'node-passive' as const, pathId: path.id, nodeId: node.id, label: `${path.name}·第${node.layer}层 ${node.name}` } })),
        ...(node.grantSkills ?? []).map(skill => ({ skill, source: { type: 'node-grant' as const, pathId: path.id, nodeId: node.id, label: `${path.name}·第${node.layer}层 ${node.name}` } })),
      ]),
    ]),
  ];
}

function referencesStatus(value: unknown, status: StatusDef): boolean {
  if (typeof value === 'string') return (value.match(/[A-Za-z_][A-Za-z0-9_.]*/g) ?? []).some(token =>
    token === status.id || token === status.kind || token.endsWith(`.${status.id}`) || token.endsWith(`.${status.kind}`));
  if (Array.isArray(value)) return value.some(child => referencesStatus(child, status));
  return !!value && typeof value === 'object' && Object.values(value).some(child => referencesStatus(child, status));
}

function atlasEntry(definition: SectDefinitionV6): SectAtlasEntry {
  const skills = new Map<string, SectAtlasSkill>();
  for (const { skill, source } of authoredSkills(definition)) {
    const previous = skills.get(skill.definition.id);
    if (previous) { previous.sources.push(source); continue; }
    skills.set(skill.definition.id, {
      id: skill.definition.id, name: skill.definition.name, kind: skill.kind, sourceMethodId: skill.sourceMethodId, unlockMethodLevel: skill.unlockMethodLevel,
      description: combatV6SkillDetails([skill.definition], definition.statuses)[skill.definition.id].description,
      definition: skill.definition, sources: [source], numericFields: numericFields(skill.definition),
    });
  }
  return structuredClone({
    id: definition.id, name: definition.name, methods: definition.methods, paths: definition.paths, skills: [...skills.values()],
    statuses: definition.statuses.map(status => {
      const fields = numericFields(status);
      return { id: status.id, name: status.name, description: statusDescription(status, fields), definition: status, numericFields: fields,
        referencedBySkillIds: [...skills.values()].filter(skill => referencesStatus(skill.definition, status)).map(skill => skill.id) };
    }),
    resources: [...new Map(definition.paths.flatMap(path => path.resources ?? []).map(resource => [resource.id, resource])).values()],
  });
}

export function getSectAtlasData(): SectAtlasData {
  return { formatVersion: 1, limits: { maxCharacterLevel, maxMethodLevel: SECT_PROGRESSION.method.maxLevel, meridianCharacterLevels: [...MERIDIAN_LEVELS] }, sects: Object.values(COMBAT_V6_SECT_DEFINITIONS).map(atlasEntry) };
}

/** Preview authored skill growth without assuming a character, path or battle state. */
export function previewSectAtlasSkill(input: SectAtlasSkillInput): SectAtlasSkillPreview {
  if (!Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, input.sectId)) throw new Error('未知宗门');
  const sect = COMBAT_V6_SECT_DEFINITIONS[input.sectId];
  const skill = authoredSkills(sect).find(entry => entry.skill.definition.id === input.skillId)?.skill;
  if (!skill) throw new Error('神通不属于当前宗门');
  const methodLevel = Math.max(0, Math.min(SECT_PROGRESSION.method.maxLevel, Math.floor(Number.isFinite(input.methodLevel) ? input.methodLevel : 0)));
  const fields = numericFields(skill.definition, methodLevel);
  function appendAppliedStatuses(value: unknown, path: string, appliedLevel: number | undefined): void {
    if (Array.isArray(value)) { value.forEach((child, index) => appendAppliedStatuses(child, `${path}[${index}]`, appliedLevel)); return; }
    if (!value || typeof value !== 'object') return;
    const record = value as Record<string, unknown>;
    if (record.type === 'applyStatus') {
      let status = sect.statuses.find(status => status.id === record.statusId);
      let statusPath = path;
      let context = fields.find(field => field.path === `${path}.duration`)?.contextLabel ?? '基础参数';
      const seen = new Set<string>();
      while (status && !seen.has(status.id)) {
        seen.add(status.id);
        statusPath += `.statuses.${status.id}`;
        context += ` / ${seen.size === 1 ? '施加状态' : '自然转为'}·${status.name}`;
        fields.push(...numericFields(status, appliedLevel, statusPath, '', undefined,
          `${context}${appliedLevel === undefined ? ' / 按触发技能等级' : ''}`));
        const nextId = status.onExpire?.statusId;
        status = sect.statuses.find(status => status.id === nextId);
        statusPath += '.onExpire';
      }
    }
    for (const [key, child] of Object.entries(record)) appendAppliedStatuses(child, path ? `${path}.${key}` : key,
      key === 'effects' && (record.effectSource === 'eventSource' || record.effectSkill === 'eventSkill') ? undefined : appliedLevel);
  }
  appendAppliedStatuses(skill.definition, '', methodLevel);
  if (skill.definition.schoolTerm) {
    const power = schoolTermValue(skill.definition.schoolTerm, methodLevel);
    fields.push({ path: 'schoolTerm.total', label: '心法附加威力', contextLabel: '心法附加威力', value: power,
      display: displayValue(power, 'power'), resolved: power, resolvedDisplay: displayValue(power, 'power'),
      variables: [{ name: 'skillLevel', label: variables.skillLevel }] });
  }
  return {
    skillId: skill.definition.id, sourceMethodId: skill.sourceMethodId, methodLevel,
    unlockMethodLevel: skill.unlockMethodLevel, unlocked: methodLevel >= skill.unlockMethodLevel,
    numericFields: fields,
  };
}

function changedFields(before: unknown, after: unknown, path = ''): string[] {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object') {
    const left = before as Record<string, unknown>, right = after as Record<string, unknown>;
    return [...new Set([...Object.keys(left), ...Object.keys(right)])].flatMap(key => changedFields(left[key], right[key], path ? `${path}.${key}` : key));
  }
  return [path];
}

export function previewSectAtlasBuild(input: SectAtlasBuildInput): SectAtlasBuildPreview {
  if (!Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, input.sectId)) throw new Error('未知宗门');
  const definition = COMBAT_V6_SECT_DEFINITIONS[input.sectId];
  const path = definition.paths.find(entry => entry.id === input.pathId);
  if (!path) throw new Error('流派不属于当前宗门');
  const diagnostics: SectAtlasDiagnostic[] = [];
  const characterLevel = Math.max(1, Math.min(maxCharacterLevel, Math.floor(Number.isFinite(input.characterLevel) ? input.characterLevel : maxCharacterLevel)));
  if (characterLevel !== input.characterLevel) diagnostics.push({ severity: 'warning', code: 'ATLAS_CHARACTER_LEVEL_NORMALIZED', message: '人物等级已调整到当前可用范围' });
  const cap = methodLevelCap(characterLevel);
  const primary = definition.methods.find(method => method.isPrimary)!;
  const clampMethod = (id: string, limit: number) => {
    const raw = input.methods?.[id] ?? cap;
    const level = Math.max(0, Math.min(limit, Math.floor(Number.isFinite(raw) ? raw : 0)));
    if (raw !== level) diagnostics.push({ severity: 'warning', code: 'ATLAS_METHOD_LEVEL_NORMALIZED', message: `${definition.methods.find(method => method.id === id)!.name}等级已按人物与主心法上限调整`, path: `methods.${id}` });
    return level;
  };
  const primaryLevel = clampMethod(primary.id, cap);
  const methods = Object.fromEntries(definition.methods.map(method => [method.id, method.isPrimary ? primaryLevel : clampMethod(method.id, primaryLevel)]));
  const progress = createEmptySectCombatProgressV6(definition.id, path.id, methods);
  progress.meridianDepth = MERIDIAN_LEVELS.filter(level => characterLevel >= level).length as SectCombatProgressV6['meridianDepth'];
  const byLayer = new Map<number, string>();
  for (const id of input.nodeIds ?? []) {
    const node = path.nodes.find(node => node.id === id);
    if (node && !node.automatic && node.layer <= progress.meridianDepth) byLayer.set(node.layer, node.id);
  }
  const selectedNodeIds = connectedMeridianSelection(path, [...byLayer.values()]);
  if (JSON.stringify([...(input.nodeIds ?? [])].sort()) !== JSON.stringify([...selectedNodeIds].sort())) diagnostics.push({ severity: 'warning', code: 'ATLAS_NODE_SELECTION_NORMALIZED', message: '已移除未知、重复、未解锁或未连通的经脉选择' });
  progress.meridianLoadouts.find(loadout => loadout.pathId === path.id)!.nodeIds = selectedNodeIds;
  const automaticNodeIds = path.nodes.filter(node => node.automatic && node.layer <= progress.meridianDepth).map(node => node.id);
  const effectiveNodes = new Set([...selectedNodeIds, ...automaticNodeIds]);
  const compiled = compileCurrentSectCombatV6({ progress, characterLevel });
  const projection = compiled.ok ? compiled.projection : undefined;
  diagnostics.push(...(compiled.ok ? compiled.projection.diagnostics : compiled.diagnostics));
  const effective = new Map(projection?.skills.map(skill => [skill.id, skill]) ?? []);
  const numericSource = createUnit({ id: 'sect-atlas', name: definition.name, side: 0, kind: 'player', level: characterLevel,
    attrs: { hp: 1, speed: 0, physicalAtk: 0, physicalDef: 0 }, skills: projection?.activeSkillIds ?? [], passives: projection?.passiveSkillIds ?? [], skillLevels: projection?.skillLevels ?? {} }, 0);
  const sourceApplies = (source: SectAtlasSource) => (!source.pathId || source.pathId === path.id) && (!source.nodeId || effectiveNodes.has(source.nodeId));
  return {
    ok: compiled.ok, characterLevel, progress, selectedNodeIds, automaticNodeIds, diagnostics,
    nodeOptions: path.nodes.map(node => ({ id: node.id, selected: node.automatic ? effectiveNodes.has(node.id) : selectedNodeIds.includes(node.id), automatic: !!node.automatic,
      selectable: !node.automatic && node.layer <= progress.meridianDepth && canSelectMeridianNode(path, selectedNodeIds, node),
      requirement: node.layer > progress.meridianDepth ? `人物${MERIDIAN_LEVELS[node.layer - 1]}级解锁` : node.automatic ? '本层解锁后自动获得' : canSelectMeridianNode(path, selectedNodeIds, node) ? '' : '需与前一层已选节点连通' })),
    skills: atlasEntry(definition).skills.map(skill => {
      const actual = effective.get(skill.id) ?? skill.definition;
      const available = effective.has(skill.id);
      const level = methods[skill.sourceMethodId];
      const changes: SectAtlasSource[] = [
        ...(path.patches?.some(patch => patch.skillId === skill.id) ? [{ type: 'path-patch' as const, pathId: path.id, label: `${path.name}·流派调整` }] : []),
        ...path.nodes.filter(node => effectiveNodes.has(node.id) && node.patches?.some(patch => patch.skillId === skill.id)).map(node => ({ type: 'node-patch' as const, pathId: path.id, nodeId: node.id, label: `${path.name}·第${node.layer}层 ${node.name}` })),
      ];
      return { ...skill, definition: structuredClone(actual), description: combatV6SkillDetails([actual], definition.statuses)[actual.id].description, skillLevel: level, available,
        requirement: available ? '' : level < skill.unlockMethodLevel ? `所属心法${skill.unlockMethodLevel}级解锁` : !skill.sources.some(sourceApplies) ? '需选择对应流派或经脉节点' : '当前流派或经脉替换了此技能',
        numericFields: numericFields(actual, level, '', '', numericSource), changedFields: changedFields(skill.definition, actual), changeSources: [...skill.sources.filter(sourceApplies), ...changes] };
    }),
    panel: structuredClone(projection?.panel ?? []), resources: structuredClone(projection?.resources ?? []),
  };
}

export function toggleSectAtlasNode(input: SectAtlasBuildInput, nodeId: string): SectAtlasBuildPreview {
  const current = previewSectAtlasBuild(input);
  if (!current.nodeOptions.find(node => node.id === nodeId)?.selectable) return current;
  const path = COMBAT_V6_SECT_DEFINITIONS[input.sectId].paths.find(path => path.id === input.pathId)!;
  return previewSectAtlasBuild({ ...input, characterLevel: current.characterLevel, methods: current.progress.methods, nodeIds: toggleMeridianNode(path, current.selectedNodeIds, path.nodes.find(node => node.id === nodeId)!) });
}
