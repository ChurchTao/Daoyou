import { ElementType, StatusEffect } from '@/types/constants';
import type { Artifact, Cultivator, Skill } from '@/types/cultivator';
import { getStatusLabel } from '@/types/dictionaries';
import { calculateFinalAttributes as calcFinalAttrs } from '@/utils/cultivatorUtils';

export interface TurnUnitSnapshot {
  hp: number;
  mp: number;
  statuses: StatusEffect[];
}

export interface TurnSnapshot {
  turn: number;
  player: TurnUnitSnapshot;
  opponent: TurnUnitSnapshot;
}

export interface BattleEngineResult {
  winner: Cultivator;
  loser: Cultivator;
  log: string[];
  turns: number;
  playerHp: number;
  opponentHp: number;
  timeline: TurnSnapshot[];
}

type UnitId = 'player' | 'opponent';

interface StatusSourceSnapshot {
  id: UnitId;
  name: string;
  spirit: number;
  wisdom: number;
  speed: number;
  willpower: number;
  vitality: number;
  elementMultipliers: Partial<Record<ElementType, number>>;
}

interface StatusInstance {
  remaining: number;
  potency?: number;
  element?: ElementType;
  skillName?: string;
  source?: StatusSourceSnapshot;
}

interface BattleUnit {
  id: UnitId;
  data: Cultivator;
  hp: number;
  mp: number;
  statuses: Map<StatusEffect, StatusInstance>;
  skillCooldowns: Map<string, number>;
}

interface BattleState {
  player: BattleUnit;
  opponent: BattleUnit;
  turn: number;
  log: string[];
  timeline: TurnSnapshot[];
}

const ELEMENT_WEAKNESS: Partial<Record<ElementType, ElementType[]>> = {
  金: ['火', '雷'],
  木: ['金', '雷'],
  水: ['土', '风'],
  火: ['水', '冰'],
  土: ['木', '风'],
  风: ['雷', '冰'],
  雷: ['土', '水'],
  冰: ['火', '雷'],
};

const STATUS_EFFECTS = new Set<StatusEffect>([
  'burn',
  'bleed',
  'poison',
  'stun',
  'silence',
  'root',
  'armor_up',
  'speed_up',
  'crit_rate_up',
  'armor_down',
]);

// 使用统一的属性计算函数（从utils导入）

function getElementMultiplier(
  attacker: Cultivator,
  defender: Cultivator,
  el: ElementType,
): number {
  let mult = 1.0;
  const defenderMainRoot = defender.spiritual_roots[0]?.element;
  if (defenderMainRoot && ELEMENT_WEAKNESS[el]?.includes(defenderMainRoot)) {
    mult *= 1.25;
  }
  return mult;
}

function getRootDamageMultiplier(
  attacker: Cultivator,
  el: ElementType,
): number {
  const root = attacker.spiritual_roots.find((r) => r.element === el);
  if (!root) return 1.0;
  return 1.0 + (root.strength / 100) * 0.5;
}

function getDefenseMultiplier(unit: BattleUnit): number {
  const final = calcFinalAttrs(unit.data).final;
  let reduction = final.vitality / 400;
  if (unit.statuses.has('armor_up')) reduction += 0.15;
  if (unit.statuses.has('armor_down')) reduction -= 0.15;
  reduction = Math.min(Math.max(reduction, 0), 0.7);
  return 1 - reduction;
}

function getCritRate(attacker: BattleUnit): number {
  const final = calcFinalAttrs(attacker.data).final;
  let rate = (final.wisdom - 40) / 200;
  if (attacker.statuses.has('crit_rate_up')) rate += 0.15;
  return Math.min(Math.max(rate, 0.05), 0.6);
}

function calculateSpellBase(
  attacker: BattleUnit,
  defender: BattleUnit,
  power: number,
  element: ElementType,
): { damage: number; isCrit: boolean } {
  const attFinal = calcFinalAttrs(attacker.data).final;

  let damage = power * (1 + attFinal.spirit / 150);
  damage *= getRootDamageMultiplier(attacker.data, element);
  damage *= getElementMultiplier(attacker.data, defender.data, element);

  const critRate = getCritRate(attacker);
  const isCrit = Math.random() < critRate;
  if (isCrit) damage *= 1.8;

  damage *= getDefenseMultiplier(defender);

  return { damage, isCrit };
}

