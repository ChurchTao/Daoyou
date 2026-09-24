import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto';
import { getRealmStageAttributeBudget } from '../../../config/realmProgression';
import {
  buildTowerBlessingChoices,
  TOWER_ELIGIBLE_REALMS,
} from '../../../lib/tower/helpers';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_ENCOUNTERS } from '../../../lib/tower/weekly';
import { createTowerHost, type TowerBlessings } from './host';
import { towerReferenceBuild } from './reference-fixtures';

const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
const seeds = [7, 42, 101];
const sects = ['lingxiao', 'jiujie', 'youdu', 'wuxiang', 'tianyan'] as const;
function blessingsFor(
  sect: (typeof sects)[number],
  floor: number,
  runId: string,
  preference: 'offense' | 'guard' = 'offense',
) {
  const blessings: TowerBlessings = {};
  const priorities = [
    sect === 'lingxiao'
      ? 'physical_power'
      : sect === 'jiujie' || sect === 'tianyan'
        ? 'spell_power'
        : 'beast_power',
    'guard',
    'beast_power',
    'swiftness',
    'spell_power',
    'physical_power',
  ];
  if (preference === 'guard') priorities.unshift('guard');
  for (let clearedFloor = 0; clearedFloor < floor; clearedFloor++) {
    const choices = buildTowerBlessingChoices({
      runId,
      clearedFloor,
      blessings,
      hasBeasts: true,
    });
    const chosen = choices.sort(
      (a, b) => priorities.indexOf(a.id) - priorities.indexOf(b.id),
    )[0];
    if (chosen) blessings[chosen.id] = chosen.nextStacks;
  }
  return blessings;
}
function play(
  host: ReturnType<typeof createTowerHost>,
  sect: (typeof sects)[number],
) {
  let firstRoundDeath = false;
  for (let turn = 0; turn < 60 && !host.finished; turn++) {
    const snapshot = host.runtimeSnapshot();
    const commands = automaticCommands(
      host.state,
      host.playerId,
      snapshot.input.skills ?? [],
      (id) => host.queryCommands(id),
      { statusDefs: snapshot.input.statusDefs },
    );
    // An explicit player policy for the test, not a tower-specific runtime AUTO.
    const enemies = host.state.units.filter(
      (u) => u.side === 1 && u.attrs.hp > 0,
    );
    const target = enemies.find((u) => u.slot > 0) ?? enemies[0];
    for (const entry of commands) {
      const options = host.queryCommands(entry.unitId);
      if (
        entry.command.type === 'attack' &&
        options.attackTargetIds.includes(target.id)
      )
        entry.command = { type: 'attack', target: target.id };
      if (entry.unitId !== host.playerId) continue;
      const priorities = sect === 'jiujie' ? ['jiujie.skill.thunderstorm'] : [];
      const selected = priorities
        .map((id) =>
          options.skills.find(
            (s) =>
              s.skillId === id &&
              s.ready &&
              s.selectableTargetIds.includes(target.id),
          ),
        )
        .find(Boolean);
      if (selected)
        entry.command = {
          type: 'skill',
          skillId: selected.skillId,
          targets: [
            target.id,
            ...selected.selectableTargetIds.filter((id) => id !== target.id),
          ].slice(0, selected.targetCount),
        };
      else if (entry.command.type === 'skill') {
        const choice = options.skills.find(
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
      if (
        sect === 'jiujie' &&
        enemies.length === 1 &&
        !target.statuses.some((s) => s.category === 'control')
      ) {
        const physical = snapshot.npcPlans[target.id]?.cycle.some((id) =>
          snapshot.input.skills
            ?.find((s) => s.id === id)
            ?.effects.some((e) => e.type === 'physicalHit'),
        );
        const seal = options.skills.find(
          (s) =>
            s.skillId === 'jiujie.skill.million_weapons' &&
            s.ready &&
            s.selectableTargetIds.includes(target.id),
        );
        const player = host.state.units.find((u) => u.id === host.playerId)!;
        if (
          physical &&
          seal &&
          (host.state.round === 1 || player.attrs.hp < player.attrs.maxHp * 0.5)
        )
          entry.command = {
            type: 'skill',
            skillId: seal.skillId,
            targets: [target.id],
          };
      }
    }
    host.submitGroup(commands);
    host.resolveRound();
    if (turn === 0)
      firstRoundDeath =
        host.state.units.find((u) => u.id === host.playerId)!.attrs.hp === 0;
  }
  return {
    win: host.trace().outcome === 'victory',
    rounds: host.trace().rounds.length,
    firstRoundDeath,
    finished: host.finished,
  };
}
describe('七境界正常装备普通宠物的关键层', () => {
  for (const realm of TOWER_ELIGIBLE_REALMS)
    for (const sect of sects) {
      it(`${realm}/${sect} 全候选具备通关路径`, () => {
        const player = towerReferenceBuild(sect, realm);
        console.info(
          'tower-reference-panel',
          realm,
          sect,
          JSON.stringify(
            createTowerHost(player, realm, 1, {}, week, 42)
              .state.units.filter((u) => u.side === 0)
              .map((u) => ({ kind: u.kind, attrs: u.attrs })),
          ),
        );
        const rows = [];
        for (const floor of [5, 10, 15, 20])
          for (const candidate of TOWER_ENCOUNTERS.filter((e) =>
            e.kinds.some((k) => k === (floor % 10 === 0 ? 'boss' : 'elite')),
          )) {
            const selected = {
              ...week,
              floors: week.floors.map((r) =>
                r.floor === floor ? { ...r, ...candidate } : r,
              ),
            };
            const results = seeds.map((seed) =>
              play(
                createTowerHost(
                  player,
                  realm,
                  floor,
                  blessingsFor(sect, floor, `phase3-${sect}`),
                  selected,
                  seed,
                ),
                sect,
              ),
            );
            expect(results.every((r) => r.finished)).toBe(true);
            rows.push({
              floor,
              candidate: candidate.id,
              wins: results.filter((r) => r.win).length,
              rounds: results.map((r) => r.rounds),
              firstDeaths: results.filter((r) => r.firstRoundDeath).length,
            });
          }
        console.info('tower-phase3', realm, sect, JSON.stringify(rows));
        expect(
          rows.filter((r) => r.wins === 0),
          '没有通关样本的组合',
        ).toEqual([]);
        expect(
          rows.filter((r) => r.firstDeaths === seeds.length),
          '稳定开局击杀',
        ).toEqual([]);
      }, 20000);
    }
});

describe('养成上下沿与防御集中祝福', () => {
  for (const realm of TOWER_ELIGIBLE_REALMS) {
    it(`${realm} 合法属性预算与末层可结束`, () => {
      const rows = [];
      for (const sect of sects)
        for (const stage of ['初期', '圆满'] as const) {
          const player = towerReferenceBuild(sect, realm, stage);
          expect(
            Object.values(player.cultivator.attributes).reduce(
              (a, b) => a + b,
              0,
            ),
          ).toBe(getRealmStageAttributeBudget(realm, stage));
          const results = seeds.map((seed) =>
            play(
              createTowerHost(
                player,
                realm,
                20,
                blessingsFor(sect, 20, `edge-${seed}`, 'guard'),
                week,
                seed,
              ),
              sect,
            ),
          );
          expect(results.every((r) => r.finished)).toBe(true);
          if (stage === '圆满')
            expect(
              results.some((r) => r.win),
              sect,
            ).toBe(true);
          rows.push({
            sect,
            stage,
            wins: results.filter((r) => r.win).length,
            rounds: results.map((r) => r.rounds),
          });
        }
      console.info('tower-phase3-edges', realm, JSON.stringify(rows));
    }, 20000);
  }
});

describe('正常构筑连续爬塔，失败停止且祝福来自真实候选', () => {
  for (const realm of TOWER_ELIGIBLE_REALMS)
    for (const sect of sects) {
      it(`${realm}/${sect} 三周完整推进`, () => {
        const player = towerReferenceBuild(sect, realm);
        const rows = [];
        for (const offset of [0, 1, 2]) {
          const selected = createTowerWeek(
            getTowerSeasonMeta(new Date(Date.UTC(2026, 8, 19 + offset * 7))),
          );
          const clears = [];
          for (const seed of seeds) {
            const runId = `continuous-${sect}-${seed}`;
            let reached = 0;
            let rounds = 0;
            for (let floor = 1; floor <= 20; floor++) {
              const result = play(
                createTowerHost(
                  player,
                  realm,
                  floor,
                  blessingsFor(sect, floor, runId),
                  selected,
                  seed,
                ),
                sect,
              );
              expect(result.finished).toBe(true);
              rounds += result.rounds;
              if (!result.win) break;
              reached = floor;
            }
            clears.push(reached);
            rows.push({ week: selected.seasonKey, seed, reached, rounds });
          }
          expect(clears, `${selected.seasonKey} 无完整通关样本`).toContain(20);
        }
        console.info(
          'tower-phase3-continuous',
          realm,
          sect,
          JSON.stringify(rows),
        );
      }, 20000);
    }
});
