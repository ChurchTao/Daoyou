import type { TickContext } from '@/engine/status/types';
import type { Quality } from '@/types/constants';
import type { Cultivator, Skill } from '@/types/cultivator';
import { BattleUnit } from './BattleUnit';
import { skillExecutor } from './SkillExecutor';
import { damageCalculator } from './calculators/DamageCalculator';
import type {
  BattleEngineResult,
  InitialUnitState,
  TurnSnapshot,
  TurnUnitSnapshot,
} from './types';

/**
 * 战斗状态
 */
interface BattleState {
  player: BattleUnit;
  opponent: BattleUnit;
  turn: number;
  log: string[];
  timeline: TurnSnapshot[];
  maxTurns: number;
}

/**
 * 新版战斗引擎（V2）
 * 集成状态容器，使用模块化设计
 */
export class BattleEngineV2 {
  /**
   * 执行战斗模拟
   */
  simulateBattle(
    player: Cultivator,
    opponent: Cultivator,
    initialPlayerState?: InitialUnitState,
  ): BattleEngineResult {
    // 1. 初始化战斗状态
    const state = this.initializeBattle(player, opponent, initialPlayerState);

    // 2. 记录初始快照
    state.timeline.push(this.snapshotTurn(state));

    // 3. 主循环
    while (this.shouldContinueBattle(state)) {
      this.executeTurn(state);
    }

    // 4. 生成战斗结果
    return this.generateResult(state);
  }

  /**
   * 初始化战斗
   */
  private initializeBattle(
    player: Cultivator,
    opponent: Cultivator,
    initialPlayerState?: InitialUnitState,
  ): BattleState {
    // 合并持久状态和环境状态
    const playerStatuses = [
      ...(initialPlayerState?.persistentStatuses ?? []),
      ...(initialPlayerState?.environmentalStatuses ?? []),
    ];

    return {
      player: new BattleUnit(
        'player',
        player,
        initialPlayerState?.hpLossPercent,
        initialPlayerState?.mpLossPercent,
        playerStatuses.length > 0 ? playerStatuses : undefined,
      ),
      opponent: new BattleUnit('opponent', opponent),
      turn: 0,
      log: [],
      timeline: [],
      maxTurns: 30,
    };
  }

  /**
   * 执行单个回合
   */
  private executeTurn(state: BattleState): void {
    let snapshottedThisTurn = false;

    state.turn += 1;
    state.log.push(`[第${state.turn}回合]`);

    // 1. 刷新状态（DOT伤害、状态过期等）
    this.tickStatuses(state);

    // 检查状态刷新后是否有单位死亡
    if (!state.player.isAlive() || !state.opponent.isAlive()) {
      state.timeline.push(this.snapshotTurn(state));
      return;
    }

    // 2. 决定行动顺序
    const actors = this.determineActionOrder(state);

    // 3. 执行行动
    for (const actor of actors) {
      if (!actor.isAlive()) continue;

      // 重置防御状态
      actor.isDefending = false;

      // 检查行动限制
      if (this.isActionBlocked(actor)) {
        state.log.push(`${actor.getName()} 无法行动！`);
        continue;
      }

      const target = actor.unitId === 'player' ? state.opponent : state.player;

      // 选择技能
      const skill = this.chooseSkill(actor, target);

      if (!skill) {
        this.handleNoSkillAvailable(actor, state);
        continue;
      }

      // 执行技能
      const result = skillExecutor.execute(actor, target, skill, state.turn);
      state.log.push(...result.logs);

      // 检查目标是否死亡
      if (!target.isAlive()) {
        if (!snapshottedThisTurn) {
          state.timeline.push(this.snapshotTurn(state));
          snapshottedThisTurn = true;
        }
        break;
      }
    }

    // 4. 递减冷却
    state.player.tickCooldowns();
    state.opponent.tickCooldowns();

    // 5. 记录回合快照
    if (!snapshottedThisTurn) {
      state.timeline.push(this.snapshotTurn(state));
    }
  }

  /**
   * 刷新状态
   */
  private tickStatuses(state: BattleState): void {
    for (const unit of [state.player, state.opponent]) {
      const tickContext: TickContext = {
        currentTurn: state.turn,
        currentTime: Date.now(),
        unitSnapshot: unit.createUnitSnapshot(),
        unitName: unit.getName(),
        battleContext: {
          turnNumber: state.turn,
          isPlayerTurn: unit.unitId === 'player',
        },
      };

      const tickResult = unit.statusContainer.tickStatuses(tickContext);

      // 应用DOT伤害
      if (tickResult.damageDealt > 0) {
        unit.applyDamage(tickResult.damageDealt);
      }

      // 应用治疗（如果有）
      if (tickResult.healingDone > 0) {
        unit.applyHealing(tickResult.healingDone);
      }

      // 添加日志
      state.log.push(...tickResult.effectLogs);

      // 标记属性脏（状态可能已过期）
      unit.markAttributesDirty();
    }
  }