function calculateStatusHitChance(
  attackerPower: number,
  defenderWillpower: number,
): number {
  const baseHit = Math.min(0.95, Math.max(0.35, attackerPower / 100));
  const resist = Math.min(0.7, defenderWillpower / 240);
  return Math.max(0.1, baseHit * (1 - resist));
}

function applyStatus(
  unit: BattleUnit,
  effect: StatusEffect,
  instance: StatusInstance,
): boolean {
  if (!STATUS_EFFECTS.has(effect)) return false;
  unit.statuses.set(effect, instance);
  return true;
}

function tickStatusEffects(unit: BattleUnit, log: string[]): void {
  const toRemove: StatusEffect[] = [];

  for (const [effect, info] of unit.statuses.entries()) {
    if (info.remaining <= 0) {
      toRemove.push(effect);
      continue;
    }

    if (effect === 'burn' || effect === 'bleed' || effect === 'poison') {
      const dmg = calculateDotDamage(effect, info, unit);
      unit.hp -= dmg;
      const descriptor =
        effect === 'burn'
          ? '被烈焰侵蚀'
          : effect === 'bleed'
            ? '伤口难愈'
            : '毒气攻心';
      log.push(
        `${unit.data.name} ${descriptor}，「${describeStatus(effect)}」造成 ${dmg} 点伤害。`,
      );
    }

    const nextRemaining = info.remaining - 1;
    unit.statuses.set(effect, { ...info, remaining: nextRemaining });
    if (nextRemaining <= 0) {
      toRemove.push(effect);
    }
  }

  for (const e of toRemove) unit.statuses.delete(e);
}

function isActionBlocked(unit: BattleUnit): boolean {
  return unit.statuses.has('stun') || unit.statuses.has('root');
}

function canUseSkill(unit: BattleUnit, skill: Skill): boolean {
  if (unit.statuses.has('silence') && skill.type !== 'heal') return false;
  const cd = unit.skillCooldowns.get(skill.id!) ?? 0;
  return cd <= 0;
}

function describeStatus(effect?: StatusEffect | null): string {
  if (!effect) return '';
  return getStatusLabel(effect);
}

function snapshotUnit(unit: BattleUnit): StatusSourceSnapshot {
  const final = calcFinalAttrs(unit.data).final;
  const elementMultipliers: Partial<Record<ElementType, number>> = {};
  for (const root of unit.data.spiritual_roots) {
    elementMultipliers[root.element] = 1.0 + (root.strength / 100) * 0.5;
  }
  return {
    id: unit.id,
    name: unit.data.name,
    spirit: final.spirit,
    wisdom: final.wisdom,
    speed: final.speed,
    willpower: final.willpower,
    vitality: final.vitality,
    elementMultipliers,
  };
}

function calculateDotDamage(
  effect: StatusEffect,
  instance: StatusInstance,
  target: BattleUnit,
): number {
  if (effect !== 'burn' && effect !== 'bleed' && effect !== 'poison') return 0;
  const targetFinal = calcFinalAttrs(target.data).final;
  const baseHp = 80 + targetFinal.vitality;
  const potency = instance.potency ?? 60;
  const sourceSpirit = instance.source?.spirit ?? targetFinal.spirit;
  const element =
    instance.element ??
    (effect === 'burn' ? '火' : effect === 'poison' ? '木' : '金');
  const elementBonus = instance.source?.elementMultipliers?.[element] ?? 1.0;

  let ratio = 0.05;
  if (effect === 'burn') ratio = 0.07;
  else if (effect === 'bleed') ratio = 0.06;

  let damage =
    baseHp * ratio +
    potency * (effect === 'poison' ? 0.25 : 0.2) +
    sourceSpirit * 0.15;
  damage *= elementBonus;
  damage *= getDefenseMultiplier(target);

  return Math.max(1, Math.floor(damage));
}

