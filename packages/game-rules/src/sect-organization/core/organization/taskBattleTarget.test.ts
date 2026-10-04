import { describe, expect, it } from 'vitest';
import {
  readSectBattleTargetSnapshot,
  resolveSectBattleTargetRealmCandidates,
  summarizeSectBattleTarget,
} from './taskBattleTarget.js';

describe('sect battle target snapshot', () => {
  it.each([
    ['preset', '金丹', ['金丹']],
    ['same-sect', '炼气', ['炼气']],
    ['same-sect', '金丹', ['金丹', '筑基']],
    ['other-sect', '炼气', ['炼气']],
    ['other-sect', '金丹', ['金丹', '筑基']],
    ['other-sect', '渡劫', ['渡劫', '大乘']],
  ] as const)(
    'resolves %s target realm candidates from %s',
    (acquisition, realm, expected) => {
      expect(
        resolveSectBattleTargetRealmCandidates(realm, acquisition),
      ).toEqual(expected);
    },
  );

  it('reads current V6 target metadata', () => {
    const target = {
      schemaVersion: 2,
      kind: 'cultivator',
      sourceCultivatorId: '1e05106f-b997-4c77-a523-4a5191dc3f24',
      sourceSectId: 'source-sect',
      sourceSectName: '来源宗门',
      lockedAt: '2026-07-29T08:00:00.000Z',
      challengeTitle: '悬赏令·讨伐',
      name: '锁定目标',
      description: '领取时锁定的外宗目标。',
      realm: '金丹',
      realmStage: '后期',
      seed: 1,
      contentVersion: 'combat-v6-sect-task-v1',
      resourcePolicy: 'full',
      opponent: {
        version: 'sect-v6-opponent-v1',
        units: [{ id: 'opponent', side: 1 }],
        skills: [],
        statusDefs: [],
      },
    };
    const restored = readSectBattleTargetSnapshot({ battleTarget: target });
    expect(restored).toEqual(target);
    expect(summarizeSectBattleTarget(restored!)).toEqual({
      kind: 'cultivator',
      name: '锁定目标',
      description: '领取时锁定的外宗目标。',
      realm: '金丹',
      realmStage: '后期',
      sectId: 'source-sect',
      sectName: '来源宗门',
    });
  });

  it('does not accept retired task builds', () => {
    expect(
      readSectBattleTargetSnapshot({
        battleTarget: {
          schemaVersion: 1,
          kind: 'preset',
          combatant: { legacy: true },
        },
      }),
    ).toBeUndefined();
  });
});