  /**
   * 决定行动顺序
   */
  private determineActionOrder(state: BattleState): BattleUnit[] {
    const playerSpeed =
      state.player.getFinalAttributes().speed +
      (state.player.hasStatus('speed_up') ? 20 : 0);
    const opponentSpeed =
      state.opponent.getFinalAttributes().speed +
      (state.opponent.hasStatus('speed_up') ? 20 : 0);

    return playerSpeed >= opponentSpeed
      ? [state.player, state.opponent]
      : [state.opponent, state.player];
  }

  /**
   * 检查行动限制
   */
  private isActionBlocked(unit: BattleUnit): boolean {
    return unit.hasStatus('stun') || unit.hasStatus('root');
  }

  /**
   * 选择技能
   */
  private chooseSkill(actor: BattleUnit, target: BattleUnit): Skill | null {
    // 获取可用技能
    const available = actor.cultivatorData.skills.filter((s) =>
      actor.canUseSkill(s),
    );

    // 添加法宝技能
    const weaponId = actor.cultivatorData.equipped.weapon;
    if (weaponId) {
      const artifact = actor.cultivatorData.inventory.artifacts.find(
        (a) => a.id === weaponId,
      );
      if (artifact) {
        const artifactSkill = this.createArtifactSkill(artifact, actor);
        if (actor.canUseSkill(artifactSkill)) {
          available.push(artifactSkill);
        }
      }
    }

    if (!available.length) {
      return null;
    }

    // AI决策逻辑
    const offensive = available.filter(
      (s) => s.type === 'attack' || s.type === 'control' || s.type === 'debuff',
    );
    const heals = available.filter((s) => s.type === 'heal');
    const buffs = available.filter((s) => s.type === 'buff');

    const hpRatio = actor.currentHp / actor.maxHp;

    // 低血量时优先治疗
    if (hpRatio < 0.3 && heals.length) {
      return heals[Math.floor(Math.random() * heals.length)];
    }

    // 战斗开始前2回合，有一定概率释放buff
    if (
      actor.statusContainer.getActiveStatuses().length === 0 &&
      buffs.length
    ) {
      // 30%概率释放buff
      if (Math.random() < 0.3) {
        return buffs[Math.floor(Math.random() * buffs.length)];
      }
    }

    // 优势时优先进攻
    if (target.currentHp < actor.currentHp && offensive.length) {
      return offensive[Math.floor(Math.random() * offensive.length)];
    }

    // 默认进攻
    if (offensive.length) {
      return offensive[Math.floor(Math.random() * offensive.length)];
    }

    // 增益
    if (buffs.length) {
      return buffs[Math.floor(Math.random() * buffs.length)];
    }

    return available[0];
  }

  /**
   * 创建法宝技能
   */
  private createArtifactSkill(artifact: unknown, actor: BattleUnit): Skill {
    const art = artifact as {
      id?: string;
      name: string;
      quality?: Quality;
      element: string;
      special_effects?: Array<{
        type: string;
        effect?: string;
        [key: string]: unknown;
      }>;
    };

    const attrs = actor.getFinalAttributes();
    const { power, cost } = damageCalculator.getArtifactPowerAndCost(
      art.quality,
      attrs.willpower,
    );

    const skill: Skill = {
      id: art.id,
      name: `${art.name}（法宝）`,
      type: 'attack',
      element: art.element as never,
      power: power,
      cost: cost,
      cooldown: 3,
    };

    // 检查特殊效果
    const effect = art.special_effects?.find?.(
      (eff) => eff.type === 'on_hit_add_effect',
    );

    if (effect && effect.effect) {
      skill.duration = 2;
      skill.effect = effect.effect as never;
      skill.target_self = ['armor_up', 'speed_up', 'crit_rate_up'].includes(
        effect.effect,
      );
    }

    return skill;
  }

  /**
   * 处理无技能可用的情况
   */
  private handleNoSkillAvailable(actor: BattleUnit, state: BattleState): void {
    const isSilenced = actor.hasStatus('silence');

    if (isSilenced) {
      // 沉默时防御
      actor.isDefending = true;
      state.log.push(`${actor.getName()} 因被沉默无法施展术法，摆出防御姿态。`);
    } else {
      // MP耗尽时恢复
      const recoveredMp = Math.floor(actor.maxMp * 0.3);
      actor.restoreMp(recoveredMp);
      state.log.push(
        `${actor.getName()} 因灵力耗尽，使用灵石恢复了 ${recoveredMp} 点灵力。`,
      );
    }
  }

  /**
   * 检查是否应该继续战斗
   */
  private shouldContinueBattle(state: BattleState): boolean {
    return (
      state.player.isAlive() &&
      state.opponent.isAlive() &&
      state.turn < state.maxTurns
    );
  }