function logAttackAction(
  attacker: BattleUnit,
  defender: BattleUnit,
  skill: Skill,
  damage: number,
  isCrit: boolean,
  log: string[],
): void {
  if (damage <= 0) {
    log.push(
      `${attacker.data.name} 对 ${defender.data.name} 使用「${skill.name}」，但未能造成有效伤害。`,
    );
    return;
  }
  log.push(
    `${attacker.data.name} 对 ${defender.data.name} 使用「${skill.name}」${
      isCrit ? '（暴击）' : ''
    }，造成 ${damage} 点伤害。`,
  );
}

function logHealAction(
  attacker: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  heal: number,
  log: string[],
): void {
  const targetName = target === attacker ? '自己' : target.data.name;
  if (heal <= 0) {
    log.push(
      `${attacker.data.name} 对 ${targetName} 使用「${skill.name}」，但未能恢复气血。`,
    );
  } else {
    log.push(
      `${attacker.data.name} 对 ${targetName} 使用「${skill.name}」，恢复 ${heal} 点气血。`,
    );
  }
}

function snapshotTurn(
  turn: number,
  player: BattleUnit,
  opponent: BattleUnit,
): TurnSnapshot {
  const buildUnit = (unit: BattleUnit): TurnUnitSnapshot => ({
    hp: unit.hp,
    mp: unit.mp,
    statuses: Array.from(unit.statuses.keys()),
  });

  return {
    turn,
    player: buildUnit(player),
    opponent: buildUnit(opponent),
  };
}

function applyAndLogStatusFromSkill(
  caster: BattleUnit,
  target: BattleUnit,
  skill: Skill,
  log: string[],
): void {
  if (!skill.effect) {
    if (
      skill.type === 'buff' ||
      skill.type === 'control' ||
      skill.type === 'debuff'
    ) {
      log.push(`⚠️ 技能「${skill.name}」未配置可用的状态效果，已跳过。`);
    }
    return;
  }
  if (!STATUS_EFFECTS.has(skill.effect)) {
    log.push(
      `⚠️ 技能「${skill.name}」配置了未知效果「${skill.effect}」，请检查设定。`,
    );
    return;
  }

  const duration = skill.duration ?? (skill.type === 'control' ? 1 : 2);
  const label = describeStatus(skill.effect);
  const instance: StatusInstance = {
    remaining: duration,
    potency: skill.power,
    element: skill.element,
    skillName: skill.name,
    source: snapshotUnit(caster),
  };

  const appliesToSelf = skill.target_self === true || skill.type === 'buff';
  const recipient = appliesToSelf ? caster : target;

  if (appliesToSelf) {
    const applied = applyStatus(recipient, skill.effect, instance);
    if (applied) {
      log.push(
        `${caster.data.name} 使用「${skill.name}」，获得「${label}」状态（持续 ${duration} 回合）。`,
      );
    }
    return;
  }

  const defFinal = calcFinalAttrs(recipient.data).final;
  const hitChance = calculateStatusHitChance(skill.power, defFinal.willpower);
  const hit = Math.random() < hitChance;

  if (hit) {
    applyStatus(recipient, skill.effect, instance);
    log.push(
      `${recipient.data.name} 被「${skill.name}」影响，陷入「${label}」状态（持续 ${duration} 回合）。`,
    );
  } else {
    log.push(
      `${recipient.data.name} 神识强大，抵抗了「${skill.name}」试图施加的「${label}」状态。`,
    );
  }
}

