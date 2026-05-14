import {
  runArtifactGuardBaselineBattle,
  runBaselineMirrorBattle,
  runGongfaSustainBaselineBattle,
} from '@shared/engine/creation-v2/tests/helpers/BattleRegressionHarness';

const SEEDS = [4101, 4102, 4103, 4104, 4105, 4106, 4107, 4108];

function summarize(
  runner: (seed: number) => ReturnType<typeof runBaselineMirrorBattle>,
) {
  const duels = SEEDS.map((seed) => runner(seed));

  return {
    avgTurns:
      duels.reduce((sum, duel) => sum + duel.battleResult.turns, 0) /
      duels.length,
    stallRate:
      duels.filter((duel) => duel.reachedMaxTurns).length / duels.length,
  };
}

describe('battle baseline template regression', () => {
  it('被动基线模板应比 mirror 更慢，但不应明显拖成僵局', () => {
    const mirror = summarize(runBaselineMirrorBattle);
    const artifactGuard = summarize(runArtifactGuardBaselineBattle);
    const gongfaSustain = summarize(runGongfaSustainBaselineBattle);

    expect(mirror.avgTurns).toBeGreaterThanOrEqual(8);
    expect(mirror.avgTurns).toBeLessThanOrEqual(20);

    expect(artifactGuard.avgTurns).toBeGreaterThanOrEqual(mirror.avgTurns);
    expect(gongfaSustain.avgTurns).toBeGreaterThanOrEqual(mirror.avgTurns);

    expect(artifactGuard.avgTurns).toBeLessThanOrEqual(20);
    expect(gongfaSustain.avgTurns).toBeLessThanOrEqual(20);

    expect(artifactGuard.stallRate).toBeLessThanOrEqual(0.2);
    expect(gongfaSustain.stallRate).toBeLessThanOrEqual(0.2);
  });
});