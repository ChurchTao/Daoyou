import {
  CombatV6BuildInitializeRequestSchema,
  CombatV6TrainingCommandRequestSchema,
  CombatV6TrainingCreateRequestSchema,
  CombatV6TrainingEventsQuerySchema,
  CombatV6TrainingCommandParamsSchema,
  CombatV6TrainingSessionParamsSchema,
} from './combatV6';
import { CombatV6BattleFinishedDataV1Schema, CombatV6BattleFinishedRecordV1Schema, CombatV6ReplayArchiveMessageV1Schema, CombatV6TrainingBattleMetadataV1Schema } from './combatV6Runtime';

describe('combat-v6 Phase 7B contracts', () => {
  test('accepts only supported training tiers and strict build initialization', () => {
    expect(
      CombatV6BuildInitializeRequestSchema.parse({
        activePathId: 'lingxiao.path.zhanchen',
        expectedRevision: 0,
      }),
    ).toBeTruthy();
    expect(
      CombatV6BuildInitializeRequestSchema.safeParse({
        activePathId: 'x',
        expectedRevision: 1,
      }).success,
    ).toBe(false);
    expect(
      CombatV6TrainingCreateRequestSchema.safeParse({
        encounterId: 'combat.training.encounter.single-dummy',
        tier: 100,
      }).success,
    ).toBe(false);
  });

  test.each([
    { type: 'attack', target: 'enemy' },
    { type: 'skill', skillId: 'skill', targets: ['enemy'] },
    { type: 'defend' },
    { type: 'protect', target: 'ally' },
    { type: 'flee' },
  ])('accepts supported command $type', (command) => {
    expect(
      CombatV6TrainingCommandRequestSchema.safeParse({
        expectedRevision: 0,
        command,
      }).success,
    ).toBe(true);
  });

  test.each(['item', 'summon', 'catch', 'auto'])('rejects unsupported command %s', (type) => {
    expect(
      CombatV6TrainingCommandRequestSchema.safeParse({
        expectedRevision: 0,
        command: { type },
      }).success,
    ).toBe(false);
  });

  test('coerces the event cursor without accepting unrelated query fields', () => {
    expect(CombatV6TrainingEventsQuerySchema.parse({ afterEventSeq: '4' })).toEqual({
      afterEventSeq: 4,
    });
    expect(
      CombatV6TrainingEventsQuerySchema.safeParse({ extra: 'x' }).success,
    ).toBe(false);
  });

  test('validates opaque session and command route parameters', () => {
    const sessionId = '9942e266-6f21-4b96-8563-d476e581f612';
    expect(CombatV6TrainingSessionParamsSchema.safeParse({ sessionId }).success).toBe(true);
    expect(
      CombatV6TrainingCommandParamsSchema.safeParse({ sessionId, unitId: 'player' }).success,
    ).toBe(true);
    expect(CombatV6TrainingSessionParamsSchema.safeParse({ sessionId: 'guessable' }).success).toBe(false);
  });
});

describe('combat-v6 Phase 7C contracts', () => {
  const metadata = {
    schemaVersion: 1 as const,
    sourceType: 'training-room' as const,
    battleType: 'training' as const,
    idempotencyKey: '9942e266-6f21-4b96-8563-d476e581f612',
    payload: { encounterId: 'combat.training.encounter.single-dummy', tier: 60 as const },
  };

  test('元信息由sourceType判别且严格拒绝额外字段', () => {
    expect(CombatV6TrainingBattleMetadataV1Schema.parse(metadata)).toEqual(metadata);
    expect(CombatV6TrainingBattleMetadataV1Schema.safeParse({ ...metadata, taskId: 'forbidden' }).success).toBe(false);
  });

  test('终局事件明确区分业务幂等键、结果和终止原因', () => {
    expect(CombatV6BattleFinishedRecordV1Schema.safeParse({
      battleId: 'c431d125-c61d-423a-9b2d-dde9dd94daac', cultivatorId: '9942e266-6f21-4b96-8563-d476e581f612', metadata,
      combatVersions: { engineVersion: 'combat-v6', rulesetVersion: 'daoyou_rules_v5', contentVersion: 'x', projectionVersion: 'y' },
      startedAt: '2026-09-04T00:00:00.000Z', finishedAt: '2026-09-04T00:01:00.000Z', round: 2,
      outcome: 'aborted', reason: 'expired', replayExpected: false,
    }).success).toBe(true);
    expect(CombatV6BattleFinishedDataV1Schema.parse({ battleId: 'c431d125-c61d-423a-9b2d-dde9dd94daac' })).toEqual({ battleId: 'c431d125-c61d-423a-9b2d-dde9dd94daac' });
    expect(CombatV6ReplayArchiveMessageV1Schema.parse({ version: 'combat_v6_replay_archive_message_v1', battleId: 'c431d125-c61d-423a-9b2d-dde9dd94daac' })).toEqual({ version: 'combat_v6_replay_archive_message_v1', battleId: 'c431d125-c61d-423a-9b2d-dde9dd94daac' });
  });
});
