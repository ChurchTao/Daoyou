import {
  buildDungeonBattleInit,
  buildPersistentStatus,
  incrementOrInsertStatus,
  promoteInjuryStatus,
} from './battleInit';

describe('dungeon battle init helpers', () => {
  test('副本状态可转为统一的 battleInit 配置', () => {
    const weakness = buildPersistentStatus('weakness', 2);
    const now = new Date().toISOString();

    const battleInit = buildDungeonBattleInit({
      condition: {
        version: 1,
        resources: {
          hp: { current: 750 },
          mp: { current: 360 },
        },
        gauges: {
          pillToxicity: 0,
        },
        tracks: {
          tempering: {
            vitality: { level: 0, progress: 0 },
            spirit: { level: 0, progress: 0 },
            wisdom: { level: 0, progress: 0 },
            speed: { level: 0, progress: 0 },
            willpower: { level: 0, progress: 0 },
          },
          marrowWash: { level: 0, progress: 0 },
        },
        counters: {
          longTermPillUsesByRealm: {},
        },
        statuses: [weakness],
        timestamps: {
          lastRecoveryAt: now,
        },
      },
    });

    expect(battleInit.player?.resourceState?.hp).toEqual({
      mode: 'absolute',
      value: 750,
    });
    expect(battleInit.player?.resourceState?.mp).toEqual({
      mode: 'absolute',
      value: 360,
    });
    expect(battleInit.player?.statusRefs).toEqual([
      { version: 1, templateId: 'weakness', stacks: 2 },
    ]);
  });

  test('weakness 可叠层，伤势会按轻伤→重伤→濒死晋级', () => {
    const weaknessStatuses = incrementOrInsertStatus([], 'weakness', 2);
    const stackedWeakness = incrementOrInsertStatus(
      weaknessStatuses,
      'weakness',
      3,
    );

    expect(stackedWeakness[0].stacks).toBe(5);

    const minor = promoteInjuryStatus([]);
    const major = promoteInjuryStatus(minor);
    const nearDeath = promoteInjuryStatus(major);

    expect(minor.map((status) => status.key)).toEqual(['minor_wound']);
    expect(major.map((status) => status.key)).toEqual(['major_wound']);
    expect(nearDeath.map((status) => status.key)).toEqual([
      'near_death',
    ]);
  });
});
