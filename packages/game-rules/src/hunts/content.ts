import {
  mark,
  formations,
  HUNT_ENEMY_COUNT,
  HUNT_BOSSES,
} from '@daoyou/game-content/hunts';
import type { HuntEvent } from '@daoyou/game-domain/hunts';


import type { BattleState, Command, LineupUnit } from '@daoyou/combat-core/types';

import { huntEnemyAttrs } from './balance.js';

export function huntEnemies(event: HuntEvent, players: number): LineupUnit[] {
  if (!Number.isInteger(players) || players < 2 || players > 4)
    throw new Error('讨伐需要2～4人');
  const formation = formations[event.bossId];
  return Array.from({ length: HUNT_ENEMY_COUNT }, (_, slot) => {
    const role = slot === 0 ? 'boss' : slot === 1 ? 'elite' : 'normal';
    const attrs = huntEnemyAttrs(event.level, role, players);
    if (role === 'boss') {
      switch (event.bossId) {
        case 'bloodPython':
          attrs.maxHp = Math.round(attrs.maxHp * 2.8);
          break;
        case 'ironTurtle':
          attrs.physicalDef *= 6;
          attrs.magicDef = Math.round(attrs.magicDef * 0.6);
          break;
        case 'mistToad':
          attrs.magicDef *= 6;
          attrs.physicalDef = Math.round(attrs.physicalDef * 0.6);
          break;
        case 'gildedCorpse':
          attrs.maxHp = Math.round(attrs.maxHp * 0.45);
          attrs.physicalDef *= 6;
          attrs.magicDef *= 6;
          break;
        case 'shadowMarten':
          attrs.dodge = attrs.hit + event.level * 6;
          attrs.speed = Math.round(attrs.speed * 1.3);
          break;
      }
      attrs.hp = attrs.maxHp;
    }
    let skills: string[] = ['hunt.strike'];
    if (slot === 0 && event.bossId === 'demon')
      skills = ['hunt.mark', 'hunt.slam'];
    else if (slot === 1 && event.bossId === 'heretic') skills = ['hunt.heal'];
    else if (slot < 2 && event.bossId === 'beast') skills = ['hunt.ward'];
    else if ((slot < 2 && event.bossId === 'mistToad') || slot >= 6)
      skills = ['hunt.bolt'];
    if (slot >= 2)
      skills = [slot >= 6 ? 'hunt.minion.bolt' : 'hunt.minion.strike'];
    return {
      id: `hunt.enemy.${slot}`,
      name:
        slot === 0
          ? HUNT_BOSSES[event.bossId].name
          : slot === 1
            ? formation.elite
            : `${formation.minions[slot >= 6 ? 1 : 0]}·${slot - 1}`,
      kind: 'npc' as const,
      side: 1 as const,
      slot,
      level: event.level,
      attrs,
      skills,
      passives: [],
      tags: [`hunt.${role}`],
    };
  });
}

/** Commands depend only on the frozen round state; no clocks or network in content. */
export function huntNpcCommand(
  runtime: { state: BattleState },
  unitId: string,
): Command {
  const state = runtime.state;
  const unit = state.units.find((u) => u.id === unitId)!;
  const standing = state.units.filter(
    (u) =>
      !u.flags.dead && !u.flags.downed && !u.flags.escaped && !u.flags.benched,
  );
  const enemies = standing.filter((u) => u.side === 0);
  const players = enemies.filter((u) => u.kind === 'player');
  const targets = unit.skills.some((id) => id.startsWith('hunt.minion.'))
    ? enemies
    : players.length
      ? players
      : enemies;
  const target =
    targets[(state.round - 1 + unit.slot) % Math.max(1, targets.length)];
  if (!target) return { type: 'defend' };
  if (unit.skills.includes('hunt.heal')) {
    const boss = standing.find((u) => u.id === 'hunt.enemy.0');
    if (boss && boss.attrs.hp < boss.attrs.maxHp)
      return { type: 'skill', skillId: 'hunt.heal', targets: [boss.id] };
  }
  if (unit.skills.includes('hunt.mark')) {
    const marked = enemies.find((u) => u.statuses.some((s) => s.id === mark));
    if (marked)
      return { type: 'skill', skillId: 'hunt.slam', targets: [marked.id] };
    if (state.round % 2 === 1)
      return { type: 'skill', skillId: 'hunt.mark', targets: [target.id] };
  }
  if (unit.skills.includes('hunt.ward') && state.round % 3 === unit.slot % 3) {
    const ally = standing.find(
      (u) => u.side === 1 && u.id !== unitId && u.skills.includes('hunt.ward'),
    );
    if (ally)
      return { type: 'skill', skillId: 'hunt.ward', targets: [ally.id] };
  }
  for (const skillId of ['hunt.minion.strike', 'hunt.minion.bolt'])
    if (unit.skills.includes(skillId))
      return { type: 'skill', skillId, targets: [target.id] };
  if (unit.skills.includes('hunt.bolt'))
    return { type: 'skill', skillId: 'hunt.bolt', targets: [target.id] };
  if (unit.skills.includes('hunt.strike'))
    return { type: 'skill', skillId: 'hunt.strike', targets: [target.id] };
  return { type: 'attack', target: target.id };
}
