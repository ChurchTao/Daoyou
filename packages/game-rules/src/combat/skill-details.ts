import {
  BEAST_COMBO_SKILL_IDS,
  BEAST_SKILL_CONTENT,
} from '@daoyou/game-content/beasts';
import { EffectType, HookName } from '@daoyou/combat-core/enums';
import type {
  SkillDef,
  SkillEffect,
  StatusDef,
} from '@daoyou/combat-core/types';
import { DAO_EQUIPMENT_ARTS_V1 } from '@daoyou/game-content/equipment/special';

const arts = new Map(DAO_EQUIPMENT_ARTS_V1.map((art) => [art.skill.id, art]));
function beastPassiveDescription(skill: SkillDef): string | undefined {
  const effect = BEAST_SKILL_CONTENT.find(
    (entry) => entry.id === skill.id,
  )?.effect;
  if (!effect) return;
  const percent = (value: number) => Math.round(value * 100);
  switch (effect.type) {
    case 'flight':
      return `命中数值提高 ${percent(effect.hitFactor - 1)}%，躲避数值提高 ${percent(effect.dodgeFactor - 1)}%；受到物理攻击时，对方最终命中概率再降低 ${percent(effect.evasionChance)}%。不影响法术、固定伤害或显式必中攻击，不增加速度。`;
    case 'fortune':
      return `受到物理或法术暴击时，暴击的额外伤害降低 ${percent(1 - effect.criticalExtraFactor)}%；基础2倍暴击变为 ${1 + effect.criticalExtraFactor} 倍。不降低暴击概率，不影响招财进宝的专属爆发。`;
    case 'coordination':
      return `本方每有一种与自身不同的在场存活灵兽，增加自身等级 ÷ ${effect.levelDivisor} 的物理伤害结果，按异种数合计后向下取整；同种、后备、倒地及离场不计。同时所受封印命中概率提高 ${percent(effect.sealTakenFactor - 1)}%，无异种同伴时也有此代价。`;
    case 'sweepingStrike':
      return `消耗当前气血 ${percent(effect.hpRatio)}%（向下取整，至少保留1点气血），必中攻击指定目标及另两名随机敌人。主目标造成普通物理伤害的 ${percent(effect.primaryFactor)}%，次目标各 ${percent(effect.secondaryFactor)}%；不触发普攻连击、毒性或嗜血追击。`;
    case 'spiritSurge':
      return `消耗向下取整的自身等级 ÷ ${effect.costMpLevelDivisor} + ${effect.costMpBase} 法力，用一次行动激发灵息；法攻增加完整魔力属性 ÷ ${effect.magicDivisor}，向下取整，持续 ${effect.duration} 回合，施放回合计入。不叠层，重施刷新，可被驱散并受灵效绵长影响；不纳入观照万象攻击组合。`;
    case 'spiritConversion':
      return `法防额外增加完整魔力属性 × max(0, 成长 − ${effect.growthSubtract})；魔力不再提供基础法攻，对法力上限的贡献降为 ${percent(effect.manaContributionFactor)}%。保留等级、资质及其他技能的独立贡献，不改变永久属性。`;
    case 'windPursuit':
      return `当前有效速度高于目标时，物理、法术与主动固定伤害提高 ${percent(effect.factor - 1)}%，群攻逐目标判断；速度相同不触发，无物种限制。连击、反击等派生打击适用，反震与周期伤害不再次增幅。`;
    case 'goldenStrike':
      return `普攻或直接主动物理命中时，有 ${percent(effect.chance)}% 概率造成普通非暴击伤害的 ${effect.factor} 倍，并跳过必杀判定；未触发则正常判定必杀。普攻连击追加可独立触发，反击、追击、反震和善报治疗不触发，不使用元宝特效。`;
    case 'eightfoldFlame':
      return `消耗 ${effect.costMp} 法力，法术系数 ${effect.coefficient}，附加威力 ${effect.powerBase} + 技能等级 × ${effect.powerPerLevel}，0级即可攻击至多 ${effect.maxTargets} 名敌人。每个直接命中后有 ${percent(effect.weakenChance)}% 概率随机降低一种属性 ${percent(effect.weakenRatio)}%：物攻、物防、速度或法攻与法防，持续 ${effect.duration} 回合。再次削弱替换类型并刷新，不叠层；可驱散，法术连击追加不再次削弱。`;
    case 'allSeeing':
      return `依随机顺序施展自身已学会的主动攻击技能，不包含观照万象本身。观照万象本身不另耗法力，所调用技能各自按原规则选择目标、消耗法力并结算；法力不足时停止后续施展。冷却 ${effect.cooldownRounds} 回合，无物种或战斗回合门槛。`;
    case 'mountainBreaker':
      return `消耗自身等级 + ${effect.costMpBase} 法力，攻击 1 个目标。本次命中临时增加自身等级 × 2 + 10；伤害按双方物理攻击之差计算，正差增益上限为自身等级 × 8。`;
    case 'karmicRetribution':
      return `消耗自身等级 + ${effect.costMpBase} 法力，攻击 1 个目标。${percent(effect.evilChance)}% 概率触发恶报，造成普通物理伤害的 ${percent(effect.evilFactor)}%；恶报暴击为普通物理伤害的 ${percent(effect.evilFactor * 1.5)}%。其余概率触发善报，为目标恢复普通物理伤害的 ${percent(effect.goodFactor)}%；善报暴击恢复 ${percent(effect.goodFactor * 2)}%。`;
    case 'radiantBarrier':
      return `受到伤害并损失气血时，有 ${percent(effect.chance)}% 概率获得相当于本次损失气血 ${percent(effect.ratio)}% 的护盾；可叠加，最多为自身最大气血的 ${percent(effect.maxHpRatio)}%。护盾每回合末衰减 ${percent(effect.decayRatio)}%，不额外恢复气血。`;
    case 'constitutionGrowthHp':
      return `气血上限额外增加体质 × 成长 × ${effect.multiplier}，向下取整；不改变其他属性，也不提供气血恢复。`;
    case 'bloodthirstyPursuit':
      return `普通攻击（含连击）使目标气血降为 0 后，向另一个存活敌人追加一次物理攻击；即使目标随后涅槃重生，也可触发。追击造成正常物理伤害的 ${percent(effect.factor)}%，可以暴击，每回合最多触发一次，不继续追击。`;
    case 'surpriseSpell':
      return `第 2 回合或以后入场时，本次入场后首次主动法术伤害提高 ${percent(effect.factor - 1)}%；初始出战不触发，同一次群法与灵法连击均获得加成，后续法术不再加成。`;
    case 'magicAttributeBoost':
      return `法术攻击额外增加完整魔力属性 × ${effect.multiplier}，向下取整；不按法力上限或当前法力计算。`;
    case 'strengthGrowthTradeoff':
      return `物理攻击额外增加完整力量属性 × 成长 × ${effect.attackMultiplier}，物理防御降低完整力量属性 × ${effect.defenseMultiplier}；两项分别向下取整，不改变永久属性。`;
    case 'spellDefense':
      return `消耗向下取整的自身等级 ÷ ${effect.costMpLevelDivisor} + ${effect.costMpBase} 法力，施加自身护体灵罡，持续 ${effect.duration} 回合。所受法术伤害降低 ${percent(1 - effect.takenFactor)}%，与御法等减伤倍率相乘；不减免物理或固定伤害。`;
    case 'swiftStrike':
      return `消耗向下取整的自身等级 ÷ ${effect.costMpLevelDivisor} + ${effect.costMpBase} 法力，必中攻击 1 个目标。固定伤害为完整力量属性 × ${effect.strengthMultiplier} + 当前有效速度 ÷ ${effect.speedDivisor}，人物单位受到的伤害为 ${percent(effect.playerFactor)}%；不暴击。`;
    case 'barrierBreaker':
      return `消耗自身等级 + ${effect.costMpBase} 法力，必中攻击 1 个目标。忽略铁骨或高级铁骨增加的物理防御，仍计算目标基础防御；目标执行防御指令时，基础物理伤害提高至 ${percent(effect.defendFactor)}%，随后附加自身等级 × ${effect.powerPerLevel} 威力。`;
    case 'mindShatter':
      return `消耗向下取整的自身等级 ÷ ${effect.costMpLevelDivisor} + ${effect.costMpBase} 法力，必中攻击 1 个目标，造成普通物理伤害的 ${percent(effect.physicalFactor)}%。目标同时损失（本次实际气血损失 ÷ ${effect.mpDamageDivisor} + 自身等级 ÷ ${effect.mpLevelDivisor}）× ${effect.mpDamageFactor} 法力，向下取整；下一回合再损失完整力量属性 ÷ ${effect.periodicStrengthDivisor} + ${effect.periodicBase} 法力，向下取整。持续损耗不叠加，保留较高值。`;
    case 'unanticipated':
      return `使用本回合己方灵兽尚未施展过的技能时，伤害结果提高 ${percent(effect.factor - 1)}%；同一次群体攻击与灵法连击均获得加成，每回合重新判定。不限物种，不限入场回合。`;
    case 'ghost':
      return `死亡后第 ${effect.delay} 个回合开始复起，气血恢复至可恢复上限。无法接受普通气血恢复，免疫控制、减益和持续伤害；涅槃重生失效。被镇魂击杀后无法复起，等待期间不计存活。`;
    case 'exorcism':
      return `对灵魂体目标的物理和法术伤害提高 ${percent(effect.factor - 1)}%，击杀后阻止其本次复起。`;
    case 'denial':
      return `免疫控制、减益和持续伤害，无法获得增益；灵魂体、涅槃重生、定神（均含高级版）及解厄、高级避厄失效。受到灵魂体造成的物理与法术伤害增加 ${percent(effect.ghostDamageFactor - 1)}%。${effect.spellFactor < 1 ? `所受法术伤害降低 ${percent(1 - effect.spellFactor)}%。` : ''}`;
    case 'poison':
      return `普通攻击使目标实际损失气血且目标仍存活时，有 ${percent(effect.chance)}% 概率使其中毒 ${effect.duration} 回合；中毒期间每回合损失其最大气血的 ${percent(effect.hpRatio)}% 和最大法力的 ${percent(effect.mpRatio)}%。${effect.immune ? '自身免疫此毒。' : ''}`;
    case 'miracle':
      return `${effect.immune ? '免疫' : '回合末解除'}可驱散的控制、减益和持续伤害状态，不包含禁复活。`;
    case 'concentration':
      return `免疫可驱散的控制状态（不含禁复活），自身造成的物理伤害降低 ${percent(1 - effect.physicalFactor)}%。${effect.dodgeBonus ? `躲避增加 ${effect.dodgeBonus} 点。` : ''}`;
    case 'eternity':
      return `获得可延长增益时持续时间增加 ${percent(effect.factor - 1)}%，向下取整，最多额外 ${effect.maxExtra} 回合；不延长隐身、控制与特殊入场效果。`;
    case 'stealth':
      return `每场首次出战时隐身 ${effect.minDuration}～${effect.maxDuration} 回合（含入场回合），使没有灵觉或看破效果的敌人无法攻击自身。期间不能施法，自身造成的物理伤害降低 ${percent(1 - effect.physicalFactor)}%；召回后不重新触发。`;
    case 'perception':
      return `能看破隐身，攻击隐身目标。${effect.dodgeBonus ? `躲避增加 ${effect.dodgeBonus} 点。` : ''}`;
    case 'spellRepeat':
      return `施放直接造成伤害的法术后，有 ${percent(effect.chance)}% 概率对原目标追加同一法术；追加伤害为正常值的 ${percent(effect.factor)}%，不额外消耗法力，也不会再次触发追加。`;
    case 'spellFluctuation':
      return `法术伤害在正常值的 ${percent(effect.min)}%～${percent(effect.max)}% 之间波动，取代通常的法伤波动范围。${effect.suppressReflection ? '法术攻击不触发灵法反震。' : ''}`;
    case 'groupSpell':
      return `消耗 ${effect.costMp} 法力，初始攻击 1 个目标；每满 ${effect.levelsPerTarget} 级多攻击 1 个，最多 ${effect.maxTargets} 个。法术伤害系数为 ${effect.coefficient}，附加威力为 ${effect.powerBase} + ${effect.powerPerLevel === 1 ? '自身等级' : `自身等级 × ${effect.powerPerLevel}`}；没有元素克制。`;
    case 'spellHit':
      return `消耗 ${effect.costMp} 法力，攻击 1 个目标。法术伤害系数为 ${effect.coefficient}，附加威力为 ${effect.powerBase} + ${effect.powerPerLevel === 1 ? '自身等级' : `自身等级 × ${effect.powerPerLevel}`}；没有元素克制。`;
    case 'parry':
      return `每回合首次被物理攻击命中时，伤害降低 ${percent(1 - effect.factor)}%。即使护盾挡下伤害，也会消耗本回合的招架机会；蛮力可无视招架，且不消耗这次机会。`;
    case 'defenseTraining':
      return `物理防御提高自身等级 × ${effect.perLevel}，向下取整；自身法术伤害降低 ${percent(1 - effect.spellFactor)}%。`;
    case 'strengthTraining':
      return `物理攻击提高自身等级 × ${effect.perLevel}，向下取整；忽略招架减伤，攻击拥有铁骨或高级铁骨的目标时物理伤害降低 ${percent(1 - effect.versusDefenseFactor)}%。`;
    case 'wisdom':
      return `法术技能的法力消耗降低 ${percent(1 - effect.factor)}%，与其他减耗倍率相乘后向下取整；不影响物理技能和捕捉。`;
    case 'sneakAttack':
      return `物理伤害提高 ${percent(effect.factor - 1)}%，物理攻击不触发目标的反击与反震。`;
    case 'spellResistance':
      return `受到的法术伤害降低 ${percent(1 - effect.takenFactor)}%，自身造成的物理伤害降低 ${percent(1 - effect.physicalFactor)}%；不减免固定伤害。`;
    case 'lifesteal':
      return `物理攻击使目标实际损失气血后，自身恢复本次损失气血的 ${percent(effect.ratio)}%，向下取整且不超过可恢复上限。连击追加攻击与反击不触发噬血，也无法从灵魂体目标噬血。`;
    case 'reflection':
      return `受到${effect.kind === 'physical' ? '物理' : '法术'}攻击并实际损失气血时，有 ${percent(effect.chance)}% 概率对攻击者造成相当于本次气血损失 ${percent(effect.ratio)}% 的固定伤害，最低 1 点。追加攻击不触发反震。${effect.kind === 'physical' ? '阻止敌方连击，偷袭不解除此限制。' : '不阻止物理连击。'}`;
    case 'divineRevival':
      return `受到致命伤害时，有 ${percent(effect.chance)}% 概率复生，恢复至最大气血的 ${percent(effect.hpRatio)}%，受可恢复上限和禁复活状态限制。每次致命伤害独立判定，成功不计死亡；持有灵魂体或绝灵时不生效。`;
    case 'counter':
      return `受到物理攻击并损失气血时，有 ${percent(effect.chance)}% 概率反击，攻击系数为普攻的 ${percent(effect.coefficient)}%。反击与连击追加攻击不会再次触发反击。`;
    case 'critical':
      return `${effect.kind === 'physical' ? '物理' : '法术'}暴击率提高 ${percent(effect.chance)}%，暴击伤害倍率不变。`;
    case 'regeneration':
      return `每回合结束时恢复${effect.resource === 'hp' ? '气血' : '法力'}，数值为自身等级${effect.levelDivisor === 1 ? '' : `的 1/${effect.levelDivisor}`}，向下取整，不超过上限；死亡或未出战时不生效。`;
    case 'spellBoost':
      return `造成的法术伤害提高 ${percent(effect.factor - 1)}%。`;
    case 'speed':
      return `自身速度${effect.factor >= 1 ? '提高' : '降低'} ${percent(Math.abs(effect.factor - 1))}%。与其他速度倍率相乘。`;
  }
}
function beastComboDescription(skill: SkillDef): string | undefined {
  if (!BEAST_COMBO_SKILL_IDS.includes(skill.id)) return;
  const hook = skill.hooks?.find((entry) => entry.on === HookName.AfterHit);
  if (typeof hook?.chance !== 'number') return;
  const effect = BEAST_SKILL_CONTENT.find(
    (entry) => entry.id === skill.id,
  )?.effect;
  if (effect?.type !== 'combo') return;
  return `普通攻击命中后，有 ${Math.round(hook.chance * 100)}% 概率向原目标追加一次普攻；自身所有物理伤害降低 ${Math.round((1 - effect.physicalFactor) * 100)}%。目标拥有反震或高级反震时不触发，偷袭不解除此限制。`;
}
const effectLabels: Record<SkillEffect['type'], string> = {
  invokeSkill: '依规则施展指定神通',
  invokeAttackSkills: '依次施展已学主动攻击技能',
  repeat: "连续触发效果",
  modifyFact: "心念流转",
  modifyStatusDuration: "调整状态持续",
  modifyCooldown: '调整冷却',
  loseHp: '损失气血',
  physicalHit: '造成物理伤害',
  spellHit: '造成法术伤害',
  fixedHit: '造成固定伤害',
  heal: '治疗气血',
  restoreHp: '恢复气血',
  restoreMp: '恢复法力',
  revive: '复起目标',
  applyStatus: '施加状态',
  removeStatus: '移除状态',
  copyStatus: '复制状态',
  emitMechanic: '触发技能机制',
  dispel: '驱散状态',
  skipNextAction: '下一次行动休息',
  damageMp: '削减法力',
  wound: '造成伤势',
  removeWound: '恢复伤势',
  applyBarrier: '获得护盾',
  modifyStrike: '调整伤害',
  modifyDefenseIgnore: '调整忽视防御',
  modifyHeal: '调整治疗',
  modifyBarrier: '调整护盾',
  modifyWound: '调整伤势',
  setCrit: '必定暴击',
  modifyResource: '调整战斗资源',
  modifyChance: '调整触发概率',
  clearSkipNextAction: '取消休息',
  randomBranch: '随机触发效果',
};

