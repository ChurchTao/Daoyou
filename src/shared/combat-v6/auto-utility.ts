import type {
  CombatV6CommandOptions,
  Command,
  SkillDef,
  SkillEffect,
  StatusDef,
  Unit,
} from '../engine/combat-v6/core';
import { evalExpr, skillLevelOf } from '../engine/combat-v6/core/expr';
import { matchesWhen, targetStatusStacks } from '../engine/combat-v6/core/when';
import { daoyouRulesetV6 } from '../engine/combat-v6/rules-daoyou';
import type { AutoObservation } from './auto-observation';
import { AUTO_POLICIES, type AutoPolicy } from './auto-policy';

type Benefits = {
  offense: number;
  survival: number;
  control: number;
  economy: number;
};
export type AutoCandidate = {
  command: Command;
  score: number;
  benefits: Benefits;
  notes: string[];
  intents: AutoIntent[];
};
export type AutoIntent = {
  targetId: string;
  damage: number;
  healing: number;
  statuses: string[];
  revive: boolean;
};
const empty = (): Benefits => ({
  offense: 0,
  survival: 0,
  control: 0,
  economy: 0,
});
const ratio = (unit: Unit) => unit.attrs.hp / Math.max(1, unit.attrs.maxHp);
const stable = (a: Unit, b: Unit) =>
  a.slot - b.slot || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const alive = (unit: Unit) =>
  !unit.flags.dead && !unit.flags.downed && !unit.flags.escaped;