function executeSkill(
  attacker: BattleUnit,
  defender: BattleUnit,
  skill: Skill,
  state: BattleState,
): void {
  const log = state.log;
  const finalAtt = calcFinalAttrs(attacker.data).final;
  const finalDef = calcFinalAttrs(defender.data).final;

  // 闪避判定
  if (
    skill.type === 'attack' ||
    skill.type === 'control' ||
    skill.type === 'debuff'
  ) {
    const speedBonus = defender.statuses.has('speed_up') ? 20 : 0;
    const evasion = Math.min(0.3, (finalDef.speed + speedBonus) / 350);
    if (Math.random() < evasion) {
      log.push(
        `${defender.data.name} 闪避了 ${attacker.data.name} 的「${skill.name}」！`,
      );
      attacker.skillCooldowns.set(skill.id!, skill.cooldown);
      return;
    }
  }

  if (skill.type === 'attack') {
    const { damage, isCrit } = calculateSpellBase(
      attacker,
      defender,
      skill.power,
      skill.element,
    );
    const dmgInt = Math.max(0, Math.floor(damage));
    defender.hp -= dmgInt;
    logAttackAction(attacker, defender, skill, dmgInt, isCrit, log);
  } else if (skill.type === 'debuff' || skill.type === 'control') {
    if (skill.power > 0) {
      const { damage, isCrit } = calculateSpellBase(
        attacker,
        defender,
        skill.power * 0.7,
        skill.element,
      );
      const dmgInt = Math.max(0, Math.floor(damage));
      defender.hp -= dmgInt;
      logAttackAction(attacker, defender, skill, dmgInt, isCrit, log);
    } else {
      log.push(
        `${attacker.data.name} 对 ${defender.data.name} 使用「${skill.name}」，试图扭转战局。`,
      );
    }
  } else if (skill.type === 'heal') {
    const target = skill.target_self === false ? defender : attacker;
    const targetFinal = calcFinalAttrs(target.data).final;
    const maxHp = 100 + targetFinal.vitality * 5;
    const rawHeal = skill.power * (1 + finalAtt.spirit / 160);
    const healInt = Math.max(0, Math.floor(rawHeal));
    target.hp = Math.min(target.hp + healInt, maxHp);
    logHealAction(attacker, target, skill, healInt, log);
  } else if (skill.type === 'buff') {
    log.push(
      `${attacker.data.name} 引导灵力，施展「${skill.name}」，强化自身。`,
    );
  }

  applyAndLogStatusFromSkill(attacker, defender, skill, log);

  // 灵力消耗
  if (typeof skill.cost === 'number' && skill.cost > 0) {
    attacker.mp = Math.max(0, attacker.mp - skill.cost);
  }

  // 装备 on_hit_add_effect 触发
  if (
    skill.type === 'attack' ||
    skill.type === 'control' ||
    skill.type === 'debuff'
  ) {
    const artifactsById = new Map<string, Artifact>(
      attacker.data.inventory.artifacts.map((a) => [a.id!, a]),
    );
    const eqIds = [
      attacker.data.equipped.weapon,
      attacker.data.equipped.armor,
      attacker.data.equipped.accessory,
    ].filter(Boolean) as string[];

    for (const id of eqIds) {
      const art = artifactsById.get(id);
      if (!art) continue;
      const effects = [...(art.special_effects || []), ...(art.curses || [])];
      for (const eff of effects) {
        if (eff.type === 'on_hit_add_effect') {
          if (Math.random() * 100 < eff.chance) {
            const duration = 2;
            const effectInstance: StatusInstance = {
              remaining: duration,
              potency: 60,
              element: art.element,
              skillName: art.name,
              source: snapshotUnit(attacker),
            };
            const applied = applyStatus(defender, eff.effect, effectInstance);
            if (applied) {
              log.push(
                `${attacker.data.name} 的 ${art.name} 触发，对 ${defender.data.name} 附加「${describeStatus(eff.effect)}」（持续 ${duration} 回合）。`,
              );
            } else {
              log.push(
                `⚠️ 法宝 ${art.name} 试图施加未知状态「${eff.effect}」，已忽略。`,
              );
            }
          }
        }
      }
    }
  }

  attacker.skillCooldowns.set(skill.id!, skill.cooldown);
}

