import type { CultivatorCondition } from '@shared/types/condition';
import { describe, expect, it } from 'vitest';
import { generateStarterBeast } from '../beasts';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '../content';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  createSectBattleHost,
  freezeSectBattleOpponent,
  freezeSectNpcOpponent,
  SectBattleHost,
} from './host';

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
    manuals: { version: 1, revision: 0, build: { slots: [] } },
  };
}

describe('宗门任务原生 V6 Host', () => {
  it('现实资源保留零法力，演武满资源隔离，不修改角色输入', () => {
    const input = player('player');
    const before = structuredClone(input);
    const opponent = freezeSectBattleOpponent(player('enemy'));
    const real = createSectBattleHost(input, opponent, 'persistent', 31);
    const full = createSectBattleHost(input, opponent, 'full', 31);
    expect(real.state.units[0].attrs).toMatchObject({ hp: 100, mp: 0 });
    const attrs = full.state.units[0].attrs;
    expect(attrs.hp).toBe(attrs.maxHp);
    expect(attrs.mp).toBe(attrs.maxMp);
    expect(input).toEqual(before);
  });

  it('领取后目标构筑和首发灵兽冻结，排除后备宠', () => {
    const owner = '10000000-0000-4000-8000-000000000001';
    const target = player(owner);
    const beasts = [1, 2].map((i) =>
      generateStarterBeast(
        `20000000-0000-4000-8000-00000000000${i}`,
        owner,
        'combat.wild.species.spirit-fox',
        i,
      ),
    );
    target.beasts = {
      beasts,
      lineup: {
        carriedBeastIds: beasts.map((b) => b.id),
        leadBeastId: beasts[0].id,
        revision: 0,
      },
    };
    const frozen = freezeSectBattleOpponent(target);
    const before = structuredClone(frozen);
    target.cultivator.name = '改名';
    beasts[0].name = '换名';
    target.beasts.lineup.leadBeastId = beasts[1].id;
    expect(frozen).toEqual(before);
    expect(frozen.units.map((u) => u.id)).toEqual([
      owner,
      `beast:${beasts[0].id}`,
    ]);
  });

  for (const template of ['mine_patrol', 'elder_trial'] as const) {
    it(`${template} 保存恢复得到相同的下一回合行动和随机数`, () => {
      const host = createSectBattleHost(
        player('player'),
        freezeSectNpcOpponent(template, 5),
        'full',
        47,
      );
      host.submit(host.playerId, { type: 'defend' });
      const snapshot = host.runtimeSnapshot();
      const restored = new SectBattleHost(snapshot, snapshot);
      host.resolveRound();
      restored.resolveRound();
      expect(restored.runtimeSnapshot()).toEqual(host.runtimeSnapshot());
      expect(
        host
          .trace()
          .rounds[0].commands.some(
            (c) => c.unitId !== host.playerId && c.command.type === 'attack',
          ),
      ).toBe(true);
      expect(
        host.queryCommands().skills.some((s) => s.skillId.includes('capture')),
      ).toBe(false);
    });
  }

  it('拒绝自身副本和错误版本，不能把旧快照当作新版恢复', () => {
    const input = player('player');
    expect(() =>
      createSectBattleHost(input, freezeSectBattleOpponent(input), 'full', 1),
    ).toThrow();
    const host = createSectBattleHost(
      input,
      freezeSectNpcOpponent('mine_patrol', 5),
      'full',
      1,
    );
    const snapshot = host.runtimeSnapshot();
    snapshot.input.versions!.contentVersion = 'combat-v6-dungeon-v1';
    expect(() => new SectBattleHost(snapshot, snapshot)).toThrow('版本');
  });
});