/** Pure, bounded one-action estimates. No battle state, command queue or RNG enters here. */
export function rankAutoActions(
  observation: AutoObservation,
  sourceId: string,
  skills: readonly SkillDef[],
  statusDefs: readonly StatusDef[],
  options: CombatV6CommandOptions,
  policy: AutoPolicy = 'balanced',
  intents: readonly AutoIntent[] = [],
): AutoCandidate[] {
  const source = observation.units.find((unit) => unit.id === sourceId)!;
  const definitions = new Map(statusDefs.map((status) => [status.id, status]));
  const weights = AUTO_POLICIES[policy];
  const candidates: AutoCandidate[] = [];
  const formulas = daoyouRulesetV6.formulas;
  // matchesWhen only reads the round, visible units and definitions; never a live context.
  const context = {
    statusDefs: definitions,
    state: { round: observation.round },
  };
  const planned = (target: Unit) =>
    intents.filter((intent) => intent.targetId === target.id);
  const taken = (
    target: Unit,
    key: 'damageTakenPhysical' | 'damageTakenSpell' | 'healTaken' | 'healDealt',
  ) =>
    target.statuses.reduce(
      (factor, status) => factor * (definitions.get(status.id)?.[key] ?? 1),
      1,
    );
  function damageValue(target: Unit, amount: number, cannotKill = false) {
    if (!alive(target)) return 0;
    const hp = Math.max(
      1,
      target.attrs.hp - planned(target).reduce((n, i) => n + i.damage * 0.5, 0),
    );
    const effective = Math.min(hp, Math.max(0, amount));
    return (
      (effective / Math.max(1, target.attrs.maxHp)) * 100 +
      (!cannotKill && amount >= hp ? 25 : 0)
    );
  }
  function evaluate(
    skill: SkillDef,
    selected: Unit[],
  ): { benefits: Benefits; notes: string[]; intentions: AutoIntent[] } {
    const benefits = empty();
    const intentions: AutoIntent[] = [];
    const notes = new Set<string>(['未知属性按观察者基线估算；不推演被动连锁']);
    function effects(
      values: readonly SkillEffect[],
      initial: Unit[],
      probability = 1,
    ) {
      for (const effect of values) {
        let targets = initial;
        if (effect.type === 'applyStatus' && effect.self) targets = [source];
        if (effect.targeting) {
          const spec = effect.targeting;
          targets = observation.units.filter(
            (target) =>
              !target.flags.escaped &&
              !target.flags.dead &&
              (!target.flags.downed || spec.includeDowned) &&
              (spec.side === 'self'
                ? target.id === source.id
                : spec.side === 'ally'
                  ? target.side === source.side
                  : spec.side === 'enemy'
                    ? target.side !== source.side
                    : true),
          );
          if (spec.mode !== 'all' && spec.side !== 'self') {
            targets = targets
              .sort(
                (a, b) =>
                  Number(selected.includes(b)) - Number(selected.includes(a)) ||
                  stable(a, b),
              )
              .slice(
                0,
                Math.max(
                  1,
                  evalExpr(spec.count ?? 1, {
                    source,
                    skillLevel: skillLevelOf(source, skill.id),
                    targets: initial.length,
                  }),
                ),
              );
          }
        }
        targets = targets.filter((target) =>
          matchesWhen(context, effect.when, {
            source,
            target,
            skill,
            skillId: skill.id,
            isPrimary: target.id === selected[0]?.id,
          }),
        );
        if (effect.type === 'randomBranch') {
          const chance = Math.max(
            0,
            Math.min(
              1,
              evalExpr(effect.chance, {
                source,
                target: targets[0],
                skillLevel: skillLevelOf(source, skill.id),
                targets: selected.length,
              }),
            ),
          );
          effects(effect.successEffects, targets, probability * chance);
          effects(effect.failureEffects, targets, probability * (1 - chance));
          continue;
        }
        for (const target of targets) {
          const env = {
            source,
            target,
            skillLevel: skillLevelOf(source, skill.id),
            targets: selected.length,
            targetStatusStacks: targetStatusStacks(
              context,
              effect.when,
              target,
            ),
          };
          const value = (expr: number | string | undefined) =>
            evalExpr(expr, env);
          const friendly = target.side === source.side;
          let offense = 0,
            survival = 0,
            control = 0;
          const intent: AutoIntent = {
            targetId: target.id,
            damage: 0,
            healing: 0,
            statuses: [],
            revive: false,
          };
          if (effect.type === 'modifyResource') {
            // This primitive always changes the caster, once per action.
            if (target !== targets[0]) continue;
            const resource = source.resources.find(
              (r) => r.id === effect.resourceId,
            );
            if (resource) {
              const amount =
                effect.mode === 'set'
                  ? value(effect.amount) - resource.current
                  : value(effect.amount);
              const capped =
                amount > 0 && effect.maxGainPerAction !== undefined
                  ? Math.min(amount, value(effect.maxGainPerAction))
                  : amount;
              const gain = Math.max(
                -resource.current,
                Math.min(resource.max - resource.current, capped),
              );
              benefits.economy -=
                ((probability * gain) / Math.max(1, resource.max)) * 30;
            }
            continue;
          }
          if (
            effect.type === 'physicalHit' ||
            effect.type === 'spellHit' ||
            effect.type === 'fixedHit'
          ) {
            const kind =
              effect.type === 'physicalHit'
                ? 'physical'
                : effect.type === 'spellHit'
                  ? 'spell'
                  : 'fixed';
            const hits = Math.max(1, Math.min(20, value(effect.hits ?? 1)));
            let damage = 0;
            for (let hit = 0; hit < hits; hit++) {
              const coeff = Array.isArray(effect.coeff)
                ? (effect.coeff[Math.min(hit, effect.coeff.length - 1)] ?? 1)
                : (effect.coeff ?? 1);
              damage += formulas.baseDamage({
                source,
                target,
                kind,
                family:
                  effect.formula ??
                  skill.formula ??
                  ('trueDamage' in effect && effect.trueDamage
                    ? 'fixed'
                    : kind),
                coeff,
                power: value(effect.power),
                fury: false,
                skillLevel: env.skillLevel,
                schoolTerm: skill.schoolTerm,
                splash: skill.splash,
                targetCount: selected.length,
              });
            }
            const chance =
              kind === 'physical'
                ? formulas.physicalHitChance(source, target)
                : kind === 'spell'
                  ? formulas.spellHitChance(source, target)
                  : 1;
            damage *=
              kind === 'physical'
                ? taken(target, 'damageTakenPhysical')
                : kind === 'spell'
                  ? taken(target, 'damageTakenSpell')
                  : 1;
            offense =
              (friendly ? -1 : 1) *
              damageValue(target, damage * chance, effect.cannotKill);
            intent.damage = damage * chance * probability;
          } else if (
            effect.type === 'revive' ||
            (effect.type === 'restoreHp' && effect.revive && !alive(target))
          ) {
            if (
              (target.flags.downed || target.flags.dead) &&
              !target.flags.escaped &&
              !target.statuses.some((s) => definitions.get(s.id)?.blocksRevive)
            ) {
              const hp =
                effect.type === 'restoreHp'
                  ? value(effect.power) / Math.max(1, target.attrs.maxHp)
                  : effect.hpRatio === undefined
                    ? value(effect.hp) / Math.max(1, target.attrs.maxHp)
                    : value(effect.hpRatio);
              survival =
                (friendly ? 1 : -1) *
                (25 + Math.min(1, Math.max(0, hp)) * 60) *
                (planned(target).some((i) => i.revive) ? 0.25 : 1);
              intent.revive = probability >= 0.5;
            }
          } else if (effect.type === 'heal' || effect.type === 'restoreHp') {
            if (alive(target)) {
              const incoming = planned(target).reduce(
                (n, i) => n + i.healing * 0.5,
                0,
              );
              const available = Math.max(
                0,
                target.attrs.maxHp - target.wound - target.attrs.hp - incoming,
              );
              const power =
                value(effect.power) +
                (effect.type === 'heal' ? source.attrs.healPower : 0);
              const adjustedPower =
                effect.type === 'heal'
                  ? power *
                    taken(target, 'healTaken') *
                    taken(source, 'healDealt')
                  : power;
              const healing = Math.min(available, Math.max(0, adjustedPower));
              survival =
                (((friendly ? 1 : -1) * healing) /
                  Math.max(1, target.attrs.maxHp)) *
                100 *
                (1 + 3 * (1 - ratio(target)));
              intent.healing = healing * probability;
            }
          } else if (effect.type === 'removeWound') {
            survival =
              (((friendly ? 1 : -1) *
                Math.min(target.wound, Math.max(0, value(effect.power)))) /
                Math.max(1, target.attrs.maxHp)) *
              50;
          } else if (effect.type === 'applyStatus') {
            const def = definitions.get(effect.statusId);
            const duplicate = target.statuses.some(
              (s) => s.id === effect.statusId || (def && s.kind === def.kind),
            );
            if (!duplicate && alive(target)) {
              const duration = Math.max(0, Math.min(3, value(effect.duration)));
              const chance =
                effect.hit === 'seal'
                  ? formulas.sealHitChance(
                      source,
                      target,
                      env.skillLevel,
                      skill.sealBase,
                    )
                  : 1;
              const harmful =
                def?.category === 'control' ||
                def?.category === 'debuff' ||
                def?.category === 'dot' ||
                def?.blocksAction ||
                def?.blocksPhysical ||
                def?.blocksSpell;
              const sign = harmful ? (friendly ? -1 : 1) : friendly ? 1 : -1;
              const coordination = planned(target).some((i) =>
                i.statuses.includes(effect.statusId),
              )
                ? 0.25
                : 1;
              control =
                sign *
                duration *
                (def?.blocksAction ? 14 : 8) *
                chance *
                coordination;
              if (probability * chance >= 0.5)
                intent.statuses.push(effect.statusId);
              if (!def)
                notes.add(`状态 ${effect.statusId} 缺少定义，使用低置信估值`);
            }
          } else if (
            effect.type === 'dispel' ||
            effect.type === 'removeStatus'
          ) {
            const matched = target.statuses
              .filter((s) => {
                const def = definitions.get(s.id);
                return (
                  (effect.statusIds?.includes(s.id) ||
                    effect.kinds?.includes(s.kind) ||
                    (effect.type === 'dispel' &&
                      def?.category &&
                      effect.categories?.includes(def.category))) &&
                  (effect.type !== 'dispel' ||
                    (def?.dispellable !== false &&
                      !effect.excludeStatusFlags?.some((flag) => def?.[flag]) &&
                      (!effect.includeStatusFlags?.length ||
                        effect.includeStatusFlags.some((flag) => def?.[flag]))))
                );
              })
              .slice(
                0,
                effect.maxCount === undefined
                  ? target.statuses.length
                  : Math.max(0, value(effect.maxCount)),
              );
            for (const status of matched) {
              const def = definitions.get(status.id);
              const harmful =
                def?.category === 'control' ||
                def?.category === 'debuff' ||
                def?.category === 'dot';
              control += (harmful === friendly ? 1 : -1) * 20;
            }
          } else if (effect.type === 'applyBarrier') {
            const existing =
              target.barriers.find((barrier) => barrier.id === effect.id)
                ?.current ?? 0;
            survival =
              (friendly ? 1 : -1) *
              Math.min(
                0.4,
                Math.max(0, value(effect.power) - existing) /
                  Math.max(1, target.attrs.maxHp),
              ) *
              60;
          } else if (effect.type === 'restoreMp') {
            survival =
              (((friendly ? 1 : -1) *
                Math.min(
                  target.attrs.maxMp - target.attrs.mp,
                  Math.max(0, value(effect.power)),
                )) /
                Math.max(1, target.attrs.maxMp)) *
              30;
          } else if (effect.type === 'damageMp' || effect.type === 'wound') {
            offense =
              (friendly ? -1 : 1) *
              Math.min(
                1,
                Math.max(0, value(effect.power)) /
                  Math.max(
                    1,
                    effect.type === 'damageMp'
                      ? target.attrs.maxMp
                      : target.attrs.maxHp,
                  ),
              ) *
              30;
          } else if (effect.type === 'skipNextAction') {
            survival = -15 / Math.max(1, targets.length);
          } else if (effect.type !== 'emitMechanic') {
            notes.add(`效果 ${effect.type} 暂不计额外收益`);
          }
          benefits.offense += probability * offense;
          benefits.survival += probability * survival;
          benefits.control += probability * control;
          intentions.push(intent);
        }
      }
    }
    effects(skill.effects, selected);
    effects(skill.successEffects ?? [], selected);
    return { benefits, notes: [...notes], intentions };
  }
  function add(
    command: Command,
    benefits: Benefits,
    notes: string[] = [],
    intentions: AutoIntent[] = [],
  ) {
    const score =
      benefits.offense * weights.offense +
      benefits.survival * weights.survival +
      benefits.control * weights.control -
      benefits.economy * weights.economy;
    candidates.push({ command, benefits, score, notes, intents: intentions });
  }
  for (const id of options.attackTargetIds) {
    const target = observation.units.find((u) => u.id === id);
    if (!target) continue;
    const damage =
      formulas.baseDamage({
        source,
        target,
        kind: 'physical',
        family: 'physical',
        coeff: 1,
        power: 0,
        fury: false,
      }) *
      formulas.physicalHitChance(source, target) *
      taken(target, 'damageTakenPhysical');
    add(
      { type: 'attack', target: id },
      { ...empty(), offense: damageValue(target, damage) },
      [],
      [{ targetId: id, damage, healing: 0, statuses: [], revive: false }],
    );
  }
  for (const option of options.skills) {
    const skill =
      source.skillOverrides[option.skillId] ??
      skills.find((s) => s.id === option.skillId);
    if (!skill || skill.capture || !option.ready || option.reasons.length)
      continue;
    const pool = option.selectableTargetIds
      .flatMap((id) => observation.units.filter((u) => u.id === id))
      .sort(stable);
    if (!pool.length) continue;
    const count = Math.min(pool.length, option.targetCount);
    const ranked = pool
      .map((unit) => ({ unit, value: evaluate(skill, [unit]).benefits }))
      .sort(
        (a, b) =>
          (b.value.offense - a.value.offense) * weights.offense +
            (b.value.survival - a.value.survival) * weights.survival +
            (b.value.control - a.value.control) * weights.control ||
          stable(a.unit, b.unit),
      );
    // Engine-selected modes cannot be optimized by naming a different first target.
    const groups =
      option.targetMode === 'all'
        ? [pool]
        : option.targetMode === 'random' || option.targetMode === 'lowestDef'
          ? [pool]
          : option.targetMode === 'lowestHp'
            ? [
                [...pool]
                  .sort((a, b) => ratio(a) - ratio(b) || stable(a, b))
                  .slice(0, count),
              ]
            : count === 1
              ? pool.map((target) => [target])
              : [ranked.slice(0, count).map((item) => item.unit)];
    for (const targets of groups) {
      const { benefits, notes, intentions } = evaluate(skill, targets);
      if (option.targetMode === 'random' || option.targetMode === 'lowestDef') {
        const factor = count / pool.length;
        benefits.offense *= factor;
        benefits.survival *= factor;
        benefits.control *= factor;
        for (const intent of intentions) {
          intent.damage *= factor;
          intent.healing *= factor;
          intent.statuses = [];
          intent.revive = false;
        }
        notes.push('引擎选目标，按候选池平均估算');
      }
      benefits.economy +=
        (option.costs.mp / Math.max(1, source.attrs.maxMp)) *
          40 *
          (2 - source.attrs.mp / Math.max(1, source.attrs.maxMp)) +
        (option.costs.hp / Math.max(1, source.attrs.hp)) * 60;
      for (const cost of option.costs.resources) {
        const resource = source.resources.find((r) => r.id === cost.resourceId);
        benefits.economy +=
          (cost.amount / Math.max(1, resource?.max ?? cost.amount)) * 30;
      }
      add(
        {
          type: 'skill',
          skillId: skill.id,
          targets: targets.slice(0, count).map((target) => target.id),
        },
        benefits,
        notes,
        intentions,
      );
    }
  }
  if (options.canDefend)
    add(
      { type: 'defend' },
      { ...empty(), survival: 0.001 + Math.max(0, 0.25 - ratio(source)) * 20 },
    );
  return candidates.sort((a, b) => b.score - a.score);
}
