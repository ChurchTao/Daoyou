import { describe, expect, it } from 'vitest';
import {
  createMiningField,
  MINING_MAX_CASTS,
  MINING_MAX_SCORE,
  miningAimAngleAt,
  miningLoadedRetractSpeed,
  miningScoreTier,
  simulateMiningTranscript,
  summarizeMiningCatches,
} from './MiningGameRules.js';

describe('sect spirit mining rules', () => {
  it('creates a deterministic field with varied ore sizes and two hazards', () => {
    const first = createMiningField('mining-field');
    const second = createMiningField('mining-field');

    expect(first).toEqual(second);
    expect(first).toHaveLength(18);
    expect(first.reduce((sum, ore) => sum + ore.score, 0)).toBe(
      MINING_MAX_SCORE,
    );
    expect(
      Object.fromEntries(
        ['spirit_crystal', 'copper_ore', 'dark_iron', 'earth_essence'].map(
          (kind) => [kind, first.filter((ore) => ore.kind === kind).length],
        ),
      ),
    ).toEqual({
      spirit_crystal: 6,
      copper_ore: 5,
      dark_iron: 3,
      earth_essence: 2,
    });
    expect(
      first.filter((target) => target.kind === 'explosive_barrel'),
    ).toHaveLength(2);
    for (const kind of [
      'spirit_crystal',
      'copper_ore',
      'dark_iron',
      'earth_essence',
    ] as const) {
      const sizes = new Set(
        first.flatMap((target) =>
          target.category === 'ore' && target.kind === kind
            ? [target.size]
            : [],
        ),
      );
      expect(sizes.size).toBeGreaterThanOrEqual(2);
    }
    for (let index = 0; index < first.length; index += 1) {
      const ore = first[index]!;
      expect(ore.x - ore.radius).toBeGreaterThanOrEqual(72);
      expect(ore.x + ore.radius).toBeLessThanOrEqual(1_048);
      expect(ore.y - ore.radius).toBeGreaterThanOrEqual(205);
      expect(ore.y + ore.radius).toBeLessThanOrEqual(592);
      for (const other of first.slice(index + 1)) {
        expect(
          Math.hypot(ore.x - other.x, ore.y - other.y),
        ).toBeGreaterThanOrEqual(ore.radius + other.radius + 10);
      }
    }
  });

  it('makes size-driven weight changes materially affect retract speed', () => {
    expect(miningLoadedRetractSpeed(0.5)).toBe(650);
    expect(miningLoadedRetractSpeed(1)).toBe(520);
    expect(miningLoadedRetractSpeed(2)).toBeLessThan(
      miningLoadedRetractSpeed(1),
    );
    expect(miningLoadedRetractSpeed(8)).toBe(90);
    expect(
      miningLoadedRetractSpeed(0.5) / miningLoadedRetractSpeed(8),
    ).toBeGreaterThan(7);
  });

  it('uses nearer targets as blockers until they have been collected', () => {
    const casts = [380, 3_180].map((atMs) => ({
      atMs,
      angleMilliDegrees: Math.round(miningAimAngleAt(atMs)),
    }));
    const first = simulateMiningTranscript('occlusion', casts.slice(0, 1));
    const unblocked = simulateMiningTranscript('occlusion', casts);

    expect(first.catches[0]?.targetId).toBe('spirit_crystal:0');
    expect(unblocked.catches.map((entry) => entry.targetId)).toEqual([
      'spirit_crystal:0',
      'earth_essence:1',
    ]);
    expect(unblocked.catches[1]!.score).toBeGreaterThan(
      unblocked.catches[0]!.score,
    );
  });

  it('detonates a caught barrel and removes nearby ore without awarding score', () => {
    const atMs = 1_040;
    const result = simulateMiningTranscript('explosion', [
      {
        atMs,
        angleMilliDegrees: Math.round(miningAimAngleAt(atMs)),
      },
    ]);

    expect(result.catches[0]?.kind).toBe('explosive_barrel');
    expect(result.catches[0]?.destroyedOreIds).toContain('copper_ore:0');
    expect(result.destroyedOreIds).toContain('copper_ore:0');
    expect(result.collectedOreIds).toHaveLength(0);
    expect(result.score).toBe(0);
  });

  it('uses stable score tier boundaries', () => {
    expect(
      miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.2) - 1),
    ).toBeUndefined();
    expect(miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.2))).toBe('D');
    expect(miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.35))).toBe('C');
    expect(miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.5))).toBe('B');
    expect(miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.65))).toBe('A');
    expect(miningScoreTier(Math.ceil(MINING_MAX_SCORE * 0.8))).toBe('S');
  });

  it('rejects impossible transcripts instead of trusting client score', () => {
    expect(
      simulateMiningTranscript(
        'too-many',
        Array.from({ length: MINING_MAX_CASTS + 1 }, (_, index) => ({
          atMs: index * 2_500,
          angleMilliDegrees: 0,
        })),
      ).reason,
    ).toBe('too_many_casts');
    expect(
      simulateMiningTranscript('angle', [
        { atMs: 0, angleMilliDegrees: 70_001 },
      ]).reason,
    ).toBe('invalid_angle');
    expect(
      simulateMiningTranscript('forged-angle', [
        { atMs: 0, angleMilliDegrees: 0 },
      ]).reason,
    ).toBe('invalid_angle');
    expect(
      simulateMiningTranscript('busy', [
        { atMs: 0, angleMilliDegrees: -70_000 },
        {
          atMs: 1,
          angleMilliDegrees: Math.round(miningAimAngleAt(1)),
        },
      ]).reason,
    ).toBe('hook_busy');
    expect(
      simulateMiningTranscript('late', [{ atMs: 60_000, angleMilliDegrees: 0 }])
        .reason,
    ).toBe('invalid_time');
  });

  it('keeps collected ores unique and leaves a normal run open for sixty seconds', () => {
    const seed = 'repeat-catch';
    let firstAtMs = 0;
    let first = simulateMiningTranscript(seed, []);
    for (let atMs = 0; atMs < 2_800; atMs += 10) {
      const candidate = simulateMiningTranscript(seed, [
        {
          atMs,
          angleMilliDegrees: Math.round(miningAimAngleAt(atMs)),
        },
      ]);
      if (candidate.catches.length) {
        firstAtMs = atMs;
        first = candidate;
        break;
      }
    }
    expect(first.catches).toHaveLength(1);

    const periodsUntilReady = Math.ceil(
      (first.availableAtMs - firstAtMs) / 2_800,
    );
    const repeatAtMs = firstAtMs + periodsUntilReady * 2_800;
    const repeated = simulateMiningTranscript(seed, [
      {
        atMs: firstAtMs,
        angleMilliDegrees: Math.round(miningAimAngleAt(firstAtMs)),
      },
      {
        atMs: repeatAtMs,
        angleMilliDegrees: Math.round(miningAimAngleAt(repeatAtMs)),
      },
    ]);

    expect(repeated.valid).toBe(true);
    expect(new Set(repeated.collectedOreIds).size).toBe(
      repeated.collectedOreIds.length,
    );
    expect(
      repeated.catches.filter(
        (entry) => entry.targetId === first.catches[0]!.targetId,
      ),
    ).toHaveLength(1);
    expect(simulateMiningTranscript('countdown', []).completedAtMs).toBe(
      60_000,
    );
    expect(summarizeMiningCatches(repeated.catches)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ count: expect.any(Number) }),
      ]),
    );
  });
});
