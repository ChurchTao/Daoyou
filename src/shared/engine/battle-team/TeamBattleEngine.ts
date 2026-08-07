import { AttributeType, DamageSource } from '@shared/engine/battle-v5/core/types';
import {
  withBattleRandomSource,
  SeededBattleRandomSource,
  battleRandom,
} from '@shared/engine/battle-v5/core/BattleRandom';
import type { TeamUnit } from './TeamUnit';
import { Team } from './Team';
import { Formation } from './Formation';
import { TargetSelection } from './TargetSelection';
import { DamageResolver } from './DamageResolver';
import { TeamVictorySystem } from './TeamVictorySystem';
import { TeamBattleRecorder } from './TeamBattleRecorder';
import { TeamBattleEventBus } from './TeamBattleEventBus';
import { BasicStrike } from './abilities/BasicStrike';
import type { TeamAbility, TeamAbilityContext, TeamBattleEngineApi } from './TeamAbility';
import type {
  TeamSide,
  TeamTargetPolicy,
  DamagePayload,
  DamageResult,
  TeamUnitRef,
  TeamBattleInternalEvent,
  TeamBattleLogEventInput,
  TeamBattleRecord,
  TeamBattleParticipants,
  PendingCast,
} from './types';

export interface TeamBattleEngineOptions {
  seed?: string | number;
  maxTurns?: number;
}

const DEFAULT_MAX_TURNS = 30;

/**
 * 多人战斗主引擎。
 *
 * 与 battle-v5 的区别：
 * - 支持多单位（2v2 或更多）
 * - 队伍制胜负判定
 * - 阵型站位 + 目标选择策略
 * - 无 mp 消耗
 * - 实例级事件总线（非单例）
 */
export class TeamBattleEngine implements TeamBattleEngineApi {
  private _teamA: Team;
  private _teamB: Team;
  private _formation: Formation;
  private _bus: TeamBattleEventBus;
  private _recorder: TeamBattleRecorder;
  private _targetSelection: TargetSelection;
  private _damageResolver: DamageResolver;
  private _rng: () => number;
  private _round = 0;
  private _ended = false;
  private _winner: TeamSide | null = null;
  private _reachedMaxTurns = false;
  private _maxTurns: number;
  private _basicStrike = new BasicStrike();
  private _abilityCleanups: Array<() => void> = [];
  private _currentRound = 0;
  /** 各队当前回合的嘲讽单位（回合结束时清空） */
  private _taunters: Map<TeamSide, TeamUnit> = new Map();

  constructor(units: TeamUnit[], opts?: TeamBattleEngineOptions) {
    const teamAUnits = units.filter((u) => u.side === 'A');
    const teamBUnits = units.filter((u) => u.side === 'B');

    this._teamA = new Team('A', teamAUnits);
    this._teamB = new Team('B', teamBUnits);
    this._formation = new Formation(units);
    this._bus = new TeamBattleEventBus();
    this._maxTurns = opts?.maxTurns ?? DEFAULT_MAX_TURNS;

    const seededSource = opts?.seed !== undefined
      ? new SeededBattleRandomSource(opts.seed)
      : undefined;

    this._rng = () => {
      // 使用 withBattleRandomSource 确保兼容 v5 的随机数栈
      let val = 0;
      withBattleRandomSource(seededSource, () => {
        val = battleRandom();
      });
      return val;
    };

    this._recorder = new TeamBattleRecorder(() => this.snapshotAll());

    this._targetSelection = new TargetSelection(this._formation, this._teamA, this._teamB, this._rng);

    this._damageResolver = new DamageResolver(this._bus, this._rng, (e) => {
      this._recorder.log({ ...e, round: this._currentRound } as TeamBattleLogEventInput);
    });

    // 初始化所有技能
    this.initAbilities(units);
  }

  private initAbilities(units: TeamUnit[]): void {
    for (const unit of units) {
      for (const ability of unit.abilities) {
        const ctx: TeamAbilityContext = {
          source: unit,
          engine: this,
          rng: this._rng,
          currentRound: 0,
          subscribe: (type, handler) => this._bus.subscribe(type, handler),
        };
        const cleanup = ability.onBattleStart(ctx);
        if (cleanup) this._abilityCleanups.push(cleanup);
      }
    }
  }

