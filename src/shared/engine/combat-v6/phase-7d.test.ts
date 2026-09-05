import {
  CombatV6BattleMetadataV1Schema,
  parseCombatV6Replay,
} from '@shared/contracts/combatV6Runtime';
import {
  WildExploreRequestSchema,
  WildRuntimeSchema,
} from '@shared/contracts/combatV6Wild';
import { getMapNode } from '@shared/lib/game/mapSystem';
import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import {
  COMBAT_V6_SECT_DEFINITIONS_V4,
  type CombatV6SectId,
  type SectCombatProgressV6,
} from './content/index.ts';
import {
  validateWildContent,
  WILD_REGION,
  WILD_SPECIES,
  wildPanel,
} from './wild/content.ts';
import {
  createWildHost,
  generateWildEncounter,
  WildHost,
} from './wild/host.ts';
import { settleWildResources, wildDay } from './wild/rules.ts';

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
      realm: '炼气' as const,
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
    manuals: { version: 1 as const, revision: 0, build: { slots: [] } },
  };
}

describe('Phase 7D wild content', () => {
  it('uses a map-owned species pool and independent level panels', () => {
    expect(getMapNode(WILD_REGION.nodeId)?.wild_encounter_id).toBe(
      WILD_REGION.id,
    );
    expect(validateWildContent()).toEqual([]);
    for (const species of WILD_SPECIES)
      for (let level = 5; level <= 15; level++)
        expect(wildPanel(species.id, level).maxHp).toBeGreaterThan(0);
    expect(() => wildPanel(WILD_SPECIES[0].id, 60)).toThrow();
    expect(() => generateWildEncounter('unknown', 1)).toThrow();
  });
  it('deterministically generates all counts, species and levels without player scaling', () => {
    const counts = new Set<number>(),
      levels = new Set<number>(),
      species = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const generated = generateWildEncounter(WILD_REGION.nodeId, seed);
      expect(generated).toEqual(
        generateWildEncounter(WILD_REGION.nodeId, seed),
      );
      counts.add(generated.length);
      for (const c of generated) {
        levels.add(c.level);
        species.add(c.speciesId);
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
    expect(levels.size).toBe(11);
    expect(species.size).toBe(3);
  });
  for (const sectId of Object.keys(
    COMBAT_V6_SECT_DEFINITIONS_V4,
  ) as CombatV6SectId[])
    it(`${sectId}: current resources, immutable input and restored battle match`, () => {
      const input = player(sectId),
        before = structuredClone(input);
      const host = createWildHost(WILD_REGION.nodeId, 42, input);
      expect(host.state.units[0]!.attrs.hp).toBe(100);
      host.submit(host.playerId, { type: 'defend' });
      const snapshot = host.runtimeSnapshot();
      const id = '00000000-0000-4000-8000-000000000001';
      const metadata = {
        schemaVersion: 1,
        sourceType: 'wild-encounter',
        battleType: 'pve',
        idempotencyKey: id,
        payload: {
          nodeId: WILD_REGION.nodeId,
          encounterContentVersion: 'daoyou_wild_encounter_content_v1',
          combatants: snapshot.combatants,
        },
      };
      const wire = {
        runtimeVersion: 'combat_v6_redis_runtime_v1',
        battleId: id,
        userId: id,
        cultivatorId: id,
        membershipId: id,
        buildRevision: 1,
        metadata,
        revision: 1,
        createdAt: '2026-09-05T00:00:00.000Z',
        expiresAt: '2026-09-05T02:00:00.000Z',
        latestEventSeq: snapshot.events.length - 1,
        host: snapshot,
      };
      expect(WildRuntimeSchema.safeParse(wire).success).toBe(true);
      expect(
        WildRuntimeSchema.safeParse({ ...wire, latestEventSeq: 9999 }).success,
      ).toBe(false);
      const restored = new WildHost(snapshot, snapshot);
      while (!host.finished) {
        const state = host.state;
        const target = state.units.find(
          (u) => u.side === 1 && !u.flags.dead && !u.flags.downed,
        );
        if (host.queryCommands().canSubmit) {
          const command = { type: 'attack' as const, target: target!.id };
          host.submit(host.playerId, command);
          restored.submit(restored.playerId, command);
        }
        host.resolveRound();
        restored.resolveRound();
      }
      expect(restored.trace()).toEqual(host.trace());
      const replay = {
        ...host.trace(),
        replayVersion: 'combat_v6_replay_v1',
        battleId: id,
        cultivatorId: id,
        metadata,
        startedAt: wire.createdAt,
        finishedAt: '2026-09-05T00:05:00.000Z',
      };
      expect(parseCombatV6Replay(replay).nodeId).toBe(WILD_REGION.nodeId);
      expect(() => parseCombatV6Replay({ ...replay, tier: 60 })).toThrow();
      expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
      expect(input).toEqual(before);
      const copy = host.runtimeSnapshot();
      copy.events.length = 0;
      expect(host.runtimeSnapshot().events.length).toBeGreaterThan(0);
    });
});
describe('Phase 7D resource and wire rules', () => {
  it('uses Shanghai midnight and keeps counters for 48h after that day', () => {
    const before = wildDay(Date.parse('2026-09-05T15:59:59Z')),
      after = wildDay(Date.parse('2026-09-05T16:00:00Z'));
    expect(before.key).toBe('2026-09-05');
    expect(after.key).toBe('2026-09-06');
    expect(before.expiresAt - before.resetAt).toBe(172800000);
  });
  it('retains net healing, clamps to true max, gives defeated players 1HP, and preserves entry on technical abort', () => {
    const entry = { hp: 30, mp: 20, maxHp: 100, maxMp: 80 };
    expect(
      settleWildResources({ ...entry, hp: 90, mp: 70 }, entry, false),
    ).toEqual({ ...entry, hp: 90, mp: 70 });
    expect(
      settleWildResources({ ...entry, hp: 300, mp: 300 }, entry, false),
    ).toEqual({ ...entry, hp: 100, mp: 80 });
    expect(
      settleWildResources({ ...entry, hp: 0, mp: 0 }, entry, false).hp,
    ).toBe(1);
    expect(
      settleWildResources({ ...entry, hp: 0, mp: 0 }, entry, true),
    ).toEqual(entry);
  });
  it('does not accept client-authored seed or metadata', () => {
    const request = {
      nodeId: WILD_REGION.nodeId,
      requestId: '00000000-0000-4000-8000-000000000001',
    };
    expect(WildExploreRequestSchema.safeParse(request).success).toBe(true);
    expect(
      WildExploreRequestSchema.safeParse({ ...request, seed: 1 }).success,
    ).toBe(false);
    const metadata = {
      schemaVersion: 1,
      sourceType: 'wild-encounter',
      battleType: 'pve',
      idempotencyKey: request.requestId,
      payload: {
        nodeId: WILD_REGION.nodeId,
        encounterContentVersion: 'daoyou_wild_encounter_content_v1',
        combatants: generateWildEncounter(WILD_REGION.nodeId, 7),
      },
    };
    expect(CombatV6BattleMetadataV1Schema.safeParse(metadata).success).toBe(
      true,
    );
    expect(
      CombatV6BattleMetadataV1Schema.safeParse({
        ...metadata,
        payload: { ...metadata.payload, taskId: 'x' },
      }).success,
    ).toBe(false);
  });
});
