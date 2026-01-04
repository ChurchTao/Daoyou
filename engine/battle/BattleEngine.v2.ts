import { buffRegistry } from '@/engine/buff';
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
 * 战斗引擎 V2
 * 完全基于 EffectEngine 和 BuffManager
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
    return {
      player: new BattleUnit(
        'player',
        player,
        initialPlayerState?.hpLossPercent,
        initialPlayerState?.mpLossPercent,
        initialPlayerState?.persistentBuffs,
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

    // 1. 回合开始：DOT 伤害 + Buff 过期
    this.processTurnStart(state);

    // 检查是否有单位死亡
    if (!state.player.isAlive() || !state.opponent.isAlive()) {
      state.timeline.push(this.snapshotTurn(state));
      return;
    }

    // 2. 决定行动顺序
    const actors = this.determineActionOrder(state);

    // 3. 执行行动
    for (const actor of actors) {
      if (!actor.isAlive()) continue;

      actor.isDefending = false;

      if (this.isActionBlocked(actor)) {
        state.log.push(`${actor.getName()} 无法行动！`);
        continue;
      }

      const target = actor.unitId === 'player' ? state.opponent : state.player;
      const skill = this.chooseSkill(actor, target);

      if (!skill) {
        this.handleNoSkillAvailable(actor, state);
        continue;
      }

      const result = skillExecutor.execute(actor, target, skill, state.turn);
      state.log.push(...result.logs);

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
   * 回合开始处理：DOT 伤害 + Buff 过期
   */
  private processTurnStart(state: BattleState): void {
    for (const unit of [state.player, state.opponent]) {
      // 1. DOT 伤害（通过 EffectEngine）
      const { dotDamage, logs } = unit.processTurnStartEffects();
      if (dotDamage > 0) {
        unit.applyDamage(dotDamage);
        state.log.push(...logs);
      }

      // 2. Buff 时间流逝
      const expiredEvents = unit.buffManager.tick();
      for (const event of expiredEvents) {
        if (event.message) {
          state.log.push(event.message);
        }
      }

      // 3. 属性脏标记
      unit.markAttributesDirty();
    }
  }

  /**
   * 决定行动顺序
   */
  private determineActionOrder(state: BattleState): BattleUnit[] {
    const playerSpeed = state.player.getFinalAttributes().speed;
    const opponentSpeed = state.opponent.getFinalAttributes().speed;

    return playerSpeed >= opponentSpeed
      ? [state.player, state.opponent]
      : [state.opponent, state.player];
  }

  /**
   * 检查行动限制
   */
  private isActionBlocked(unit: BattleUnit): boolean {
    return unit.hasBuff('stun') || unit.hasBuff('root');
  }

  /**
   * 选择技能
   */
  private chooseSkill(actor: BattleUnit, target: BattleUnit): Skill | null {
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

    if (!available.length) return null;

    // AI 决策
    const offensive = available.filter(
      (s) => s.type === 'attack' || s.type === 'control' || s.type === 'debuff',
    );
    const heals = available.filter((s) => s.type === 'heal');
    const buffs = available.filter((s) => s.type === 'buff');

    const hpRatio = actor.currentHp / actor.maxHp;

    if (hpRatio < 0.3 && heals.length) {
      return heals[Math.floor(Math.random() * heals.length)];
    }

    if (actor.buffManager.getActiveBuffs().length === 0 && buffs.length) {
      if (Math.random() < 0.3) {
        return buffs[Math.floor(Math.random() * buffs.length)];
      }
    }

    if (target.currentHp < actor.currentHp && offensive.length) {
      return offensive[Math.floor(Math.random() * offensive.length)];
    }

    if (offensive.length) {
      return offensive[Math.floor(Math.random() * offensive.length)];
    }

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
      special_effects?: Array<{ type: string; effect?: string }>;
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
   * 处理无技能可用
   */
  private handleNoSkillAvailable(actor: BattleUnit, state: BattleState): void {
    if (actor.hasBuff('silence')) {
      actor.isDefending = true;
      state.log.push(`${actor.getName()} 因被沉默无法施展术法，摆出防御姿态。`);
    } else {
      const recoveredMp = Math.floor(actor.maxMp * 0.3);
      actor.restoreMp(recoveredMp);
      state.log.push(
        `${actor.getName()} 因灵力耗尽，使用灵石恢复了 ${recoveredMp} 点灵力。`,
      );
    }
  }

  /**
   * 检查是否继续战斗
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
    const buildSnapshot = (unit: BattleUnit): TurnUnitSnapshot => ({
      hp: unit.currentHp,
      maxHp: unit.maxHp,
      mp: unit.currentMp,
      maxMp: unit.maxMp,
      buffs: unit.getActiveBuffIds(),
    });

    return {
      turn: state.turn,
      player: buildSnapshot(state.player),
      opponent: buildSnapshot(state.opponent),
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

    // 伤势处理
    this.applyBattleInjuries(loserUnit, state.log);

    // 清除临时 Buff
    state.player.clearTemporaryBuffs();
    state.opponent.clearTemporaryBuffs();

    return {
      winner: winnerUnit.cultivatorData,
      loser: loserUnit.cultivatorData,
      log: state.log,
      turns: state.turn,
      playerHp: state.player.currentHp,
      opponentHp: state.opponent.currentHp,
      timeline: state.timeline,
      playerPersistentBuffs: state.player.exportPersistentBuffs(),
      opponentPersistentBuffs: state.opponent.exportPersistentBuffs(),
      player: state.player.cultivatorData.id!,
      opponent: state.opponent.cultivatorData.id!,
    };
  }

  /**
   * 伤势处理
   */
  private applyBattleInjuries(loser: BattleUnit, log: string[]): void {
    const hpPercent = loser.currentHp / loser.maxHp;

    if (hpPercent < 0.3) {
      const hasMinorWound = loser.hasBuff('minor_wound');
      const hasMajorWound = loser.hasBuff('major_wound');
      const hasNearDeath = loser.hasBuff('near_death');

      if (hasNearDeath) {
        log.push(`${loser.getName()} 的伤势已达濒死状态。`);
      } else if (hasMajorWound && hpPercent < 0.1) {
        loser.buffManager.removeBuff('major_wound');
        const config = buffRegistry.get('near_death');
        if (config) loser.buffManager.addBuff(config, loser);
        log.push(`${loser.getName()} 的伤势从重伤升级为濒死！`);
      } else if (hasMinorWound && hpPercent < 0.3) {
        loser.buffManager.removeBuff('minor_wound');
        const config = buffRegistry.get('major_wound');
        if (config) loser.buffManager.addBuff(config, loser);
        log.push(`${loser.getName()} 的伤势从轻伤升级为重伤！`);
      } else if (!hasMinorWound && !hasMajorWound) {
        const woundType = hpPercent < 0.1 ? 'major_wound' : 'minor_wound';
        const config = buffRegistry.get(woundType);
        if (config) loser.buffManager.addBuff(config, loser);
        log.push(
          `${loser.getName()} 受了${woundType === 'minor_wound' ? '轻伤' : '重伤'}！`,
        );
      }
    }
  }
}

/**
 * 兼容接口
 */
export function simulateBattle(
  player: Cultivator,
  opponent: Cultivator,
  initialPlayerState?: InitialUnitState,
): BattleEngineResult {
  const engine = new BattleEngineV2();
  return engine.simulateBattle(player, opponent, initialPlayerState);
}
