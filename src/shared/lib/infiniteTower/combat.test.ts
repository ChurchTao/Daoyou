import { automaticCommands } from '@shared/combat-v6/auto';
import {
  combatV6ReplayView,
  createCombatV6Replay,
} from '@shared/combat-v6/replay';
import {
  BEAST_SPECIES,
  generateStarterBeast,
} from '@shared/engine/combat-v6/beasts';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from '@shared/engine/combat-v6/content';
import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import { createInfiniteTowerHost } from './combat';
function player(sectId: CombatV6SectId) {
  const def = COMBAT_V6_SECT_DEFINITIONS_V4[sectId];
  const track = { level: 0, progress: 0 };
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 100 }, mp: { current: 40 } },
    gauges: { pillToxicity: 0 },
    tracks: {
      tempering: {
        vitality: track,
        spirit: track,
        wisdom: track,
        speed: track,
        willpower: track,
      },
      marrowWash: track,
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
    },
    statuses: [],
    timestamps: { lastRecoveryAt: '2026-09-05T00:00:00.000Z' },
  };
  const sect: SectCombatProgressV6 = {
    version: 1,
    sectId,
    methods: Object.fromEntries(def.methods.map((m) => [m.id, 1])),
    activePathId: def.paths[0].id,
    meridianDepth: 0,
    meridianLoadouts: def.paths.map((p) => ({
      pathId: p.id,
      nodeIds: [],
      revision: 0,
    })) as SectCombatProgressV6['meridianLoadouts'],
  };
  return {
    cultivator: {
      id: 'player',
      name: '初入道途',
      realm: '金丹' as const,
      realm_stage: '初期' as const,
      attributes: {
        vitality: 10,
        strength: 10,
        spirit: 10,
        endurance: 10,
        speed: 10,
        willpower: 10,
      },
      condition,
    },
    sect,
    equipment: {},
    manuals: {
      version: 1 as const,
      revision: 0,
      learned: [],
      build: { slots: [] },
    },
  };
}

describe('permanent tower V6 adapter', () => {
  it.each([1, 20, 21, 180, 181])(
    'resolves floor %i reproducibly with current sect builds and a valid replay',
    (floor) => {
      const p = player('lingxiao');
      const before = structuredClone(p);
      const resolve = () => {
        const host = createInfiniteTowerHost(p, floor, 'player');
        const input = host.runtimeSnapshot().input;
        for (let i = 0; !host.finished && i < 300; i++) {
          host.submitGroup(
            automaticCommands(
              host.state,
              host.playerId,
              input.skills ?? [],
              (id) => host.queryCommands(id),
              { statusDefs: input.statusDefs },
            ),
          );
          host.resolveRound();
        }
        expect(host.finished).toBe(true);
        return host;
      };
      const first = resolve(),
        second = resolve();
      expect(first.trace()).toEqual(second.trace());
      expect(p).toEqual(before);
      const id = '00000000-0000-4000-8000-000000000001';
      const archive = createCombatV6Replay({
        battleId: id,
        participants: [
          {
            userId: id,
            cultivatorId: id,
            unitId: first.playerId,
            side: 0,
            slot: 0,
          },
        ],
        metadata: {
          schemaVersion: 1,
          sourceType: 'infinite-tower',
          battleType: 'pve',
          idempotencyKey: id,
          payload: { runId: id, floor },
        },
        startedAt: '2026-09-20T00:00:00.000Z',
        finishedAt: '2026-09-20T00:00:01.000Z',
        reason: 'battle-ended',
        trace: { ...first.trace(), seed: first.runtimeSnapshot().input.seed! },
      });
      expect(
        combatV6ReplayView(archive, id, id).timeline.frames.length,
      ).toBeGreaterThan(0);
    },
  );
  it('scales endless enemies without granting that scaling to the player', () => {
    const p = player('youdu');
    const normal = createInfiniteTowerHost(p, 180, 'player').state.units;
    const endless = createInfiniteTowerHost(p, 181, 'player').state.units;
    expect(endless.filter((u) => u.side === 0).map((u) => u.attrs)).toEqual(
      normal.filter((u) => u.side === 0).map((u) => u.attrs),
    );
    for (const enemy of normal.filter((u) => u.side === 1)) {
      const scaled = endless.find((u) => u.id === enemy.id)!;
      expect(scaled.attrs.maxHp).toBe(Math.round(enemy.attrs.maxHp * 1.05));
      expect(scaled.attrs.physicalAtk).toBe(
        Math.round(enemy.attrs.physicalAtk * 1.05),
      );
      expect(scaled.attrs.magicAtk).toBe(
        Math.round(enemy.attrs.magicAtk * 1.05),
      );
    }
  });
  it('includes the owned lead beast at full resources without changing its saved state', () => {
    const p = player('youdu');
    const owner = '00000000-0000-4000-8000-000000000001';
    p.cultivator.id = owner;
    const beast = generateStarterBeast(
      '00000000-0000-4000-8000-000000000002',
      owner,
      BEAST_SPECIES[0].id,
      42,
    );
    const input = {
      ...p,
      beasts: {
        beasts: [beast],
        lineup: {
          carriedBeastIds: [beast.id],
          leadBeastId: beast.id,
          revision: 0,
        },
      },
    };
    const before = structuredClone(input);
    const host = createInfiniteTowerHost(input, 1, owner);
    const pet = host.state.units.find((u) => u.kind === 'pet');
    expect(pet).toBeDefined();
    expect(pet!.attrs.hp).toBe(pet!.attrs.maxHp);
    expect(pet!.ownerId).toBe(owner);
    expect(input).toEqual(before);
  });
});
