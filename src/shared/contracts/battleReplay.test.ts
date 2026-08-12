import { describe, expect, it } from 'vitest';
import {
  BATTLE_REPLAY_SUBJECT,
  parseBattleReplayArchiveJob,
} from './battleReplay';

const validJob = {
  version: 'battle_replay_archive_job_v3',
  subject: BATTLE_REPLAY_SUBJECT,
  matchId: 'match_123-safe',
  expectedStorageRevision: 42,
  attempt: 1,
} as const;

describe('battle replay archive job v3', () => {
  it('accepts a bounded lightweight archive job', () => {
    expect(parseBattleReplayArchiveJob(validJob)).toEqual(validJob);
  });

  it.each([
    { ...validJob, matchId: 'invalid/match' },
    { ...validJob, attempt: 0 },
    { ...validJob, expectedStorageRevision: -1 },
    { ...validJob, unexpected: true },
  ])('rejects invalid job metadata', (job) => {
    expect(() => parseBattleReplayArchiveJob(job)).toThrow();
  });

  it('rejects the retired full-replay v1 message', () => {
    expect(() => parseBattleReplayArchiveJob({
      version: 'battle_replay_archive_message_v1',
      subject: BATTLE_REPLAY_SUBJECT,
      replay: {},
    })).toThrow();
  });
});