  run(): TeamBattleRecord {
    const allUnits = [...this._teamA.allUnits(), ...this._teamB.allUnits()];

    // BattleStarted
    this._bus.emit({ type: 'BattleStarted', units: allUnits } as TeamBattleInternalEvent);
    this._recorder.initialFrame(allUnits);
    const aCount = this._teamA.allUnits().length;
    const bCount = this._teamB.allUnits().length;
    this._recorder.log({
      round: 0,
      kind: 'battle_start',
      text: `${aCount}v${bCount} 演武开始`,
    });

    while (!this._ended) {
      this._round++;
      this._currentRound = this._round;

      if (this._round > this._maxTurns) {
        this._ended = true;
        const v = TeamVictorySystem.check(this._teamA, this._teamB, this._round, this._maxTurns);
        this._winner = v.winningTeam;
        this._reachedMaxTurns = v.reachedMaxTurns;
        break;
      }

      // ROUND_START
      this._bus.emit({ type: 'RoundStarted', round: this._round } as TeamBattleInternalEvent);
      this._recorder.log({
        round: this._round,
        kind: 'round_start',
        text: `—— 第 ${this._round} 回合 ——`,
      });

      for (const unit of allUnits) {
        if (unit.isAlive()) unit.resetRoundUses();
      }

      // TURN_ORDER：按速度排序
      const order = this.sortAliveBySpeed(allUnits);

      // ACTION
      for (const actor of order) {
        if (!actor.isAlive()) continue;
        if (this._ended) break;

        this._bus.emit({ type: 'UnitActing', actor, round: this._round } as TeamBattleInternalEvent);

        // 蓄力释放优先：若蓄力到期，释放并跳过本回合正常行动
        if (actor.pendingCast && actor.pendingCast.releaseRound <= this._round) {
          this.releasePendingCast(actor);
          this._recorder.captureFrame(this._round);

          const vPost = TeamVictorySystem.check(this._teamA, this._teamB, this._round, this._maxTurns);
          if (vPost.battleEnded) {
            this._ended = true;
            this._winner = vPost.winningTeam;
            this._reachedMaxTurns = vPost.reachedMaxTurns;
            break;
          }
          continue;
        }

        // 选主动技能
        const action = this.pickActionAbility(actor);
        if (action) actor.consumeUse(action);

        let targets = this.selectTargets(actor, action.targetPolicy);

        // 普攻尊重敌方嘲讽：若敌方有嘲讽单位，强制以此为目标
        if (action === this._basicStrike) {
          const tauntTarget = this.getEnemyTaunt(actor.side);
          if (tauntTarget && tauntTarget.isAlive()) {
            targets = [tauntTarget as TeamUnit];
          }
        }

        const ctx: TeamAbilityContext = {
          source: actor,
          engine: this,
          rng: this._rng,
          currentRound: this._currentRound,
          subscribe: (type, handler) => this._bus.subscribe(type, handler),
        };

        this._recorder.log({
          round: this._round,
          actorId: actor.id,
          abilityId: action.id,
          abilityName: action.name,
          kind: 'action',
          text: `${actor.name} 使用【${action.name}】`,
        });

        action.execute(ctx, targets as TeamUnit[]);
        this._recorder.captureFrame(this._round);

        // 行动后判胜负
        const v = TeamVictorySystem.check(this._teamA, this._teamB, this._round, this._maxTurns);
        if (v.battleEnded) {
          this._ended = true;
          this._winner = v.winningTeam;
          this._reachedMaxTurns = v.reachedMaxTurns;
          break;
        }
      }

      if (this._ended) break;

      // ROUND_POST
      for (const unit of allUnits) {
        if (unit.isAlive()) unit.tickCooldowns();
      }
      // 回合结束时清空嘲讽（嘲讽仅当回合有效）
      this.clearRoundTaunts();
      this._bus.emit({ type: 'RoundEnded', round: this._round } as TeamBattleInternalEvent);
      this._recorder.captureFrame(this._round);

      // VICTORY_CHECK
      const v = TeamVictorySystem.check(this._teamA, this._teamB, this._round, this._maxTurns);
      if (v.battleEnded) {
        this._ended = true;
        this._winner = v.winningTeam;
        this._reachedMaxTurns = v.reachedMaxTurns;
      }
    }

    this._recorder.log({
      round: this._round,
      kind: 'battle_end',
      text: this._winner ? `${this._winner} 队获胜！` : '双方平局',
      winningTeam: this._winner,
    });
    this._recorder.captureFrame(this._round);

    const participants: TeamBattleParticipants = {
      teamA: this._teamA.allUnits().map((u) => ({ id: u.id, name: u.name, position: u.position })),
      teamB: this._teamB.allUnits().map((u) => ({ id: u.id, name: u.name, position: u.position })),
    };

    return this._recorder.build(participants, {
      winningTeam: this._winner,
      turns: this._round,
      reachedMaxTurns: this._reachedMaxTurns,
    });
  }

  // ===== TeamBattleEngineApi 实现 =====