  /**
   * 创建回合快照
   */
  private snapshotTurn(state: BattleState): TurnSnapshot {
    const buildUnitSnapshot = (unit: BattleUnit): TurnUnitSnapshot => ({
      hp: unit.currentHp,
      maxHp: unit.maxHp,
      mp: unit.currentMp,
      maxMp: unit.maxMp,
      statuses: unit.getActiveStatusEffects(),
    });

    return {
      turn: state.turn,
      player: buildUnitSnapshot(state.player),
      opponent: buildUnitSnapshot(state.opponent),
    };
  }

  /**
   * 生成战斗结果
   */
  private generateResult(state: BattleState): BattleEngineResult {
    const winnerUnit =
      state.player.isAlive() && !state.opponent.isAlive()
        ? state.player
        : !state.player.isAlive() && state.opponent.isAlive()
          ? state.opponent
          : state.player.currentHp >= state.opponent.currentHp
            ? state.player
            : state.opponent;

    const loserUnit =
      winnerUnit.unitId === 'player' ? state.opponent : state.player;

    state.log.push(
      `✨ ${winnerUnit.getName()} 获胜！剩余气血：${winnerUnit.currentHp}，对手剩余气血：${loserUnit.currentHp}。`,
    );

    // 生成失败方的伤势状态
    this.applyBattleInjuries(loserUnit, state.log);

    // 清除临时状态
    state.player.statusContainer.clearTemporaryStatuses();
    state.opponent.statusContainer.clearTemporaryStatuses();

    // 导出持久状态
    const playerPersistentStatuses =
      state.player.statusContainer.exportPersistentStatuses();
    const opponentPersistentStatuses =
      state.opponent.statusContainer.exportPersistentStatuses();

    return {
      winner: winnerUnit.cultivatorData,
      loser: loserUnit.cultivatorData,
      log: state.log,
      turns: state.turn,
      playerHp: state.player.currentHp,
      opponentHp: state.opponent.currentHp,
      timeline: state.timeline,
      playerPersistentStatuses,
      opponentPersistentStatuses,
      player: state.player.cultivatorData.id!,
      opponent: state.opponent.cultivatorData.id!,
    };
  }

  /**
   * 对失败方应用伤势状态
   * 仅失败方会受伤
   */
  private applyBattleInjuries(loser: BattleUnit, log: string[]): void {
    const hpPercent = loser.currentHp / loser.maxHp;

    // HP低于30%: 添加或升级伤势状态
    if (hpPercent < 0.3) {
      const hasMinorWound = loser.statusContainer.hasStatus('minor_wound');
      const hasMajorWound = loser.statusContainer.hasStatus('major_wound');
      const hasNearDeath = loser.statusContainer.hasStatus('near_death');

      if (hasNearDeath) {
        // 已经是濒死，不再叠加
        log.push(`${loser.getName()} 的伤势已达濒死状态。`);
      } else if (hasMajorWound && hpPercent < 0.1) {
        // 重伤状态且HP<10% → 升级为濒死
        loser.statusContainer.removeStatusByKey('major_wound');
        loser.statusContainer.addStatus(
          {
            statusKey: 'near_death',
            source: {
              sourceType: 'system',
              sourceName: '战斗伤势',
            },
          },
          loser.createUnitSnapshot(),
        );
        log.push(`${loser.getName()} 的伤势从重伤升级为濒死！`);
      } else if (hasMinorWound && hpPercent < 0.3) {
        // 轻伤状态且HP<30% → 升级为重伤
        loser.statusContainer.removeStatusByKey('minor_wound');
        loser.statusContainer.addStatus(
          {
            statusKey: 'major_wound',
            source: {
              sourceType: 'system',
              sourceName: '战斗伤势',
            },
          },
          loser.createUnitSnapshot(),
        );
        log.push(`${loser.getName()} 的伤势从轻伤升级为重伤！`);
      } else if (!hasMinorWound && !hasMajorWound) {
        // 没有任何伤势，添加轻伤或重伤
        const statusKey = hpPercent < 0.1 ? 'major_wound' : 'minor_wound';
        loser.statusContainer.addStatus(
          {
            statusKey,
            source: {
              sourceType: 'system',
              sourceName: '战斗伤势',
            },
          },
          loser.createUnitSnapshot(),
        );
        log.push(
          `${loser.getName()} 受了${statusKey === 'minor_wound' ? '轻伤' : '重伤'}！`,
        );
      }
    }
  }
}

/**
 * 导出函数式接口（兼容旧代码）
 */
export function simulateBattle(
  player: Cultivator,
  opponent: Cultivator,
  initialPlayerState?: InitialUnitState,
): BattleEngineResult {
  const engine = new BattleEngineV2();
  return engine.simulateBattle(player, opponent, initialPlayerState);
}