function chooseSkill(actor: BattleUnit, target: BattleUnit): Skill {
  const available = actor.data.skills.filter((s) => canUseSkill(actor, s));
  if (!available.length) {
    return actor.data.skills[0];
  }

  const offensive = available.filter(
    (s) => s.type === 'attack' || s.type === 'control' || s.type === 'debuff',
  );
  const heals = available.filter((s) => s.type === 'heal');
  const buffs = available.filter((s) => s.type === 'buff');

  const hpRatio = actor.hp / (80 + calcFinalAttrs(actor.data).final.vitality);
  if (hpRatio < 0.3 && heals.length) {
    return heals[Math.floor(Math.random() * heals.length)];
  }
  if (target.hp < actor.hp && offensive.length) {
    return offensive[Math.floor(Math.random() * offensive.length)];
  }
  if (offensive.length) {
    return offensive[Math.floor(Math.random() * offensive.length)];
  }
  if (buffs.length) {
    return buffs[Math.floor(Math.random() * buffs.length)];
  }
  return available[0];
}

export function simulateBattle(
  player: Cultivator,
  opponent: Cultivator,
): BattleEngineResult {
  const initUnit = (
    data: Cultivator,
    id: 'player' | 'opponent',
  ): BattleUnit => ({
    id,
    data,
    hp: 80 + calcFinalAttrs(data).final.vitality * 5,
    mp: calcFinalAttrs(data).final.spirit * 2,
    statuses: new Map(),
    skillCooldowns: new Map(data.skills.map((s) => [s.id!, 0])),
  });

  const state: BattleState = {
    player: initUnit(player, 'player'),
    opponent: initUnit(opponent, 'opponent'),
    turn: 0,
    log: [],
    timeline: [],
  };

  // 初始回合（0 回合）状态
  state.timeline.push(snapshotTurn(0, state.player, state.opponent));

  while (state.player.hp > 0 && state.opponent.hp > 0 && state.turn < 30) {
    let snapshottedThisTurn = false;

    state.turn += 1;
    state.log.push(`[第${state.turn}回合]`);

    // 持续状态
    tickStatusEffects(state.player, state.log);
    tickStatusEffects(state.opponent, state.log);

    if (state.player.hp <= 0 || state.opponent.hp <= 0) {
      state.timeline.push(
        snapshotTurn(state.turn, state.player, state.opponent),
      );
      snapshottedThisTurn = true;
      break;
    }

    const pSpeed =
      calcFinalAttrs(state.player.data).final.speed +
      (state.player.statuses.has('speed_up') ? 20 : 0);
    const oSpeed =
      calcFinalAttrs(state.opponent.data).final.speed +
      (state.opponent.statuses.has('speed_up') ? 20 : 0);
    const actors =
      pSpeed >= oSpeed
        ? [state.player, state.opponent]
        : [state.opponent, state.player];

    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      if (isActionBlocked(actor)) {
        state.log.push(`${actor.data.name} 无法行动！`);
        continue;
      }

      const target = actor.id === 'player' ? state.opponent : state.player;
      const skill = chooseSkill(actor, target);
      executeSkill(actor, target, skill, state);
      if (target.hp <= 0) {
        if (!snapshottedThisTurn) {
          state.timeline.push(
            snapshotTurn(state.turn, state.player, state.opponent),
          );
          snapshottedThisTurn = true;
        }
        break;
      }

      // 冷却递减
      for (const [id, cd] of actor.skillCooldowns.entries()) {
        if (cd > 0) actor.skillCooldowns.set(id, cd - 1);
      }
    }

    if (!snapshottedThisTurn) {
      state.timeline.push(
        snapshotTurn(state.turn, state.player, state.opponent),
      );
      snapshottedThisTurn = true;
    }
  }

  const winnerUnit =
    state.player.hp > 0 && state.opponent.hp <= 0
      ? state.player
      : state.opponent.hp > 0 && state.player.hp <= 0
        ? state.opponent
        : state.player.hp >= state.opponent.hp
          ? state.player
          : state.opponent;

  const loserUnit = winnerUnit.id === 'player' ? state.opponent : state.player;

  state.log.push(
    `✨ ${winnerUnit.data.name} 获胜！剩余气血：${winnerUnit.hp}，对手剩余气血：${loserUnit.hp}。`,
  );

  return {
    winner: winnerUnit.data,
    loser: loserUnit.data,
    log: state.log,
    turns: state.turn,
    playerHp: state.player.hp,
    opponentHp: state.opponent.hp,
    timeline: state.timeline,
  };
}
