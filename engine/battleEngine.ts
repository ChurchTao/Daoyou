import type {
  ActiveEffect,
  BattleProfile,
  Cultivator,
  ElementType,
  Skill,
} from '@/types/cultivator';
import { cloneBattleProfile, ensureBattleProfile } from '@/utils/battleProfile';

export interface BattleEngineResult {
  winner: Cultivator;
  loser: Cultivator;
  log: string[];
  turns: number;
  playerHp: number;
  opponentHp: number;
  triggeredMiracle: boolean;
}

interface Combatant extends BattleProfile {
  id: string;
  name: string;
  activeEffects: ActiveEffect[];
}

const MAX_TURNS = 20;

const ELEMENT_MOD: Record<string, number> = {
  // 雷系克制关系
  '雷-金': 1.3,
  '雷-木': 1.3,
  '土-雷': 1.3,
  '金-雷': 0.7,
  '木-雷': 0.7,
  // 五行相克关系
  '金-木': 1.3,
  '木-土': 1.3,
  '土-水': 1.3,
  '水-火': 1.3,
  '火-金': 1.3,
  '木-金': 0.7,
  '土-木': 0.7,
  '水-土': 0.7,
  '火-水': 0.7,
  '金-火': 0.7,
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const randomFloat = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const computeRating = (combatant: Combatant) => {
  const { vitality, spirit, wisdom, speed } = combatant.attributes;
  return (vitality + spirit + wisdom + speed) / 4;
};

const randomChoice = <T>(items: T[], fallback: T): T =>
  items.length ? items[Math.floor(Math.random() * items.length)] : fallback;

export function simulateBattle(
  player: Cultivator,
  opponent: Cultivator,
): BattleEngineResult {
  const playerProfile = cloneBattleProfile(ensureBattleProfile(player));
  console.log('playerProfile', playerProfile);
  const opponentProfile = cloneBattleProfile(ensureBattleProfile(opponent));
  console.log('opponentProfile', opponentProfile);

  const p: Combatant = {
    ...playerProfile,
    id: player.id,
    name: player.name,
    activeEffects: playerProfile.activeEffects || [],
  };
  const o: Combatant = {
    ...opponentProfile,
    id: opponent.id,
    name: opponent.name,
    activeEffects: opponentProfile.activeEffects || [],
  };

  p.hp = p.maxHp;
  o.hp = o.maxHp;

  const log: string[] = [];
  let winner: Combatant | null = null;
  let loser: Combatant | null = null;
  let turns = 0;

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    turns = turn;

    // 为当前回合添加回合标记
    log.push(`[第${turn}回合]`);

    // 处理持续效果
    processActiveEffects(p, log);
    processActiveEffects(o, log);

    // 检查是否有角色因持续效果死亡
    if (p.hp <= 0) {
      winner = o;
      loser = p;
      break;
    }
    if (o.hp <= 0) {
      winner = p;
      loser = o;
      break;
    }

    const [first, second] =
      p.attributes.speed >= o.attributes.speed ? [p, o] : [o, p];

    executeAction(first, second, log);
    if (second.hp <= 0) {
      winner = first;
      loser = second;
      break;
    }

    executeAction(second, first, log);
    if (first.hp <= 0) {
      winner = second;
      loser = first;
      break;
    }
  }

  if (!winner || !loser) {
    if (p.hp === o.hp) {
      winner = p;
      loser = o;
    } else {
      winner = p.hp > o.hp ? p : o;
      loser = winner === p ? o : p;
    }
  }

  const triggeredMiracle = computeRating(winner) + 8 < computeRating(loser);

  return {
    winner: winner.id === player.id ? player : opponent,
    loser: loser.id === player.id ? player : opponent,
    log,
    turns,
    playerHp: p.hp,
    opponentHp: o.hp,
    triggeredMiracle,
  };
}

function executeAction(
  attacker: Combatant,
  defender: Combatant,
  log: string[],
) {
  // 检查是否眩晕
  const isStunned = attacker.activeEffects.some(
    (effect) => effect.type === 'stun',
  );
  if (isStunned) {
    log.push(`${attacker.name} 处于眩晕状态，无法行动！`);
    return;
  }

  const skill = selectSkill(attacker, defender);
  switch (skill.type) {
    case 'attack':
    case 'control': {
      const { damage, isCrit, elementNote } = calculateDamage(
        attacker,
        defender,
        skill,
      );
      applyDamage(defender, damage);
      const critText = isCrit ? '（暴击）' : '';
      log.push(
        `${attacker.name} 施展 ${skill.name}${critText}，对 ${defender.name} 造成 ${damage} 点伤害${elementNote}。`,
      );

      // 应用持续效果
      applyEffects(defender, skill.effects || [], attacker.name, log);
      break;
    }
    case 'heal': {
      const heal = Math.round(
        skill.power * 0.5 + attacker.attributes.spirit * 0.3,
      );
      attacker.hp = clamp(attacker.hp + heal, 0, attacker.maxHp);
      log.push(`${attacker.name} 运转 ${skill.name}，回复 ${heal} 点气血。`);
      break;
    }
    case 'buff': {
      if (skill.effects?.includes('speed_up')) {
        attacker.attributes.speed = clamp(
          attacker.attributes.speed + 5,
          40,
          120,
        );
      }
      if (skill.effects?.includes('spirit_up')) {
        attacker.attributes.spirit = clamp(
          attacker.attributes.spirit + 5,
          40,
          120,
        );
      }
      // 应用持续buff效果
      applyEffects(attacker, skill.effects || [], attacker.name, log);
      log.push(`${attacker.name} 激发 ${skill.name}，气势更盛。`);
      break;
    }
    default:
      break;
  }
}

