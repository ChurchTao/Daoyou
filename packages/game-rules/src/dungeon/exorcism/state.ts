import { SeededRng } from '@daoyou/combat-core/rng';
import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
} from '@daoyou/game-content/dungeon/exorcism';
import {
  EXORCISM_BOSS_IDS,
  EXORCISM_STAGE_COUNT,
  type ExorcismBossId,
  type ExorcismGrade,
  type ExorcismLineageId,
  type ExorcismRunState,
  type ExorcismSupplyChoice,
} from '@daoyou/game-domain/dungeon/exorcism';

/** 本祟脉的首领权重更高但不独占，一处节点也能遇到各种首领；最近遇到过的降权。 */
export function pickExorcismBoss(
  seed: number,
  lineageId: ExorcismLineageId,
  recentBossIds: readonly ExorcismBossId[] = [],
): ExorcismBossId {
  const weights = EXORCISM_BOSS_IDS.map((id) => {
    const home = EXORCISM_BOSSES[id].lineageId === lineageId;
    const base = home ? 4 : 1;
    return base * (recentBossIds.includes(id) ? 0.25 : 1);
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = new SeededRng(seed >>> 0).next() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll < 0) return EXORCISM_BOSS_IDS[i];
  }
  return EXORCISM_BOSS_IDS[EXORCISM_BOSS_IDS.length - 1];
}

export function createExorcismRun(input: {
  seed: number;
  lineageId: ExorcismLineageId;
  recentBossIds?: readonly ExorcismBossId[];
  isCountered: (bossId: ExorcismBossId) => boolean;
}): ExorcismRunState {
  const bossId = pickExorcismBoss(
    input.seed,
    input.lineageId,
    input.recentBossIds,
  );
  return {
    bossId,
    lineageId: input.lineageId,
    countered: input.isCountered(bossId),
    phase: 'battle',
    wins: 0,
    supplies: [],
  };
}

/** 下一场（或正在打的一场）的场次，1–4。 */
export function exorcismCurrentStage(run: Pick<ExorcismRunState, 'wins'>) {
  return Math.min(EXORCISM_STAGE_COUNT, run.wins + 1);
}

export function exorcismGrade(
  wins: number,
  finalHpRatio: number,
  pack = EXORCISM_ENCOUNTER_PACK,
): ExorcismGrade | null {
  if (wins >= EXORCISM_STAGE_COUNT)
    return finalHpRatio >= pack.grading.sHpRatio ? 'S' : 'A';
  if (wins === 3) return 'B';
  if (wins === 2) return 'C';
  if (wins === 1) return 'D';
  return null;
}

function finish(
  run: ExorcismRunState,
  endReason: NonNullable<ExorcismRunState['endReason']>,
  finalHpRatio: number,
): ExorcismRunState {
  return {
    ...run,
    phase: 'finished',
    endReason,
    finalHpRatio,
    grade: exorcismGrade(run.wins, finalHpRatio),
  };
}

export function applyExorcismBattle(
  run: ExorcismRunState,
  result: { victory: boolean; hpRatio: number },
): ExorcismRunState {
  if (run.phase !== 'battle') throw new Error('当前不在除祟战斗阶段');
  if (!result.victory) return finish(run, 'defeated', result.hpRatio);
  const next = { ...run, wins: run.wins + 1 };
  if (next.wins >= EXORCISM_STAGE_COUNT) return finish(next, 'cleared', result.hpRatio);
  return { ...next, phase: 'supply' };
}

export function applyExorcismSupply(
  run: ExorcismRunState,
  choice: ExorcismSupplyChoice,
): ExorcismRunState {
  if (run.phase !== 'supply') throw new Error('当前不在除祟补给阶段');
  return { ...run, phase: 'battle', supplies: [...run.supplies, choice] };
}

export function retreatExorcism(run: ExorcismRunState, hpRatio: number): ExorcismRunState {
  if (run.phase === 'finished') throw new Error('本局已经结束');
  return finish(run, 'retreated', hpRatio);
}

/** 结算页一段手写的结局，不调用模型。 */
export function exorcismEnding(run: ExorcismRunState) {
  const boss = EXORCISM_BOSSES[run.bossId].name;
  if (run.endReason === 'cleared')
    return run.grade === 'S'
      ? `${boss}伏诛，祟气散尽。你收势而立，气息未乱。`
      : `${boss}伏诛，祟气散尽。你撑到了最后一刻，身上已添了不少伤。`;
  if (run.endReason === 'retreated' && run.wins === 0)
    return `你还没分出胜负就退了出来，此行没有收获。${boss}仍盘踞在深处。`;
  if (run.endReason === 'retreated')
    return `你判断此行已到极限，就此收手，带着收获退了出来。${boss}仍盘踞在深处。`;
  return run.wins === 0
    ? '祟物比想象中凶险，你只得败退而回，此行一无所获。'
    : `你倒在了路上，勉力脱身。${boss}仍盘踞在深处，但前路的祟物已被你除去。`;
}
