import { expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek } from '../../../lib/tower/weekly';
import { createTowerHost, type TowerBlessings } from './host';
import { towerReferenceBuild } from './reference-fixtures';

const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
const seeds = [7, 19, 42, 73, 101, 211, 307, 401, 503, 601];
type Policy = 'main' | 'support' | 'control-support' | 'defend-heavy';
function fight(
  sect: 'lingxiao' | 'jiujie' | 'youdu',
  formation: 'solo' | 'healer' | 'guarded',
  combo: string,
  policy: Policy,
  seed: number,
  floor: number,
) {
  const player = towerReferenceBuild(sect);
  const selected = {
    ...week,
    floors: week.floors.map((r) =>
      r.floor === floor
        ? { ...r, combinationId: combo, formationId: formation }
        : r,
    ),
  };
  const blessings: TowerBlessings =
    sect === 'lingxiao'
      ? { physical_power: 2, guard: 2, beast_power: 1 }
      : { spell_power: 2, guard: 2, beast_power: 1 };
  if (floor === 20) {
    blessings[sect === 'lingxiao' ? 'physical_power' : 'spell_power'] = 3;
    blessings.guard = 3;
    blessings.beast_power = 3;
  }
  const host = createTowerHost(
    player,
    '金丹',
    floor,
    blessings,
    selected,
    seed,
  );
  for (let i = 0; i < 60 && !host.finished; i++) {
    const snapshot = host.runtimeSnapshot();
    const skills = snapshot.input.skills ?? [];
    const options = (id: string) => host.queryCommands(id);
    const commands = automaticCommands(
      host.state,
      host.playerId,
      skills,
      options,
      { statusDefs: snapshot.input.statusDefs },
    );
    const enemies = host.state.units.filter(
      (u) => u.side === 1 && u.attrs.hp > 0,
    );
    const target =
      policy === 'support' || policy === 'control-support'
        ? (enemies.find((u) => u.slot > 0) ?? enemies[0])
        : enemies[0];
    for (const entry of commands) {
      const choices = options(entry.unitId);
      if (
        entry.command.type === 'attack' &&
        choices.attackTargetIds.includes(target.id)
      )
        entry.command = { type: 'attack', target: target.id };
      if (entry.command.type === 'skill') {
        const choice = choices.skills.find(
          (s) =>
            s.skillId ===
            (entry.command.type === 'skill' ? entry.command.skillId : ''),
        );
        if (choice?.selectableTargetIds.includes(target.id))
          entry.command = {
            ...entry.command,
            targets: [
              target.id,
              ...choice.selectableTargetIds.filter((id) => id !== target.id),
            ].slice(0, choice.targetCount),
          };
      }
      if (entry.unitId !== host.playerId) continue;
      if (
        policy === 'control-support' &&
        target.slot > 0 &&
        !target.statuses.some((s) => s.category === 'control')
      ) {
        const control = choices.skills.find(
          (s) =>
            s.ready &&
            s.selectableTargetIds.includes(target.id) &&
            skills.find((d) => d.id === s.skillId)?.tags?.includes('seal'),
        );
        if (control)
          entry.command = {
            type: 'skill',
            skillId: control.skillId,
            targets: [target.id],
          };
      }
      const leader = enemies.find((u) => u.slot === 0);
      const plan = leader ? snapshot.npcPlans[leader.id] : undefined;
      if (
        policy === 'defend-heavy' &&
        plan?.cycle[(host.state.round - 1) % plan.cycle.length] ===
          'tower.heavy'
      )
        entry.command = { type: 'defend' };
    }
    host.submitGroup(commands);
    host.resolveRound();
  }
  expect(host.finished).toBe(true);
  const damage = host
    .trace()
    .events.reduce(
      (total, e) =>
        total +
        (e.type === 'damage' && e.targetId === host.playerId ? e.amount : 0),
      0,
    );
  return {
    win: host.trace().outcome === 'victory',
    rounds: host.trace().rounds.length,
    damage,
  };
}
it.each([10, 20])(
  '第 %i 层：相同构筑与种子对照辅助、护卫和重击策略',
  (floor) => {
    const rows = [];
    for (const sect of ['lingxiao', 'jiujie', 'youdu'] as const) {
      for (const [formation, combo, policies] of [
        ['healer', 'mage-vital-swift', ['main', 'support', 'control-support']],
        ['guarded', 'warrior-ward-calm', ['main', 'support']],
        ['solo', 'warrior-armor-charge', ['main', 'defend-heavy']],
      ] as const) {
        for (const policy of policies) {
          const results = seeds.map((seed) =>
            fight(sect, formation, combo, policy, seed, floor),
          );
          rows.push({
            floor,
            sect,
            formation,
            policy,
            wins: results.filter((r) => r.win).length,
            rounds: results.reduce((n, r) => n + r.rounds, 0),
            damage: results.reduce((n, r) => n + r.damage, 0),
          });
        }
      }
    }
    console.info('tower-phase2-strategies', JSON.stringify(rows));
    for (const formation of ['healer', 'guarded', 'solo']) {
      expect(
        rows.some(
          (r) =>
            r.floor === floor &&
            r.formation === formation &&
            r.policy !== 'main' &&
            rows.some(
              (base) =>
                base.floor === floor &&
                base.sect === r.sect &&
                base.formation === formation &&
                base.policy === 'main' &&
                (r.wins > base.wins ||
                  (r.wins === base.wins &&
                    (r.damage < base.damage || r.rounds < base.rounds))),
            ),
        ),
        `${floor}/${formation}`,
      ).toBe(true);
    }
  },
  15_000,
);
