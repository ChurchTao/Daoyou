import { describe, expect, it } from 'vitest';
import {
  BATTLE_REPLAY_SUBJECT,
  parseBattleReplayArchiveJob,
} from './battleReplay';

const validJob = {
  version: 'battle_replay_archive_job_v2',
  subject: BATTLE_REPLAY_SUBJECT,
  matchId: 'match_123-safe',
  attempt: 1,
  byteLength: 1_024,
  checksum: 'a'.repeat(64),
} as const;

describe('battle replay archive job v2', () => {
  it('accepts a bounded lightweight archive job', () => {
    expect(parseBattleReplayArchiveJob(validJob)).toEqual(validJob);
  });

  it.each([
    { ...validJob, matchId: 'invalid/match' },
    { ...validJob, attempt: 0 },
    { ...validJob, byteLength: 0 },
    { ...validJob, checksum: 'not-a-sha256' },
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
