/**
 * 全服剧本库的选本与补货策略（纯函数）。剧本按“节点 × 模板”分槽，
 * 开局只从库中选本；库存不足时投递异步生成任务，全服待生成任务有上限。
 * 重温与首次游玩走同一结算路径，重温标记只用于提示和剧本统计。
 */
export const MYSTERY_LIBRARY_POLICY = {
  /** 全服 queued + running 任务上限，达到后忽略新的投递。 */
  maxPendingJobs: 5,
  /** 角色在该槽剩余未玩剧本不超过此数时补货。 */
  lowStockThreshold: 1,
  /** 每槽 active 剧本上限，达到后只轮换旧本。 */
  maxActivePerSlot: 30,
  /** 同一槽生成失败后的冷却时间。 */
  failureBackoffMs: 30 * 60_000,
  /** 单个任务的最大尝试次数。 */
  maxJobAttempts: 3,
  /** running 超过此时长视为中断。 */
  staleRunningMs: 10 * 60_000,
  /**
   * 入库把关：独立审校报告的严重矛盾超过此数则不入库、按失败重试。
   * 审校模型本身有误报，阈值不设为 0，避免几乎全部被拒、反复烧费用。
   */
  maxMajorIssuesForLibrary: 2,
  /** 上线预热时每槽至少保有的剧本数。 */
  warmupPerSlot: 2,
  /** 自动停用：游玩次数达到此值后才评估。 */
  retireMinPlays: 20,
  retireMinCompletionRate: 0.2,
  retireMinAverageScore: 30,
} as const;

export interface LibraryScenario {
  id: string;
  templateId: string;
  /** 全服游玩次数，用于让新本尽快被检验。 */
  playCount: number;
}

export interface LibraryPlay {
  scenarioId: string;
  templateId: string;
  lastPlayedAt: number;
  /** 是否结案（看过真相）。 */
  completed: boolean;
}

export type ScenarioPick =
  | {
      kind: 'scenario';
      templateId: string;
      scenarioId: string;
      /** 结案过的本再玩一次（仅提示与统计）。 */
      replay: boolean;
      /** 首次进入此本，用于累计全服游玩人数。 */
      firstPlay: boolean;
      /** 本次之后，该角色在此槽还剩几本没玩。 */
      unplayedLeft: number;
    }
  | { kind: 'empty'; templateId: string };

/**
 * 选本：优先选该角色还有未玩剧本的槽（多个时选他玩得最少的模板，轮换玩法），
 * 槽内选全服玩得最少的未玩本；都玩过时选他最久没玩的本；槽内为空则冷启动。
 */
export function pickMysteryScenario(args: {
  templateIds: readonly string[];
  scenarios: readonly LibraryScenario[];
  plays: readonly LibraryPlay[];
  random: () => number;
}): ScenarioPick {
  const { templateIds, scenarios, plays, random } = args;
  if (templateIds.length === 0) throw new Error('节点未配置剧本模板');
  const playByScenario = new Map(plays.map((p) => [p.scenarioId, p]));
  const playedTimes = (templateId: string) =>
    plays.filter((p) => p.templateId === templateId).length;
  const slots = templateIds.map((templateId) => {
    const pool = scenarios.filter((s) => s.templateId === templateId);
    return {
      templateId,
      pool,
      unplayed: pool.filter((s) => !playByScenario.has(s.id)),
      playedTimes: playedTimes(templateId),
    };
  });
  const leastPlayed = <T extends { playedTimes: number }>(list: T[]) => {
    const min = Math.min(...list.map((x) => x.playedTimes));
    const ties = list.filter((x) => x.playedTimes === min);
    return ties[Math.floor(random() * ties.length)]!;
  };

  const fresh = slots.filter((s) => s.unplayed.length > 0);
  if (fresh.length > 0) {
    const slot = leastPlayed(fresh);
    const minPlays = Math.min(...slot.unplayed.map((s) => s.playCount));
    const ties = slot.unplayed.filter((s) => s.playCount === minPlays);
    const chosen = ties[Math.floor(random() * ties.length)]!;
    return {
      kind: 'scenario',
      templateId: slot.templateId,
      scenarioId: chosen.id,
      replay: false,
      firstPlay: true,
      unplayedLeft: slot.unplayed.length - 1,
    };
  }

  const stocked = slots.filter((s) => s.pool.length > 0);
  if (stocked.length > 0) {
    const slot = leastPlayed(stocked);
    const oldest = [...slot.pool].sort(
      (a, b) =>
        playByScenario.get(a.id)!.lastPlayedAt -
          playByScenario.get(b.id)!.lastPlayedAt || a.id.localeCompare(b.id),
    )[0]!;
    return {
      kind: 'scenario',
      templateId: slot.templateId,
      scenarioId: oldest.id,
      replay: playByScenario.get(oldest.id)!.completed,
      firstPlay: false,
      unplayedLeft: 0,
    };
  }

  return { kind: 'empty', templateId: leastPlayed(slots).templateId };
}

/** 本次开局后是否需要为该槽补货。 */
export function needsMysteryRestock(pick: ScenarioPick): boolean {
  return (
    pick.kind === 'empty' ||
    pick.replay ||
    pick.unplayedLeft <= MYSTERY_LIBRARY_POLICY.lowStockThreshold
  );
}

export type RestockDecision =
  'enqueue' | 'slot_full' | 'backoff' | 'slot_pending' | 'queue_full';

/** 投递前的限流判断，依次检查库存上限、失败退避、同槽排队与全服队列上限。 */
export function decideMysteryRestock(args: {
  activeInSlot: number;
  pendingInSlot: number;
  pendingTotal: number;
  lastFailedAt: number | null;
  now: number;
}): RestockDecision {
  const policy = MYSTERY_LIBRARY_POLICY;
  if (args.activeInSlot >= policy.maxActivePerSlot) return 'slot_full';
  if (
    args.lastFailedAt !== null &&
    args.now - args.lastFailedAt < policy.failureBackoffMs
  )
    return 'backoff';
  if (args.pendingInSlot > 0) return 'slot_pending';
  if (args.pendingTotal >= policy.maxPendingJobs) return 'queue_full';
  return 'enqueue';
}

/** 游玩足够多次后，完成率或平均分过低的生成剧本自动停用。 */
export function shouldRetireMysteryScenario(stats: {
  playCount: number;
  completionCount: number;
  scoreSum: number;
}): boolean {
  const policy = MYSTERY_LIBRARY_POLICY;
  if (stats.playCount < policy.retireMinPlays) return false;
  if (stats.completionCount / stats.playCount < policy.retireMinCompletionRate)
    return true;
  return (
    stats.completionCount > 0 &&
    stats.scoreSum / stats.completionCount < policy.retireMinAverageScore
  );
}
