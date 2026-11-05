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
  type ExorcismResources,
  type ExorcismRunState,
  type ExorcismSupplyChoice,
  type ExorcismUnitResources,
} from '@daoyou/game-domain/dungeon/exorcism';

/** 本祟脉的首领合计约占一半；最近遇到过的首领降权，避免连续碰到。 */
export function pickExorcismBoss(
  seed: number,
  lineageId: ExorcismLineageId,
  recentBossIds: readonly ExorcismBossId[] = [],
): ExorcismBossId {
  const others = EXORCISM_BOSS_IDS.filter(
    (id) => EXORCISM_BOSSES[id].lineageId !== lineageId,
  );
  const weights = EXORCISM_BOSS_IDS.map((id) => {
    const home = EXORCISM_BOSSES[id].lineageId === lineageId;
    const base = home ? Math.max(1, others.length) : 1;
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

function hpRatio(unit: ExorcismUnitResources | undefined) {
  return unit && unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
}

/**
 * 一场战斗的权威结果入账。胜方带走当前气血法力进下一场；
 * 人物倒地但灵兽收尾时留 1 点气血（已阵亡的灵兽记 0，后续不再出战）。
 */
export function applyExorcismBattle(
  run: ExorcismRunState,
  result: { victory: boolean; resources: ExorcismResources },
): ExorcismRunState {
  if (run.phase !== 'battle') throw new Error('当前不在除祟战斗阶段');
  const ratio = hpRatio(result.resources.player);
  // 已阵亡的灵兽不会再进入下一场的阵容，这里保留记录，防止它被当成新灵兽复活。
  const beasts = { ...run.resources?.beasts, ...result.resources.beasts };
  if (!result.victory)
    return finish(
      { ...run, resources: { player: result.resources.player, beasts } },
      'defeated',
      ratio,
    );
  const wins = run.wins + 1;
  const player = {
    ...result.resources.player,
    hp: Math.max(1, Math.floor(result.resources.player.hp)),
  };
  const next: ExorcismRunState = {
    ...run,
    wins,
    resources: { player, beasts },
  };
  if (wins >= EXORCISM_STAGE_COUNT) return finish(next, 'cleared', ratio);
  return { ...next, phase: 'supply' };
}

function rested(
  unit: ExorcismUnitResources,
  hpRatioGain: number,
  mpRatioGain: number,
): ExorcismUnitResources {
  if (unit.hp <= 0) return unit;
  return {
    ...unit,
    hp: Math.min(unit.maxHp, Math.floor(unit.hp + unit.maxHp * hpRatioGain)),
    mp: Math.min(unit.maxMp, Math.floor(unit.mp + unit.maxMp * mpRatioGain)),
  };
}

/** 调息是局内唯一的额外恢复；搜寻不改状态，奖励由调用方按种子发放。 */
export function applyExorcismSupply(
  run: ExorcismRunState,
  choice: ExorcismSupplyChoice,
  pack = EXORCISM_ENCOUNTER_PACK,
): ExorcismRunState {
  if (run.phase !== 'supply' || !run.resources)
    throw new Error('当前不在除祟补给阶段');
  const { restHpRatio, restMpRatio } = pack.supply;
  return {
    ...run,
    phase: 'battle',
    supplies: [...run.supplies, choice],
    resources:
      choice === 'rest'
        ? {
            player: rested(run.resources.player, restHpRatio, restMpRatio),
            beasts: Object.fromEntries(
              Object.entries(run.resources.beasts).map(([id, unit]) => [
                id,
                rested(unit, restHpRatio, restMpRatio),
              ]),
            ),
          }
        : run.resources,
  };
}

/** 主动收手：按当前进度结算。战斗进行中不能收手，由调用方按进行中的战局拦截。 */
export function retreatExorcism(run: ExorcismRunState): ExorcismRunState {
  if (run.phase === 'finished') throw new Error('本局已经结束');
  return finish(run, 'retreated', hpRatio(run.resources?.player));
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
