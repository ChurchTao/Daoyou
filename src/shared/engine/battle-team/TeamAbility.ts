import type { TeamAbilityKind, TeamTargetPolicy, DamagePayload, DamageResult, TeamUnitRef, TeamBattleLogEventInput, PendingCast, TeamSide } from './types';

/**
 * 引擎暴露给技能的 API 接口（避免循环依赖）。
 * TeamBattleEngine 实现此接口。
 */
export interface TeamBattleEngineApi {
  dealDamage(
    source: TeamUnitRef,
    target: TeamUnitRef,
    ability: TeamAbility | null,
    payload: DamagePayload,
    opts?: { isCounter?: boolean; isFollowUp?: boolean },
  ): DamageResult;
  heal(source: TeamUnitRef, target: TeamUnitRef, amount: number): number;
  recordLog(e: TeamBattleLogEventInput): void;
  selectTargets(source: TeamUnitRef, policy: TeamTargetPolicy): TeamUnitRef[];
  /** 设置蓄力状态（下回合释放） */
  setPendingCast(source: TeamUnitRef, cast: PendingCast): void;
  /** 清除蓄力状态 */
  clearPendingCast(unitId: string): void;
  /** 设置本回合嘲讽（敌方普攻只能以自己为目标） */
  setTaunt(source: TeamUnitRef): void;
  /** 查询敌方嘲讽单位（若有） */
  getEnemyTaunt(side: TeamSide): TeamUnitRef | null;
}

export interface TeamAbilityContext {
  source: import('./TeamUnit').TeamUnit;
  engine: TeamBattleEngineApi;
  rng: () => number;
  /** 当前回合数（execute 时为实时值；onBattleStart 订阅闭包内为 0，用 engine.recordLog 自动补回合） */
  currentRound: number;
  /** 订阅引擎内部事件（光环/响应类用），返回取消订阅函数 */
  subscribe(type: string, handler: (e: import('./types').TeamBattleInternalEvent) => void): () => void;
}

/**
 * 多人战斗技能基类。
 *
 * 与 battle-v5 的 Ability 区别：
 * - 无 mp 消耗
 * - 冷却/次数状态由 TeamUnit 持有（Ability 本身无状态，可安全跨战斗复用）
 * - 事件订阅通过 TeamBattleEventBus 实例级分发（非单例）
 */
export abstract class TeamAbility {
  readonly id: string;
  readonly name: string;
  readonly kind: TeamAbilityKind;
  readonly targetPolicy: TeamTargetPolicy;
  readonly cooldown: number;
  readonly maxUsesPerRound: number;
  readonly description: string;

  constructor(opts: {
    id: string;
    name: string;
    kind: TeamAbilityKind;
    targetPolicy: TeamTargetPolicy;
    cooldown?: number;
    maxUsesPerRound?: number;
    description?: string;
  }) {
    this.id = opts.id;
    this.name = opts.name;
    this.kind = opts.kind;
    this.targetPolicy = opts.targetPolicy;
    this.cooldown = opts.cooldown ?? 0;
    this.maxUsesPerRound = opts.maxUsesPerRound ?? 0;
    this.description = opts.description ?? '';
  }

  /**
   * 战斗开始时调用一次：注册事件订阅（光环/响应类用）。
   * 返回的 unsubscribe 函数会在 onDestroy 时调用。
   */
  onBattleStart(_ctx: TeamAbilityContext): (() => void) | void {
    void _ctx;
    return undefined;
  }

  /**
   * 引擎销毁时调用：清理资源。
   */
  onDestroy(_ctx: TeamAbilityContext): void {
    void _ctx;
  }

  /**
   * 主动施法流程。
   */
  abstract execute(ctx: TeamAbilityContext, targets: import('./TeamUnit').TeamUnit[]): void;

  /**
   * 是否可作为主动行动（光环/响应类默认 false）。
   */
  isUsableAsAction(): boolean {
    return true;
  }
}
