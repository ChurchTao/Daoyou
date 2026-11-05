import {
  EXORCISM_BOSSES,
  EXORCISM_ENCOUNTER_PACK,
  EXORCISM_LINEAGES,
} from '@daoyou/game-content/dungeon/exorcism';
import type {
  ExorcismGrade,
  ExorcismRunState,
} from '@daoyou/game-domain/dungeon/exorcism';

export const EXORCISM_STAGES = ['探路', '遇伏', '护法', '祟主'] as const;

/** 按已胜场次算当前能拿到的评级，和服务端规则一致；一场未胜没有评级。 */
export function exorcismProgressGrade(wins: number): ExorcismGrade | null {
  return wins >= 3 ? 'B' : wins === 2 ? 'C' : wins === 1 ? 'D' : null;
}

/** 下一场（或正在打的一场）的敌人，用于迎战页立绘和补给页预告。 */
export function exorcismStageFoes(
  run: Pick<ExorcismRunState, 'bossId' | 'lineageId'>,
  stage: number,
) {
  const lineage = EXORCISM_LINEAGES[run.lineageId];
  const boss = EXORCISM_BOSSES[run.bossId];
  const encounter =
    stage === 1
      ? lineage.scout
      : stage === 2
        ? lineage.ambush
        : stage === 3
          ? boss.guardian
          : boss.boss;
  return encounter.enemies;
}

export function exorcismBattleTitle(run: ExorcismRunState) {
  // 这一场已分出胜负、还没点结束时，wins 已经加过一次。
  const stage = Math.max(
    1,
    Math.min(4, run.phase === 'battle' ? run.wins + 1 : run.wins),
  );
  const title = `第 ${stage} 战 · ${EXORCISM_STAGES[stage - 1]}`;
  return stage === 4
    ? { title, bossGrading: EXORCISM_ENCOUNTER_PACK.grading.sHpRatio }
    : { title };
}

export function ratioPercent(current: number, max: number) {
  return max > 0 ? Math.floor((current * 100) / max) : 0;
}