/** Public qualitative preview, deliberately excludes formulas and private runtime state. */
export function combatV6SkillDetails(
  skills: SkillDef[],
  statuses: StatusDef[],
  options: { includeBeastFlavor?: boolean } = {},
) {
  const names = new Map(statuses.map((status) => [status.id, status.name]));
  const statusTraits = (status: StatusDef | undefined): string[] => {
    if (!status) return [];
    const traits: string[] = [];
    if (status.blocksDamagingSpells)
      traits.push('禁止攻击法术；辅助法术、物理技能及装备器诀不受此项限制');
    if (status.interceptHostileAction)
      traits.push('每回合免疫来自敌方的首次攻击性行为，同一次多段攻击只占一次；群攻对其他单位照常');
    if (status.breakOnDamage) traits.push(status.breakOnDamageAbove === undefined
      ? '实际损失气血后解除；仅损失护盾不解除'
      : `单次实际损失气血超过${status.breakOnDamageAbove}点后解除；不累计多段伤害，仅损失护盾不解除`);
    for (const modifier of status.modifiers ?? []) {
      if (typeof modifier.sealChanceCeilAdd === 'number')
        traits.push(`${modifier.when ? '满足条件时，' : ''}封印命中上限提高${Math.round(modifier.sealChanceCeilAdd * 100)}个百分点，最高100%`);
      if (modifier.sealAlwaysHit)
        traits.push('满足条件时跳过普通封印命中判定；仍受免疫与目标合法性限制');
    }
    return traits;
  };
  const describe = (effect: SkillEffect): string => {
    let text = effectLabels[effect.type];
    if (effect.type === EffectType.ApplyStatus) {
      text = `${effect.self ? '自身' : ''}施加「${names.get(effect.statusId) ?? '状态'}」`;
      if (typeof effect.duration === 'number')
        text += `，持续 ${effect.duration} 回合`;
      const traits = statusTraits(statuses.find(status => status.id === effect.statusId));
      if (traits.length) text += `；${traits.join('；')}`;
    } else if (effect.type === EffectType.ApplyBarrier) {
      text = `获得「${effect.name}」护盾`;
    } else if (effect.type === EffectType.RandomBranch) {
      text = `随机效果：${effect.successEffects.map(describe).join('、')}；或${effect.failureEffects.map(describe).join('、') || '不产生效果'}`;
    } else if (effect.type === EffectType.EmitMechanic) {
      text = effect.name;
    }
    return `${effect.when ? '满足条件时：' : ''}${text}`;
  };
  const authoredDescription = (skill: SkillDef): string | undefined => {
    if (!skill.description) return;
    const lines = [skill.description];
    if (skill.requireHpAboveRatio !== undefined)
      lines.push(`当前气血须高于${Math.round(skill.requireHpAboveRatio * 100)}%。`);
    if (skill.requireHpBelowRatio !== undefined)
      lines.push(`当前气血须低于${Math.round(skill.requireHpBelowRatio * 100)}%。`);
    if (typeof skill.targeting.count === 'number' && skill.targeting.count > 1)
      lines.push(`基础目标数：最多${skill.targeting.count}个。`);
    if (skill.sealChanceCeil !== undefined)
      lines.push(`本技能普通封印命中上限：${Math.round(skill.sealChanceCeil * 100)}%。`);
    if (skill.modifiers?.some(modifier => modifier.sealAlwaysHit))
      lines.push('满足条件时跳过普通封印命中判定；仍受免疫与目标合法性限制。');
    for (const effect of skill.effects) {
      if (effect.type === EffectType.SkipNextAction) lines.push(describe(effect));
      if (effect.type === EffectType.ApplyStatus) {
        const status = statuses.find(s => s.id === effect.statusId);
        if ((status?.category === 'buff' && !status.onExpire && !status.commandPolicy) || statusTraits(status).length)
          lines.push(describe(effect));
      }
    }
    return lines.join('\n');
  };
  return Object.fromEntries(
    skills.map((skill) => [
      skill.id,
      {
        category: arts.has(skill.id) ? ('art' as const) : ('spell' as const),
        description:
          authoredDescription(skill) ??
          arts.get(skill.id)?.description ??
          (skill.capture
            ? '尝试收服野生灵兽，气血越低越容易成功；执行时消耗法力，失败仍消耗。'
            : [
                options.includeBeastFlavor === false
                  ? undefined
                  : BEAST_SKILL_CONTENT.find((entry) => entry.id === skill.id)
                      ?.flavorText,
                beastComboDescription(skill) ??
                  beastPassiveDescription(skill) ??
                  ([
                    ...new Set([
                      ...skill.effects.map(describe),
                      ...(skill.successEffects ?? []).map(
                        (effect) => `施放成功后：${describe(effect)}`,
                      ),
                    ]),
                  ].join('；') ||
                    '被动能力，依技能条件触发。'),
              ]
                .filter(Boolean)
                .join('\n')),
      },
    ]),
  );
}
