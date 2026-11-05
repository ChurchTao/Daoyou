import {
  effectiveAttrs,
  injuredAllyTargets,
  isStanding,
  selectableAllyTargets,
  skillOf,
} from '@daoyou/combat-core';
import { evalExpr, skillLevelOf } from '@daoyou/combat-core/expr';
import type {
  BattleState,
  CombatV6CommandOptions,
  CombatV6SkillCommandOption,
  EffectWhen,
  Expr,
  ExprEnv,
  SkillDef,
  SkillEffect,
  StatusDef,
  Unit,
} from '@daoyou/combat-core/types';
import { matchesWhen } from '@daoyou/combat-core/when';
import {
  TIANYAN_MARK_KIND,
  TIANYAN_V6_ID,
} from '@daoyou/game-content/sects/tianyan';
import type {
  CombatV6CommandOptionsView,
  CombatV6SkillPreview,
} from '@daoyou/game-domain/combat';
import { observeAutoBattle } from './auto-observation.js';

const percent = (ratio: number) => Math.round(ratio * 1000) / 10;

function statusDescription(status: StatusDef, env: ExprEnv): string {
  const changes = [];
  if (status.blocksSpell) changes.push('无法使用法术');
  else if (status.blocksDamagingSpells) changes.push('无法使用造成伤害的法术');
  for (const [label, physical, spell] of [
    [
      status.consumeAfterDamagingAction ? '下一次造成的' : '造成的',
      status.damageDealtPhysical ?? 1,
      status.damageDealtSpell ?? 1,
    ],
    ['受到的', status.damageTakenPhysical ?? 1, status.damageTakenSpell ?? 1],
  ] as const) {
    const describe = (kind: string, factor: number) =>
      `${label}${kind}伤害${factor < 1 ? '降低' : '提高'} ${percent(Math.abs(factor - 1))}%`;
    if (physical === spell && physical !== 1)
      changes.push(describe('物理和法术', physical));
    else {
      if (physical !== 1) changes.push(describe('物理', physical));
      if (spell !== 1) changes.push(describe('法术', spell));
    }
  }
  // These effects scale an attribute by a ratio. Read the coefficient without
  // reading the chosen enemy's actual panel.
  for (const [attr, label, expression] of [
    ['speed', '速度', status.speedMod],
    ['magicDef', '法术防御', status.attrMods?.magicDef],
    ['physicalAtk', '物理攻击', status.attrMods?.physicalAtk],
    ['magicAtk', '法术攻击', status.attrMods?.magicAtk],
  ] as const) {
    if (typeof expression !== 'string') continue;
    const factor = new RegExp(`^(-?)target\\.${attr}\\*(.+)$`).exec(expression);
    if (!factor) continue;
    const ratio = evalExpr(factor[2], env) * (factor[1] ? -1 : 1);
    if (ratio)
      changes.push(
        `${label}${ratio < 0 ? '降低' : '提高'} ${percent(Math.abs(ratio))}%`,
      );
  }
  return changes.join('、') || status.description?.replace(/。$/, '') || '';
}

function describeStatus(
  status: StatusDef,
  effect: Extract<SkillEffect, { type: 'applyStatus' }>,
  duration: number,
  count: number,
  env: ExprEnv,
) {
  const scope =
    effect.targeting?.side === 'self' || effect.self ? '自身' : '目标';
  if (status.healingPerRound !== undefined)
    return `为至多 ${count} 名最低血线友方施加${status.name}，每回合末基础恢复 ${Math.floor(evalExpr(status.healingPerRound, env))} 点气血，共 ${duration} 次。`;
  if (status.onTick?.ratioOfMaxHp !== undefined) {
    const cap =
      status.onTick.hpCap === undefined
        ? ''
        : `，单次基础上限 ${Math.floor(evalExpr(status.onTick.hpCap, env))} 点`;
    return `对至多 ${count} 名副目标附加${status.name}，每回合末损失 ${percent(status.onTick.ratioOfMaxHp)}% 最大气血${cap}，共 ${duration} 次。`;
  }
  const description = statusDescription(status, env);
  const application = effect.hit === 'seal' ? '尝试施加' : '施加';
  return `对${scope}${application}${status.name}，持续 ${duration} 回合。${description ? `${description}。` : ''}`;
}

