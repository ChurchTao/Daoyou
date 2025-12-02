import type {
  Artifact,
  Attributes,
  Cultivator,
  ElementType,
  Skill,
  StatusEffect,
} from '@/types/cultivator';

export interface BattleEngineResult {
  winner: Cultivator;
  loser: Cultivator;
  log: string[];
  turns: number;
  playerHp: number;
  opponentHp: number;
}

interface BattleUnit {
  id: 'player' | 'opponent';
  data: Cultivator;
  hp: number;
  statuses: Map<StatusEffect, number>;
  skillCooldowns: Map<string, number>;
}

interface BattleState {
  player: BattleUnit;
  opponent: BattleUnit;
  turn: number;
  log: string[];
}

const ELEMENT_WEAKNESS: Record<ElementType, ElementType[]> = {
  金: ['火', '雷'],
  木: ['金', '雷'],
  水: ['土', '风'],
  火: ['水', '冰'],
  土: ['木', '风'],
  风: ['雷', '冰'],
  雷: ['土', '水'],
  冰: ['火', '雷'],
  无: [],
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

function getRealmAttributeCap(realm: string): number {
  const caps: Record<string, number> = {
    炼气: 100,
    筑基: 120,
    金丹: 150,
    元婴: 180,
    化神: 210,
    炼虚: 240,
    合体: 270,
    大乘: 300,
    渡劫: 300,
  };
  return caps[realm] ?? 100;
}

function calculateFinalAttributes(c: Cultivator): Required<Attributes> {
  const base: Required<Attributes> = {
    vitality: c.attributes.vitality,
    spirit: c.attributes.spirit,
    wisdom: c.attributes.wisdom,
    speed: c.attributes.speed,
    willpower: c.attributes.willpower,
  };

  // 功法加成
  for (const cult of c.cultivations) {
    for (const [k, v] of Object.entries(cult.bonus)) {
      if (typeof v === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (base as any)[k] += v;
      }
    }
  }

  // 装备加成
  const equippedArtifacts: Artifact[] = [];
  const { inventory, equipped } = c;
  const artifactsById = new Map<string, Artifact>(
    (inventory.artifacts || []).map((a) => [a.id!, a]),
  );
  if (equipped.weapon && artifactsById.has(equipped.weapon)) {
    equippedArtifacts.push(artifactsById.get(equipped.weapon)!);
  }
  if (equipped.armor && artifactsById.has(equipped.armor)) {
    equippedArtifacts.push(artifactsById.get(equipped.armor)!);
  }
  if (equipped.accessory && artifactsById.has(equipped.accessory)) {
    equippedArtifacts.push(artifactsById.get(equipped.accessory)!);
  }

  for (const art of equippedArtifacts) {
    for (const [k, v] of Object.entries(art.bonus)) {
      if (typeof v === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (base as any)[k] += v;
      }
    }
  }

  // 境界上限裁剪
  const cap = getRealmAttributeCap(c.realm);
  base.vitality = Math.min(base.vitality, cap);
  base.spirit = Math.min(base.spirit, cap);
  base.wisdom = Math.min(base.wisdom, cap);
  base.speed = Math.min(base.speed, cap);
  base.willpower = Math.min(base.willpower, cap);

  return base;
}

function getElementMultiplier(
  attacker: Cultivator,
  defender: Cultivator,
  el: ElementType,
): number {
  let mult = 1.0;
  const root = attacker.spiritual_roots.find((r) => r.element === el);
  if (root) {
    mult *= 1.0 + (root.strength / 100) * 0.5;
  }
  const defenderMainRoot = defender.spiritual_roots[0]?.element;
  if (defenderMainRoot && ELEMENT_WEAKNESS[el]?.includes(defenderMainRoot)) {
    mult *= 1.5;
  }
  return mult;
}

function calculateStatusHitChance(
  attackerPower: number,
  defenderWillpower: number,
): number {
  const baseHit = Math.min(0.9, Math.max(0.3, attackerPower / 100));
  const resist = Math.min(0.7, defenderWillpower / 250);
  return Math.max(0.1, baseHit * (1 - resist));
}

function applyStatus(
  unit: BattleUnit,
  effect: StatusEffect,
  duration: number,
): boolean {
  if (!STATUS_EFFECTS.has(effect)) return false;
  unit.statuses.set(effect, duration);
  return true;
}

function tickStatusEffects(unit: BattleUnit, log: string[]): void {
  const toRemove: StatusEffect[] = [];
  const finalAttrs = calculateFinalAttributes(unit.data);

  for (const [effect, dur] of unit.statuses.entries()) {
    if (dur <= 0) {
      toRemove.push(effect);
      continue;
    }

    if (effect === 'burn') {
      const dmg = 5 + Math.floor(finalAttrs.spirit / 20);
      unit.hp -= dmg;
      log.push(`${unit.data.name} 被灼烧，受到 ${dmg} 点伤害！`);
    } else if (effect === 'bleed') {
      unit.hp -= 4;
      log.push(`${unit.data.name} 流血不止，受到 4 点伤害！`);
    } else if (effect === 'poison') {
      const dmg = 3 + Math.floor(finalAttrs.vitality / 30);
      unit.hp -= dmg;
      log.push(`${unit.data.name} 中毒，受到 ${dmg} 点伤害！`);
    }

    unit.statuses.set(effect, dur - 1);
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

function executeSkill(
  attacker: BattleUnit,
  defender: BattleUnit,
  skill: Skill,
  state: BattleState,
): void {
  const log = state.log;
  const finalAtt = calculateFinalAttributes(attacker.data);
  const finalDef = calculateFinalAttributes(defender.data);

  // 闪避判定
  if (skill.type === 'attack' || skill.type === 'control' || skill.type === 'debuff') {
    const evasion = Math.min(0.25, finalDef.speed / 400);
    if (Math.random() < evasion) {
      log.push(
        `${defender.data.name} 闪避了 ${attacker.data.name} 的「${skill.name}」！`,
      );
      attacker.skillCooldowns.set(skill.id!, skill.cooldown);
      return;
    }
  }

  if (skill.type === 'attack') {
    let damage = skill.power * (finalAtt.spirit / 100);
    damage *= getElementMultiplier(attacker.data, defender.data, skill.element);
    const critRate = Math.min(0.3, (finalAtt.wisdom - 50) / 200);
    const isCrit = Math.random() < critRate;
    if (isCrit) damage *= 2;
    const defReduction = finalDef.vitality / 500;
    damage *= 1 - defReduction;
    const dmgInt = Math.max(1, Math.floor(damage));
    defender.hp -= dmgInt;
    log.push(
      `${attacker.data.name} 使用「${skill.name}」${
        Math.random() < critRate ? '【暴击】' : ''
      }造成 ${dmgInt} 点伤害！`,
    );
  } else if (skill.type === 'debuff' || skill.type === 'control') {
    if (!skill.effect) {
      log.push(`⚠️ 技能 ${skill.name} 缺少 effect 字段！`);
    } else if (!STATUS_EFFECTS.has(skill.effect)) {
      log.push(`⚠️ 无效状态效果：${skill.effect}`);
    } else {
      const hitChance = calculateStatusHitChance(
        skill.power,
        finalDef.willpower,
      );
      const duration = skill.duration ?? (skill.type === 'control' ? 1 : 2);
      if (Math.random() < hitChance) {
        applyStatus(defender, skill.effect, duration);
        log.push(
          `${attacker.data.name} 成功对 ${defender.data.name} 施加「${skill.effect}」！`,
        );
      } else {
        log.push(
          `${defender.data.name} 凭借强大神识，抵抗了「${skill.name}」！`,
        );
      }
    }
  } else if (skill.type === 'heal') {
    const heal = skill.power + finalAtt.spirit / 2;
    const target = skill.target_self === false ? defender : attacker;
    const maxHp = 80 + calculateFinalAttributes(target.data).vitality;
    const healInt = Math.floor(heal);
    target.hp = Math.min(target.hp + healInt, maxHp);
    log.push(
      `${attacker.data.name} 使用「${skill.name}」，恢复 ${healInt} 点气血！`,
    );
  } else if (skill.type === 'buff') {
    if (skill.effect) {
      const duration = skill.duration ?? 2;
      applyStatus(attacker, skill.effect, duration);
      log.push(`${attacker.data.name} 获得「${skill.effect}」效果！`);
    }
  }

  // 装备 on_hit_add_effect 触发
  if (skill.type === 'attack' || skill.type === 'control' || skill.type === 'debuff') {
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
            applyStatus(defender, eff.effect, 2);
            log.push(
              `${defender.data.name} 因 ${art.name} 被附加「${eff.effect}」！`,
            );
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

  const hpRatio = actor.hp / (80 + calculateFinalAttributes(actor.data).vitality);
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
  const initUnit = (data: Cultivator, id: 'player' | 'opponent'): BattleUnit => ({
    id,
    data,
    hp: 80 + calculateFinalAttributes(data).vitality,
    statuses: new Map(),
    skillCooldowns: new Map(data.skills.map((s) => [s.id!, 0])),
  });

  const state: BattleState = {
    player: initUnit(player, 'player'),
    opponent: initUnit(opponent, 'opponent'),
    turn: 0,
    log: [],
  };

  while (
    state.player.hp > 0 &&
    state.opponent.hp > 0 &&
    state.turn < 30
  ) {
    state.turn += 1;
    state.log.push(`[第${state.turn}回合]`);

    // 持续状态
    tickStatusEffects(state.player, state.log);
    tickStatusEffects(state.opponent, state.log);

    if (state.player.hp <= 0 || state.opponent.hp <= 0) break;

    const pSpeed =
      calculateFinalAttributes(state.player.data).speed +
      (state.player.statuses.has('speed_up') ? 20 : 0);
    const oSpeed =
      calculateFinalAttributes(state.opponent.data).speed +
      (state.opponent.statuses.has('speed_up') ? 20 : 0);
    const actors =
      pSpeed >= oSpeed ? [state.player, state.opponent] : [state.opponent, state.player];

    for (const actor of actors) {
      if (actor.hp <= 0) continue;
      if (isActionBlocked(actor)) {
        state.log.push(`${actor.data.name} 无法行动！`);
        continue;
      }

      const target = actor.id === 'player' ? state.opponent : state.player;
      const skill = chooseSkill(actor, target);
      executeSkill(actor, target, skill, state);
      if (target.hp <= 0) break;

      // 冷却递减
      for (const [id, cd] of actor.skillCooldowns.entries()) {
        if (cd > 0) actor.skillCooldowns.set(id, cd - 1);
      }
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
  };
}