function processActiveEffects(target: Combatant, log: string[]) {
  if (!target.activeEffects || target.activeEffects.length === 0) return;

  // 创建新的效果列表，过滤掉已结束的效果
  const newEffects: ActiveEffect[] = [];

  for (const effect of target.activeEffects) {
    // 效果结算
    switch (effect.type) {
      case 'bleed':
        // 流血效果：每回合造成固定伤害
        applyDamage(target, effect.value);
        log.push(
          `${target.name} 受到 ${effect.name} 影响，流血不止，损失 ${effect.value} 点气血！`,
        );
        break;
      case 'burn':
        // 燃烧效果：每回合造成固定伤害
        applyDamage(target, effect.value);
        log.push(
          `${target.name} 身上 ${effect.name} 燃烧，损失 ${effect.value} 点气血！`,
        );
        break;
      case 'stun':
        // 眩晕效果：已经在executeAction中检查，这里只是减少持续时间
        break;
      case 'poison':
        // 中毒效果：每回合造成固定伤害
        applyDamage(target, effect.value);
        log.push(
          `${target.name} 身中 ${effect.name}，毒性发作，损失 ${effect.value} 点气血！`,
        );
        break;
      case 'spirit_up':
        // 灵力提升效果：每回合持续生效，提升灵力
        target.attributes.spirit = clamp(
          target.attributes.spirit + effect.value,
          40,
          120,
        );
        break;
      case 'vitality_up':
        // 体魄提升效果：每回合持续生效，提升体魄
        target.attributes.vitality = clamp(
          target.attributes.vitality + effect.value,
          40,
          120,
        );
        break;
      case 'wisdom_up':
        // 悟性提升效果：每回合持续生效，提升悟性
        target.attributes.wisdom = clamp(
          target.attributes.wisdom + effect.value,
          40,
          120,
        );
        break;
      case 'speed_up':
        // 速度提升效果：每回合持续生效，提升速度
        target.attributes.speed = clamp(
          target.attributes.speed + effect.value,
          40,
          120,
        );
        break;
    }

    // 减少持续时间
    effect.duration -= 1;

    // 如果效果还未结束，保留到新列表
    if (effect.duration > 0) {
      newEffects.push(effect);
    } else {
      // 效果结束提示
      if (effect.type !== 'stun') {
        log.push(`${target.name} 身上的 ${effect.name} 效果消失了。`);
      }
    }
  }

  // 更新效果列表
  target.activeEffects = newEffects;
}