function previewSkill(
  actor: Unit,
  skill: SkillDef,
  option: CombatV6SkillCommandOption,
  state: BattleState,
  skills: Map<string, SkillDef>,
  statusDefs: Map<string, StatusDef>,
): CombatV6SkillPreview {
  const source = { ...actor, combatFacts: { ...actor.combatFacts } };
  const currentMark = source.statuses
    .map((status) => statusDefs.get(status.id))
    .find((status) => status?.kind === TIANYAN_MARK_KIND)?.name;
  const targets = option.selectableTargetIds
    .flatMap((id) => {
      const unit = state.units.find((entry) => entry.id === id);
      return unit && isStanding(unit) ? [unit] : [];
    })
    .slice(0, option.targetCount);
  const actionTargetIds = targets.map((target) => target.id);
  const action = {
    sourceId: source.id,
    skillId: skill.id,
    primaryTargetId: actionTargetIds[0],
    targetIds: actionTargetIds,
    initialSourceStatusIds: source.statuses.map((status) => status.id),
    initialStatusIdsByTarget: {},
    initialStatusKindsByTarget: {},
    resourceGains: {},
    hpRestoreGains: {},
    impactDamageByTarget: {},
    failed: false,
  };
  const context = { state, currentAction: action, skills, statusDefs };
  const env = {
    state,
    source,
    skillLevel: skillLevelOf(source, skill.id),
    targets: targets.length,
    actionTargetIds,
    skills,
    statusDefs,
  };
  const value = (expr: Expr | undefined) => evalExpr(expr, env);
  const matches = (when?: EffectWhen, target?: Unit) =>
    matchesWhen(context, when, {
      source,
      target,
      skill,
      skillId: skill.id,
      kind: 'spell',
      origin: 'action-direct',
    });
  const preview: CombatV6SkillPreview = { currentMark, effects: [] };
  if (skill.requirement !== undefined && !value(skill.requirement))
    return preview;

  const changesMark = (effect: SkillEffect) =>
    effect.type === 'applyStatus' &&
    statusDefs.get(effect.statusId)?.kind === TIANYAN_MARK_KIND;
  const nextMark = (skill.successEffects ?? []).flatMap((effect) => {
    if (effect.type !== 'applyStatus' || !matches(effect.when, source))
      return [];
    const status = statusDefs.get(effect.statusId);
    return status?.kind === TIANYAN_MARK_KIND ? [status.name] : [];
  })[0];
  if (nextMark && nextMark !== currentMark) preview.nextMark = nextMark;
  if (!targets.length) return preview;

  const effects = preview.effects;
  for (const effect of [
    ...skill.effects,
    ...(skill.successEffects ?? []).filter((effect) => !changesMark(effect)),
  ]) {
    let recipients = targets;
    if (
      effect.targeting?.side === 'self' ||
      (effect.type === 'applyStatus' && effect.self)
    )
      recipients = [source];
    if (
      effect.targeting?.side === 'ally' &&
      effect.targeting.mode === 'lowestHp'
    ) {
      const allies = selectableAllyTargets(
        source,
        state.units,
        skills,
        statusDefs,
      );
      const injured = effect.targeting.preferInjured
        ? injuredAllyTargets(source, allies, skills, statusDefs)
        : [];
      recipients = (injured.length ? injured : allies)
        .sort(
          (a, b) =>
            a.attrs.hp / a.attrs.maxHp - b.attrs.hp / b.attrs.maxHp ||
            a.slot - b.slot,
        )
        .slice(0, Math.max(1, Math.floor(value(effect.targeting.count ?? 1))));
    }
    const matched = recipients.filter((target) => matches(effect.when, target));
    if (!matched.length) continue;
    switch (effect.type) {
      case 'emitMechanic':
        preview.reactionName = effect.name;
        break;
      case 'modifyFact':
        source.combatFacts[effect.key] = value(effect.value);
        break;
      case 'spellHit':
        effects.push(
          `对${matched.length > 1 ? `至多 ${matched.length} 名` : '一名'}敌人造成法术伤害。`,
        );
        break;
      case 'applyStatus': {
        const status = statusDefs.get(effect.statusId);
        if (status)
          effects.push(
            describeStatus(
              status,
              effect,
              Math.max(1, Math.floor(value(effect.duration))),
              matched.length,
              env,
            ),
          );
        break;
      }
      case 'applyBarrier':
        effects.push(
          `获得或刷新${effect.name}护盾，基础值 ${Math.floor(value(effect.power))} 点，持续 ${Math.floor(value(effect.duration))} 回合。`,
        );
        break;
      case 'heal': {
        const amount = Math.floor(
          value(effect.power) +
            (effect.includeHealPower === false
              ? 0
              : effectiveAttrs(source).healPower),
        );
        const scope =
          effect.targeting?.mode === 'lowestHp'
            ? `至多 ${matched.length} 名最低血线友方`
            : skill.targeting.side === 'self'
              ? '自身'
              : '选定友方';
        const full =
          effect.targeting?.mode === 'lowestHp' &&
          injuredAllyTargets(source, matched, skills, statusDefs).length === 0;
        effects.push(
          `治疗${scope}，基础 ${amount} 点气血${full ? '，当前没有可恢复气血' : ''}。`,
        );
        break;
      }
      case 'restoreMp':
        effects.push(
          `自身最多恢复 ${Math.floor(value(effect.power))} 点法力。`,
        );
        break;
      case 'dispel': {
        const scope = effect.when?.targetSlot === 'primary' ? '主目标' : '目标';
        const categories = effect.categories?.includes('buff')
          ? '可驱散增益'
          : '可驱散的持续伤害或普通减益';
        effects.push(
          `尝试驱散${scope}至多 ${Math.floor(value(effect.maxCount ?? 1))} 个${categories}。`,
        );
        break;
      }
    }
  }

  const modifiers = [
    ...(skill.modifiers ?? []),
    ...source.passives.flatMap((id) => {
      const passive = skillOf(skills, source, id);
      return id.startsWith('tianyan.passive.')
        ? (passive?.modifiers ?? [])
        : [];
    }),
  ];
  const sum = (
    key:
      | 'damageBonus'
      | 'defenseIgnoreAdd'
      | 'barrierDamageBonus'
      | 'sealChanceAdd',
  ) =>
    modifiers.reduce((total, modifier) => {
      const expr = modifier[key];
      // A chosen target can add further modifiers. Do not report a guessed
      // target-dependent value as a guaranteed result before target selection.
      if (typeof expr === 'string' && /\btarget(?:\.|[A-Z])/.test(expr))
        return total;
      return total + (matches(modifier.when) ? value(expr) : 0);
    }, 0);
  const bonus = sum('damageBonus');
  const ignore = sum('defenseIgnoreAdd');
  const barrier = sum('barrierDamageBonus');
  const seal = sum('sealChanceAdd');
  if (bonus)
    effects.push(
      `按当前状态，本次法术直接伤害修正 ${bonus > 0 ? '+' : '−'}${percent(Math.abs(bonus))}%。`,
    );
  if (ignore) effects.push(`本次额外忽视 ${percent(ignore)}% 法术防御。`);
  if (barrier) effects.push(`对护盾额外造成 ${percent(barrier)}% 伤害。`);
  if (seal) effects.push(`本次封印命中提高 ${percent(seal)} 个百分点。`);
  return preview;
}

