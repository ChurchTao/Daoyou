import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto';
import {
  buildTowerBlessingChoices,
  TOWER_ELIGIBLE_REALMS,
} from '../../../lib/tower/helpers';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_ENCOUNTERS } from '../../../lib/tower/weekly';
import { applyCultivate, physicalBase } from '../rules-daoyou/formulas';
import { compileTowerEncounter } from './content';
import mechanics from './data/mechanics.json';
import {
  createTowerHost,
  projectTowerPlayer,
  type TowerBlessings,
} from './host';
import { towerReferenceBuild } from './reference-fixtures';

const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-23')));

describe('输出预算定标的战斗节奏', () => {
  for (const realm of TOWER_ELIGIBLE_REALMS) {
    it(`${realm} 普通、精英与首领有不同的行动窗口`, () => {
      for (const [floor, min, max] of [
        [1, 2, 3],
        [5, 4, 6],
        [10, 6, 8],
        [15, 4, 6],
        [20, 6, 8],
      ]) {
        const samples: Array<{ sect: string; seed: number; rounds: number }> =
          [];
        for (const sect of ['lingxiao', 'jiujie'] as const) {
          for (const seed of [7, 42, 101]) {
            const player = towerReferenceBuild(sect, realm);
            const blessings: TowerBlessings = {};
            const priorities = [
              sect === 'lingxiao' ? 'physical_power' : 'spell_power',
              'beast_power',
              'guard',
              'swiftness',
              sect === 'lingxiao' ? 'spell_power' : 'physical_power',
            ];
            for (let clearedFloor = 0; clearedFloor < floor; clearedFloor++) {
              const chosen = buildTowerBlessingChoices({
                runId: `health-${sect}-${seed}`,
                clearedFloor,
                blessings,
                hasBeasts: true,
              }).sort(
                (a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id),
              )[0];
              if (chosen) blessings[chosen.id] = chosen.nextStacks;
            }
            const selected = {
              ...week,
              floors: week.floors.map((row) =>
                row.floor === floor
                  ? {
                      ...row,
                      combinationId: 'warrior-armor-charge',
                      formationId: 'solo' as const,
                    }
                  : row,
              ),
            };
            const host = createTowerHost(
              player,
              realm,
              floor,
              blessings,
              selected,
              seed,
            );
            for (let turn = 0; turn < 30 && !host.finished; turn++) {
              const input = host.runtimeSnapshot().input;
              const commands = automaticCommands(
                host.state,
                host.playerId,
                input.skills ?? [],
                (id) => host.queryCommands(id),
                { statusDefs: input.statusDefs },
              );
              const command = commands.find((c) => c.unitId === host.playerId);
              if (command) {
                const choices = host.queryCommands(host.playerId).skills;
                const choice = (
                  sect === 'jiujie'
                    ? ['jiujie.skill.thunderstorm']
                    : ['lingxiao.skill.triple']
                )
                  .map((id) => choices.find((s) => s.skillId === id && s.ready))
                  .find(Boolean);
                if (choice?.selectableTargetIds.length)
                  command.command = {
                    type: 'skill',
                    skillId: choice.skillId,
                    targets: choice.selectableTargetIds.slice(
                      0,
                      choice.targetCount,
                    ),
                  };
              }
              host.submitGroup(commands);
              host.resolveRound();
            }
            expect(
              host.trace().outcome,
              `${realm}/${floor}/${sect}/${seed}`,
            ).toBe('victory');
            samples.push({ sect, seed, rounds: host.trace().rounds.length });
          }
        }
        samples.sort((a, b) => a.rounds - b.rounds);
        const median = (samples[2].rounds + samples[3].rounds) / 2;
        console.info(
          'tower-health',
          realm,
          floor,
          JSON.stringify(samples),
          median,
        );
        expect.soft(median).toBeGreaterThanOrEqual(min);
        expect.soft(median).toBeLessThanOrEqual(max);
      }
    }, 20000);
  }
});

it('满炼体均衡渡劫角色的三段暴击不能直接击杀满血末层首领', () => {
  const player = towerReferenceBuild('lingxiao', '渡劫');
  player.cultivator.attributes = {
    vitality: 322,
    strength: 322,
    spirit: 322,
    endurance: 322,
    speed: 321,
    willpower: 321,
  };
  const actor = projectTowerPlayer(player, { physical_power: 3 }).unit;
  for (const candidate of TOWER_ENCOUNTERS.filter((e) =>
    e.kinds.some((k) => k === 'boss'),
  )) {
    const selected = {
      ...week,
      floors: week.floors.map((row) =>
        row.floor === 20 ? { ...row, ...candidate } : row,
      ),
    };
    const encounter = compileTowerEncounter('渡劫', 20, selected);
    const boss = encounter.units[0];
    // The opening burst includes the encounter's living guards. Removing them
    // first costs earlier actions and is not an opening one-action kill.
    const guards = encounter.units.filter((u) =>
      u.passives?.includes('tower.mirror-guard.target.0'),
    ).length;
    const guardFactor =
      1 - Math.min(guards, mechanics.guardStacks) * mechanics.guardReduction;
    const base = physicalBase(
      actor.attrs.physicalAtk!,
      boss.attrs.physicalDef!,
    );
    const burst = [0.75, 0.85, 0.95].reduce(
      (sum, coeff) =>
        sum +
        Math.floor(
          Math.floor(Math.floor(applyCultivate(base * coeff, 60)) * 2 * 1.1) *
            guardFactor,
        ),
      0,
    );
    expect(boss.attrs.maxHp, candidate.id).toBeGreaterThan(burst);
  }
});
