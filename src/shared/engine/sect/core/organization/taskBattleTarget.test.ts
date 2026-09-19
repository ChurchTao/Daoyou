import { describe, expect, it } from 'vitest';
import {
  SECT_BATTLE_TARGET_SCHEMA_VERSION,
  SectBattleTargetSnapshotSchema,
  readSectBattleTargetSnapshot,
  resolveSectBattleTargetRealmCandidates,
  summarizeSectBattleTarget,
} from './taskBattleTarget';

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

  it('reads historical target metadata without retaining a battle build', () => {
    const snapshot = SectBattleTargetSnapshotSchema.parse({
      schemaVersion: SECT_BATTLE_TARGET_SCHEMA_VERSION,
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
      combatant: { legacy: 'discard this entire battle build' },
    });
    const restored = readSectBattleTargetSnapshot({
      battleTarget: JSON.parse(JSON.stringify(snapshot)),
    });

    expect(restored).toEqual(snapshot);
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

  it('discards the complete legacy combat build', () => {
    const summary = readSectBattleTargetSnapshot({
      battleTarget: {
        schemaVersion: 1,
        kind: 'preset',
        presetId: 'old',
        rulesVersion: 1,
        challengeTitle: '历史试炼',
        name: '旧对手',
        description: '已停用',
        realm: '金丹',
        realmStage: '后期',
        combatant: { malformed: true },
      },
    });
    expect(summary).toBeDefined();
    expect(summary).not.toHaveProperty('combatant');
  });
});