/** Used only for command options already authorized for the requesting actor. */
export function withCombatV6SkillPreviews(
  state: BattleState,
  skillDefs: readonly SkillDef[],
  statuses: readonly StatusDef[],
  options: CombatV6CommandOptions,
): CombatV6CommandOptionsView {
  const actor = state.units.find((unit) => unit.id === options.unitId);
  if (
    !actor ||
    !options.skills.some((option) =>
      option.skillId.startsWith('tianyan.skill.'),
    )
  )
    return options;
  const skills = new Map(skillDefs.map((skill) => [skill.id, skill]));
  const statusDefs = new Map(statuses.map((status) => [status.id, status]));
  // Recoverable ally HP determines the current healing share. Opponent
  // expressions only get the same redacted observation used by auto commands.
  const observation = observeAutoBattle(state, actor.id, statuses);
  const previewState = {
    ...state,
    units: [
      ...state.units.filter((unit) => unit.side === actor.side),
      ...observation.units.filter((unit) => unit.side !== actor.side),
    ],
  };
  const skillPreviews = Object.fromEntries(
    options.skills.flatMap((option): [string, CombatV6SkillPreview][] => {
      const skill = skillOf(skills, actor, option.skillId);
      if (skill?.school !== TIANYAN_V6_ID) return [];
      return [
        [
          skill.id,
          previewSkill(actor, skill, option, previewState, skills, statusDefs),
        ],
      ];
    }),
  );
  return { ...options, skillPreviews };
}