  dealDamage(
    source: TeamUnitRef,
    target: TeamUnitRef,
    ability: TeamAbility | null,
    payload: DamagePayload,
    opts?: { isCounter?: boolean; isFollowUp?: boolean },
  ): DamageResult {
    const finalPayload: DamagePayload = {
      ...payload,
      isCounter: opts?.isCounter ?? false,
      isFollowUp: opts?.isFollowUp ?? false,
    };
    return this._damageResolver.resolve(source as TeamUnit, target as TeamUnit, ability, finalPayload);
  }

  heal(source: TeamUnitRef, target: TeamUnitRef, amount: number): number {
    const healed = (target as TeamUnit).heal(amount);
    this._recorder.log({
      round: this._currentRound,
      actorId: source.id,
      targetId: target.id,
      amount: healed,
      kind: 'heal',
      text: `${source.name} 为 ${target.name} 恢复 ${healed} 气血`,
    });
    return healed;
  }

  recordLog(e: TeamBattleLogEventInput): void {
    this._recorder.log({ ...e, round: e.round || this._currentRound } as TeamBattleLogEventInput);
  }

  selectTargets(source: TeamUnitRef, policy: TeamTargetPolicy): TeamUnitRef[] {
    return this._targetSelection.selectTargets(source, policy);
  }

  setPendingCast(source: TeamUnitRef, cast: PendingCast): void {
    const unit = this.findUnit(source.id);
    if (unit) unit.pendingCast = cast;
  }

  clearPendingCast(unitId: string): void {
    const unit = this.findUnit(unitId);
    if (unit) unit.pendingCast = null;
  }

  setTaunt(source: TeamUnitRef): void {
    const unit = source as TeamUnit;
    // 同队先前嘲讽者让位
    const prev = this._taunters.get(unit.side);
    if (prev && prev !== unit) prev.isTaunting = false;
    unit.isTaunting = true;
    this._taunters.set(unit.side, unit);
  }

  getEnemyTaunt(side: TeamSide): TeamUnitRef | null {
    const enemySide: TeamSide = side === 'A' ? 'B' : 'A';
    const taunter = this._taunters.get(enemySide);
    if (taunter && taunter.isAlive()) return taunter;
    return null;
  }

  // ===== 内部方法 =====

  private findUnit(id: string): TeamUnit | undefined {
    return this._teamA.getUnit(id) ?? this._teamB.getUnit(id);
  }

  /** 释放蓄力技能：对 payload.targetPolicy 选定的目标造成固定伤害 */
  private releasePendingCast(unit: TeamUnit): void {
    const cast = unit.pendingCast;
    if (!cast) return;
    unit.pendingCast = null;

    this._recorder.log({
      round: this._currentRound,
      actorId: unit.id,
      abilityId: cast.abilityId,
      abilityName: cast.abilityName,
      phase: 'release',
      kind: 'charge',
      text: `${unit.name} 释放蓄力【${cast.abilityName}】！`,
    });

    const targets = this.selectTargets(unit, cast.payload.targetPolicy);
    for (const target of targets) {
      this.dealDamage(unit, target, null, {
        attribute: cast.payload.attribute,
        coefficient: 1,
        damageType: cast.payload.damageType,
        source: DamageSource.DELAYED,
        fixedAmount: cast.payload.damage,
      });
    }
  }

  /** 回合结束清空所有嘲讽状态 */
  private clearRoundTaunts(): void {
    for (const [, unit] of this._taunters) {
      unit.isTaunting = false;
    }
    this._taunters.clear();
  }

  private sortAliveBySpeed(units: TeamUnit[]): TeamUnit[] {
    const alive = units.filter((u) => u.isAlive());
    return alive.sort((a, b) => {
      const speedDiff = b.attributes.getValue(AttributeType.ACTION_SPEED) - a.attributes.getValue(AttributeType.ACTION_SPEED);
      if (speedDiff !== 0) return speedDiff;
      // 速度相同 → rng 扰动
      return this._rng() - 0.5 < 0 ? -1 : 1;
    });
  }

  private pickActionAbility(unit: TeamUnit): TeamAbility {
    // 找第一个可用的主动技能
    for (const ability of unit.abilities) {
      if (ability.isUsableAsAction() && unit.canUse(ability)) {
        return ability;
      }
    }
    return this._basicStrike;
  }

  private snapshotAll(): Record<string, import('./types').TeamUnitSnapshot> {
    const result: Record<string, import('./types').TeamUnitSnapshot> = {};
    for (const u of [...this._teamA.allUnits(), ...this._teamB.allUnits()]) {
      result[u.id] = u.snapshot();
    }
    return result;
  }

  destroy(): void {
    for (const cleanup of this._abilityCleanups) {
      try {
        cleanup();
      } catch {
        // 忽略清理错误
      }
    }
    this._abilityCleanups = [];
    this._bus.clear();
  }
}
