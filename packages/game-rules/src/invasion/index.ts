import type { Command, LineupUnit } from '@daoyou/combat-core/types';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import { earlyBaselines } from '@daoyou/game-content/combat/early-baselines';
import {
  INVASION_FORMATIONS,
  INVASION_HP_BUDGET_BY_PARTY_SIZE,
} from '@daoyou/game-content/invasion';
import { TOWER_ENCOUNTER_PACK } from '@daoyou/game-content/tower';
import type { ArenaState } from '@daoyou/game-domain/combat/arena';
import type { ExorcismGrade } from '@daoyou/game-domain/dungeon/exorcism';
import {
  INVASION_CARDS,
  type InvasionReward,
} from '@daoyou/game-domain/invasion';
import { compileExorcismEncounter } from '../dungeon/exorcism/encounter.js';
import { planExorcismGradeReward } from '../dungeon/exorcism/rewards.js';

import {
  ACTIVITY_WEEK_MS,
  naturalActivityWeek,
} from '../weekly-activity/calendar.js';

export const INVASION_REST_MS = 30_000;
export const INVASION_WAVES_PER_REWARD = 5;
export const invasionNextWave = (completedWave: number) => completedWave + 1;
export const invasionFirstClear = (completedWave: number, wave: number) =>
  invasionNextWave(completedWave) === wave;

export function invasionDifficulty(members: readonly { realm: RealmType }[]) {
  return REALM_VALUES[
    Math.max(0, ...members.map(({ realm }) => REALM_VALUES.indexOf(realm)))
  ];
}
export const invasionBossWave = (wave: number) =>
  wave % INVASION_WAVES_PER_REWARD === 0;
export function invasionBossRewardGrade(wave: number) {
  if (wave <= 0 || !invasionBossWave(wave)) return null;
  if (wave === 5) return 'B';
  if (wave < 20) return 'A';
  return 'S';
}

export const invasionWaveMultiplier = (wave: number) =>
  1.05 ** (wave - 1) * (invasionBossWave(wave) ? 1.2 : 1);

export const invasionWeek = naturalActivityWeek;

export function invasionCardDrop(roll: number, cardRoll: number, wave: number) {
  if (!invasionBossWave(wave) && roll >= 0.5) return undefined;
  return INVASION_CARDS[Math.floor(cardRoll * INVASION_CARDS.length)];
}

export function planInvasionReward(
  realm: RealmType,
  seed: number,
  grade: ExorcismGrade,
) {
  return planExorcismGradeReward(seed, grade, {
    mapRealm: realm,
    playerRealm: realm,
    difficultyTier: 'normal',
  });
}

export function invasionResourceDelta(
  budget: Omit<InvasionReward, 'drops'>,
  before: number,
  after: number,
) {
  const delta = (amount: number) =>
    Math.floor((amount * after) / INVASION_WAVES_PER_REWARD) -
    Math.floor((amount * before) / INVASION_WAVES_PER_REWARD);
  return {
    cultivationExp: delta(budget.cultivationExp),
    spiritStones: delta(budget.spiritStones),
    insight: delta(budget.insight),
  };
}

export function invasionLastWaveResources(
  settled: Omit<InvasionReward, 'drops'>,
  earlier: Omit<InvasionReward, 'drops'>,
) {
  return {
    cultivationExp: Math.max(
      0,
      settled.cultivationExp - earlier.cultivationExp,
    ),
    spiritStones: Math.max(0, settled.spiritStones - earlier.spiritStones),
    insight: Math.max(0, settled.insight - earlier.insight),
  };
}

export function invasionFormation(week: string, wave: number) {
  const weekNumber = Math.floor(Date.parse(week) / ACTIVITY_WEEK_MS);
  return (
    (((weekNumber + (invasionBossWave(wave) ? wave / 5 - 1 : wave - 1)) % 3) +
      3) %
    3
  );
}

