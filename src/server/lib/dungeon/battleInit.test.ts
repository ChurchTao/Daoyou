import {
  buildDungeonBattleInit,
  buildPersistentStatus,
  incrementOrInsertStatus,
  promoteInjuryStatus,
} from './battleInit';

describe('dungeon battle init helpers', () => {
  test('副本状态可转为统一的 battleInit 配置', () => {
    const weakness = buildPersistentStatus('weakness', 2);

    const battleInit = buildDungeonBattleInit({
      persistentState: {
        currentHp: 750,
        currentMp: 360,
      },
      persistentStatuses: [weakness],
    });

    expect(battleInit.player?.resourceState?.hp).toEqual({
      mode: 'absolute',
      value: 750,
    });
    expect(battleInit.player?.resourceState?.mp).toEqual({
      mode: 'absolute',
      value: 360,
    });
    expect(battleInit.player?.statusRefs).toEqual([weakness]);
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

    expect(minor.map((status) => status.templateId)).toEqual(['minor_wound']);
    expect(major.map((status) => status.templateId)).toEqual(['major_wound']);
    expect(nearDeath.map((status) => status.templateId)).toEqual([
      'near_death',
    ]);
  });
});
