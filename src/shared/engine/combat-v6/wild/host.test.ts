import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import {
  wildEncounterView,
  WildRuntimeSchema,
} from '../../../contracts/combatV6Wild';
import { WILD_DROP_POOLS } from '../../../rewards/wild';
import { BEAST_SKILLS } from '../beasts/content';
import { activeBeastSkills, beastPanel } from '../beasts/projection';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../content';
import { SkillTag } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import { generateWildIndividual } from './generator';
import { createWildHost, WildHost } from './host';

function player(id: string): CombatV6TrainingPlayerInput {
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4.youdu;
  const track = { level: 0, progress: 0 };
  const condition: CultivatorCondition = {
    version: 1,
    resources: { hp: { current: 100 }, mp: { current: 0 } },
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
    timestamps: { lastRecoveryAt: '2026-09-08T00:00:00.000Z' },
  };
  return {
    cultivator: {
      id,
      name: id,
      realm: '炼气',
      realm_stage: '后期',
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
    sect: {
      version: 1,
      sectId: 'youdu',
      methods: Object.fromEntries(definition.methods.map((m) => [m.id, 1])),
      activePathId: definition.paths[0].id,
      meridianDepth: 0,
      meridianLoadouts: definition.paths.map((p) => ({
        pathId: p.id,
        nodeIds: [],
        revision: 0,
      })) as CombatV6TrainingPlayerInput['sect']['meridianLoadouts'],
    },
    equipment: {},
    manuals: { version: 1, revision: 0, learned: [], build: { slots: [] } },
  };
}

const owner = '10000000-0000-4000-8000-000000000001';
const encounterId = '20000000-0000-4000-8000-000000000001';
const nodeId = 'SAT_TN_08';
function individuals() {
  return [0, 12].map((level, i) =>
    generateWildIndividual(
      {
        unitId: `combat.wild.enemy.${i}`,
        speciesId: 'combat.wild.species.spirit-fox',
        level,
      },
      `30000000-0000-4000-8000-00000000000${i}`,
      owner,
      83 + i,
    ),
  );
}
describe('野外所见即所得', () => {
  it('预览只公开物种和等级，战斗使用已生成个体的面板、技能与被动', () => {
    const combatants = individuals();
    const encounter = {
      id: encounterId,
      nodeId,
      seed: 15,
      createdAt: '2026-09-17T00:00:00.000Z',
      combatants,
    };
    expect(wildEncounterView(encounter).combatants[0]).toEqual({
      unitId: 'combat.wild.enemy.0',
      speciesId: 'combat.wild.species.spirit-fox',
      level: 0,
    });
    const host = createWildHost(nodeId, 15, player(owner), combatants);
    const snapshot = host.runtimeSnapshot();
    for (const c of combatants) {
      const unit = snapshot.input.units.find((u) => u.id === c.unitId)!;
      expect(unit.level).toBe(c.level);
      expect(unit.attrs).toEqual(beastPanel(c.beast));
      expect(unit.skillLevels).toEqual(
        Object.fromEntries(c.beast.skills.map((id) => [id, c.level])),
      );
      expect(unit.skills).toEqual(
        activeBeastSkills(c.beast).filter(
          (id) =>
            !BEAST_SKILLS.find((s) => s.id === id)!.tags.includes(
              SkillTag.Passive,
            ),
        ),
      );
      expect(
        snapshot.combatants.find((b) => b.unitId === c.unitId)!.beast,
      ).toEqual(c.beast);
    }
    combatants[0].beast.growth = 2;
    expect(host.runtimeSnapshot()).toEqual(snapshot);
    const restored = new WildHost(snapshot, snapshot);
    host.submit(host.playerId, { type: 'defend' });
    restored.submit(restored.playerId, { type: 'defend' });
    host.resolveRound();
    restored.resolveRound();
    expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
    expect(host.runtimeSnapshot().combatants).toEqual(snapshot.combatants);
  });
  it('新战局包含0级个体与头像时仍能通过存储契约', () => {
    const host = createWildHost(nodeId, 15, player(owner), individuals());
    const snapshot = host.runtimeSnapshot();
    const runtime = {
      runtimeVersion: 'combat_v6_redis_runtime_v1',
      battleId: encounterId,
      userId: owner,
      cultivatorId: owner,
      membershipId: owner,
      metadata: {
        schemaVersion: 1,
        sourceType: 'wild-encounter',
        battleType: 'pve',
        idempotencyKey: encounterId,
        payload: {
          nodeId,
          encounterContentVersion: 'daoyou_wild_seeking_content_v2',
          combatants: snapshot.combatants.map(
            ({ unitId, speciesId, level }) => ({ unitId, speciesId, level }),
          ),
        },
      },
      revision: 0,
      createdAt: '2026-09-17T00:00:00.000Z',
      expiresAt: '2026-09-17T02:00:00.000Z',
      latestEventSeq: snapshot.events.length - 1,
      host: snapshot,
      dropPool: WILD_DROP_POOLS[nodeId],
    };
    expect(WildRuntimeSchema.parse(runtime).host.combatants[0].beast).toEqual(
      snapshot.combatants[0].beast,
    );
  });
});