export function invasionEnemies(
  realm: RealmType,
  memberCount: number,
  wave: number,
  formation: number,
): LineupUnit[] {
  const hpMultiplier = INVASION_HP_BUDGET_BY_PARTY_SIZE[memberCount];
  if (hpMultiplier === undefined)
    throw new RangeError('古魔入侵需要两至四名队员');
  const source = compileExorcismEncounter({
    realm,
    tier: 'normal',
    stage: 1,
    bossId: 'withered_vine',
    lineageId: 'demonic',
  }).units[0];
  const baseline =
    realm === '炼气' || realm === '筑基'
      ? earlyBaselines[realm]
      : TOWER_ENCOUNTER_PACK.baselines[realm];
  const strength = invasionWaveMultiplier(wave);
  const names = INVASION_FORMATIONS[formation];
  const hpBudget = source.attrs.hp * hpMultiplier * strength;
  const output = strength * (1 + (memberCount - 1) * 0.32);
  const eliteSkills = [
    ['invasion.armor', 'invasion.slow'],
    ['invasion.slow', 'exorcism.demonic.drain'],
    ['hunt.bolt', 'invasion.armor'],
  ][formation];
  const headSkills = [
    ['hunt.strike'],
    ['exorcism.demonic.drain'],
    ['hunt.bolt'],
  ][formation];
  const skills = [
    [
      ...headSkills,
      ...(invasionBossWave(wave)
        ? ['hunt.mark', 'hunt.slam', 'invasion.warning', 'invasion.rift']
        : []),
    ],
    ['hunt.heal'],
    ['invasion.borrow'],
    [eliteSkills[0]],
    [eliteSkills[1]],
    ['hunt.minion.strike'],
    ['hunt.minion.bolt'],
    ['hunt.minion.strike'],
  ];
  return [0.25, 0.15, 0.15, 0.09, 0.09, 0.09, 0.09, 0.09].map((share, slot) => {
    // Round ties apart even for a very low initial budget.
    const smallHp = Math.max(1, Math.round(hpBudget * 0.09));
    const guardHp = Math.max(smallHp + 1, Math.round(hpBudget * 0.15));
    const hp =
      slot === 0
        ? Math.max(guardHp + 1, Math.round(hpBudget * 0.25))
        : slot < 3
          ? guardHp
          : smallHp;
    const power = slot < 3 ? share : 0.09;
    return {
      ...source,
      id: `invasion.enemy.${slot}`,
      slot,
      name:
        slot === 0 && !invasionBossWave(wave)
          ? ['裂锋魔将', '蚀灵魔将', '焚魂魔将'][formation]
          : (names[slot] ?? '古魔喽啰'),
      attrs: {
        ...source.attrs,
        hp,
        maxHp: hp,
        physicalAtk: Math.round(
          baseline.referencePhysicalDef +
            (source.attrs.physicalAtk - baseline.referencePhysicalDef) *
              output *
              power,
        ),
        magicAtk: Math.round(
          baseline.referenceMagicDef +
            ((source.attrs.magicAtk ?? 0) - baseline.referenceMagicDef) *
              output *
              power,
        ),
      },
      skills: skills[slot],
      passives: [],
    };
  });
}

export function invasionNpcCommand(runtime: ArenaState, id: string): Command {
  const unit = runtime.state.units.find((entry) => entry.id === id)!;
  const standing = runtime.state.units.filter(
    (entry) =>
      !entry.flags.dead &&
      !entry.flags.downed &&
      !entry.flags.escaped &&
      !entry.flags.benched,
  );
  const foes = standing.filter((entry) => entry.side === 0);
  const players = foes.filter((entry) => entry.kind === 'player');
  const targets = unit.slot >= 5 || !players.length ? foes : players;
  const target =
    targets[(runtime.state.round + unit.slot - 1) % targets.length];
  const boss = standing.find((entry) => entry.id === 'invasion.enemy.0');
  const skill = (skillId: string, targetId: string): Command => ({
    type: 'skill',
    skillId,
    targets: [targetId],
  });
  if (!target) return { type: 'defend' };
  if (unit.slot === 0 && unit.skills.includes('hunt.mark')) {
    if (unit.statuses.some((status) => status.id === 'invasion.warning'))
      return skill('invasion.rift', target.id);
    if (
      unit.attrs.hp <= unit.attrs.maxHp * 0.4 &&
      !unit.statuses.some((status) => status.id === 'invasion.unleashed')
    )
      return skill('invasion.warning', unit.id);
    const marked = foes.find((entry) =>
      entry.statuses.some((status) => status.id === 'hunt.demon.mark'),
    );
    if (marked) return skill('hunt.slam', marked.id);
    if (runtime.state.round % 3 === 1) return skill('hunt.mark', target.id);
  }
  if (
    unit.slot === 1 &&
    boss &&
    boss.attrs.hp < boss.attrs.maxHp * 0.87 &&
    runtime.state.round % 2 === 0
  )
    return skill('hunt.heal', boss.id);
  if (unit.slot === 2 && boss && runtime.state.round % 3 === 1)
    return skill('invasion.borrow', boss.id);
  if (unit.slot === 1 || unit.slot === 2)
    return { type: 'attack', target: target.id };
  const action = unit.skills[0];
  return action
    ? skill(action, target.id)
    : { type: 'attack', target: target.id };
}