function applyEffects(
  target: Combatant,
  effects: string[],
  source: string,
  log: string[],
) {
  if (!effects || effects.length === 0) return;

  for (const effect of effects) {
    switch (effect) {
      case 'bleed':
        // 流血效果：持续3回合，每回合造成10点伤害
        target.activeEffects.push({
          name: '流血',
          type: 'bleed',
          value: 2,
          duration: 5,
          source,
        });
        log.push(`${target.name} 被 ${source} 的招式击中，伤口血流不止！`);
        break;
      case 'burn':
        // 燃烧效果：持续2回合，每回合造成15点伤害
        target.activeEffects.push({
          name: '烈焰',
          type: 'burn',
          value: 6,
          duration: 2,
          source,
        });
        log.push(`${target.name} 被 ${source} 的招式击中，身上燃起熊熊烈焰！`);
        break;
      case 'stun':
        // 眩晕效果：当前回合无法行动（需要在行动前检查）
        target.activeEffects.push({
          name: '眩晕',
          type: 'stun',
          value: 0,
          duration: 1,
          source,
        });
        log.push(
          `${target.name} 被 ${source} 的招式击中，头晕目眩，无法行动！`,
        );
        break;
      case 'poison':
        // 中毒效果：持续4回合，每回合造成8点伤害
        target.activeEffects.push({
          name: '剧毒',
          type: 'poison',
          value: 6,
          duration: 2,
          source,
        });
        log.push(`${target.name} 中了 ${source} 的毒，毒素开始扩散！`);
        break;
      case 'heal':
        // 治疗效果：立即回复生命值
        const healAmount = Math.round(target.maxHp * 0.2); // 回复20%最大生命值
        target.hp = clamp(target.hp + healAmount, 0, target.maxHp);
        log.push(`${target.name} 受到治疗效果，回复 ${healAmount} 点生命值！`);
        break;
      case 'spirit_up':
        // 灵力提升效果：持续3回合，提升10点灵力
        target.activeEffects.push({
          name: '灵力提升',
          type: 'spirit_up',
          value: 10,
          duration: 3,
          source,
        });
        log.push(`${target.name} 灵力涌动，精神大振！`);
        break;
      case 'vitality_up':
        // 体魄提升效果：持续3回合，提升10点体魄
        target.activeEffects.push({
          name: '体魄提升',
          type: 'vitality_up',
          value: 10,
          duration: 3,
          source,
        });
        log.push(`${target.name} 体魄增强，气血旺盛！`);
        break;
      case 'wisdom_up':
        // 悟性提升效果：持续3回合，提升10点悟性
        target.activeEffects.push({
          name: '悟性提升',
          type: 'wisdom_up',
          value: 10,
          duration: 3,
          source,
        });
        log.push(`${target.name} 悟性大开，灵台清明！`);
        break;
      case 'speed_up':
        // 速度提升效果：持续3回合，提升10点速度
        target.activeEffects.push({
          name: '速度提升',
          type: 'speed_up',
          value: 10,
          duration: 3,
          source,
        });
        log.push(`${target.name} 身法轻盈，速度大增！`);
        break;
    }
  }
}

function selectSkill(attacker: Combatant, defender: Combatant): Skill {
  const attackSkills = attacker.skills.filter(
    (s) => s.type === 'attack' || s.type === 'control',
  );
  const healSkills = attacker.skills.filter((s) => s.type === 'heal');
  const buffSkills = attacker.skills.filter((s) => s.type === 'buff');

  if (attacker.hp < attacker.maxHp * 0.3 && healSkills.length) {
    return randomChoice(healSkills, attacker.skills[0]);
  }

  if (defender.hp < defender.maxHp * 0.4 && attackSkills.length) {
    return randomChoice(attackSkills, attacker.skills[0]);
  }

  if (attackSkills.length) {
    return randomChoice(attackSkills, attacker.skills[0]);
  }

  if (buffSkills.length) {
    return randomChoice(buffSkills, attacker.skills[0]);
  }

  return attacker.skills[0];
}

function calculateDamage(
  attacker: Combatant,
  defender: Combatant,
  skill: Skill,
) {
  let basePower = skill.power;
  let spirit = attacker.attributes.spirit;
  let wisdom = attacker.attributes.wisdom;
  let vitality = attacker.attributes.vitality;
  let speed = attacker.attributes.speed;

  // 装备属性加成
  attacker.equipment?.forEach((eq) => {
    if (eq.bonus?.spirit) {
      spirit += eq.bonus.spirit;
    }
    if (eq.bonus?.wisdom) {
      wisdom += eq.bonus.wisdom;
    }
    if (eq.bonus?.vitality) {
      vitality += eq.bonus.vitality;
    }
    if (eq.bonus?.speed) {
      speed += eq.bonus.speed;
    }
    // 装备技能威力加成
    if (eq.bonus?.skillPowerBoost) {
      basePower *= 1 + eq.bonus.skillPowerBoost;
    }
  });

  let elementMod = getElementModifier(skill.element, defender.element);
  attacker.equipment?.forEach((eq) => {
    const bonus = eq.bonus?.elementBoost?.[skill.element];
    if (bonus) {
      elementMod += bonus;
    }
  });

  const critRate = clamp((wisdom - 50) / 200, 0, 0.3);
  const isCrit = Math.random() < critRate;
  const critMod = isCrit ? 1.5 : 1;

  // 调整伤害系数，降低单次攻击伤害，使战斗更平衡
  let damage = (basePower * 0.3 + spirit * 0.2) * elementMod * critMod;
  damage = Math.round(damage * randomFloat(0.9, 1.1));

  return {
    damage,
    isCrit,
    elementNote:
      elementMod > 1 ? '（属性克制）' : elementMod < 1 ? '（被克制）' : '',
  };
}

function applyDamage(target: Combatant, damage: number) {
  const finalDamage = Math.max(1, damage);
  target.hp = clamp(target.hp - finalDamage, 0, target.maxHp);
}

function getElementModifier(
  attacking: ElementType = '无',
  defending: ElementType = '无',
) {
  if (!attacking || !defending) return 1;
  return ELEMENT_MOD[`${attacking}-${defending}`] ?? 1;
}
