import { BuffTag, buffTemplateRegistry, TickMoment } from '@/engine/buff';
import type { Cultivator, Skill } from '@/types/cultivator';
import { effectEngine } from '../effect';
import { EffectTrigger, EffectType } from '../effect/types';
import { BattleUnit } from './BattleUnit';
import { skillExecutor } from './SkillExecutor';
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

      // 【关键】行动开始前，检查控制效果并结算控制类 Buff
      const skipTurn = this.processActorTurnStart(actor, state);

      if (skipTurn) {
        // 被控制了也要让 Buff 时间流逝（消耗掉这次控制）
        continue;
      }

      const target = actor.unitId === 'player' ? state.opponent : state.player;
      const skill = this.chooseSkill(actor, target);

      if (!skill) {
        this.handleNoSkillAvailable(actor, state);
        // 行动结束后 tick 增益/减益类 Buff
        this.processActorTurnEnd(actor, state);
        continue;
      }

      const result = skillExecutor.execute(actor, target, skill, state.turn);
      state.log.push(...result.logs);

      // 【关键】行动结束后，结算增益/减益类 Buff
      this.processActorTurnEnd(actor, state);

      if (!target.isAlive()) {
        if (!snapshottedThisTurn) {
          state.timeline.push(this.snapshotTurn(state));
          snapshottedThisTurn = true;
        }
        break;
      }
    }

    // 4. 回合结束触发 (HOT 治疗、回复类效果)
    this.processTurnEnd(state);

    // 5. 递减冷却
    state.player.tickCooldowns();
    state.opponent.tickCooldowns();

    // 6. 记录回合快照
    if (!snapshottedThisTurn) {
      state.timeline.push(this.snapshotTurn(state));
    }
  }

  /**
   * 角色行动开始处理
   * 检查控制效果，并结算控制类 Buff
   * @returns true 表示该角色被控制，跳过行动
   */
  private processActorTurnStart(
    actor: BattleUnit,
    state: BattleState,
  ): boolean {
    // 检查是否被控制
    const isControlled = this.isActionBlocked(actor);

    // 【关键】结算控制类 Buff（生效即消耗）
    if (isControlled) {
      const controlBuffs = actor.buffManager.getBuffsByTag(BuffTag.CONTROL);
      const controlBuffName = controlBuffs
        .map((item) => item.config.name)
        .join('、');
      state.log.push(
        `${actor.getName()} 处于「${controlBuffName}」状态，无法行动！`,
      );
    }

    const expiredEvents = actor.buffManager.tick(
      state.turn,
      TickMoment.ON_ACTION_START,
    );
    for (const event of expiredEvents) {
      if (event.message) {
        state.log.push(event.message);
      }
    }

    return isControlled;
  }

  /**
   * 角色行动结束处理
   * 结算增益/减益类 Buff
   */
  private processActorTurnEnd(actor: BattleUnit, state: BattleState): void {
    const expiredEvents = actor.buffManager.tick(
      state.turn,
      TickMoment.ON_ACTION_END,
    );
    for (const event of expiredEvents) {
      if (event.message) {
        state.log.push(event.message);
      }
    }
    actor.markAttributesDirty();
  }

  /**
   * 回合开始处理：DOT 伤害
   * 注意：Buff 时间流逝现在由 processActorTurnStart/End 处理
   */
  private processTurnStart(state: BattleState): void {
    for (const unit of [state.player, state.opponent]) {
      // DOT 伤害（通过 EffectEngine）
      const { dotDamage, logs } = unit.processTurnStartEffects();
      if (dotDamage > 0) {
        unit.applyDamage(dotDamage);
        state.log.push(...logs);
      }

      // 属性脏标记
      unit.markAttributesDirty();
    }
  }

  /**
   * 回合结束处理：HOT 治疗、回复类效果
   */
  private processTurnEnd(state: BattleState): void {
    for (const unit of [state.player, state.opponent]) {
      // 触发 ON_TURN_END 效果
      const target = unit === state.player ? state.opponent : state.player;
      const ctx = effectEngine.processWithContext(
        EffectTrigger.ON_TURN_END,
        unit,
        target,
        0,
      );

      // 【优化】合并日志，并添加总结性说明
      if (ctx.logs.length > 0) {
        // 检查是否有法力回复
        const hasManaRegen = ctx.logs.some(
          (log) => log.includes('回复了') && log.includes('法力'),
        );
        if (hasManaRegen) {
          // 添加说明：由于装备效果
          const regenLogs = ctx.logs.filter(
            (log) => log.includes('回复了') && log.includes('法力'),
          );
          if (regenLogs.length > 0) {
            state.log.push(...regenLogs.map((log) => `${log}（装备效果）`));
            // 添加其他日志
            const otherLogs = ctx.logs.filter(
              (log) => !log.includes('回复了') || !log.includes('法力'),
            );
            state.log.push(...otherLogs);
          } else {
            state.log.push(...ctx.logs);
          }
        } else {
          state.log.push(...ctx.logs);
        }
      }

      // 属性脏标记
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
   * 选择技能 - 智能 AI 决策
   * 基于技能效果类型和当前战斗状态选择最优技能
   */
  private chooseSkill(actor: BattleUnit, target: BattleUnit): Skill | null {
    const available = actor.cultivatorData.skills.filter((s) =>
      actor.canUseSkill(s),
    );

    if (!available.length) return null;

    // 分类技能
    const classified = this.classifySkills(available);

    // 计算生命比例
    const actorHpRatio = actor.currentHp / actor.maxHp;
    const targetHpRatio = target.currentHp / target.maxHp;

    // 决策逻辑
    // 1. 濒死时优先治疗
    if (actorHpRatio < 0.25 && classified.heals.length > 0) {
      return this.pickRandom(classified.heals);
    }

    // 2. 低血量时有一定概率治疗
    if (
      actorHpRatio < 0.5 &&
      classified.heals.length > 0 &&
      Math.random() < 0.6
    ) {
      return this.pickRandom(classified.heals);
    }

    // 3. 对方低血量时优先攻击
    if (targetHpRatio < 0.3 && classified.attacks.length > 0) {
      return this.pickRandom(classified.attacks);
    }

    // 4. 如果没有增益 Buff 且有增益技能，考虑使用
    const hasActiveBuff = actor.buffManager
      .getActiveBuffs()
      .some((b) => !b.config.tags?.includes(BuffTag.DEBUFF));
    if (!hasActiveBuff && classified.buffs.length > 0 && Math.random() < 0.3) {
      return this.pickRandom(classified.buffs);
    }

    // 5. 敌人没有控制状态时，考虑使用控制技能
    const targetHasControl = target.buffManager
      .getActiveBuffs()
      .some((b) => b.config.tags?.includes(BuffTag.CONTROL));
    if (
      !targetHasControl &&
      classified.controls.length > 0 &&
      Math.random() < 0.4
    ) {
      return this.pickRandom(classified.controls);
    }

    // 6. 敌人没有 DOT 时，考虑使用 DOT 技能
    const targetHasDot = target.buffManager
      .getActiveBuffs()
      .some((b) => b.config.tags?.includes(BuffTag.DOT));
    if (!targetHasDot && classified.dots.length > 0 && Math.random() < 0.5) {
      return this.pickRandom(classified.dots);
    }

    // 7. 默认使用攻击技能
    if (classified.attacks.length > 0) {
      return this.pickRandom(classified.attacks);
    }

    // 8. 如果没有攻击技能，随机选择
    return this.pickRandom(available);
  }

  /**
   * 分类技能
   * 基于技能的 effects 推断类型
   */
  private classifySkills(skills: Skill[]): {
    attacks: Skill[];
    heals: Skill[];
    buffs: Skill[];
    debuffs: Skill[];
    controls: Skill[];
    dots: Skill[];
  } {
    const result = {
      attacks: [] as Skill[],
      heals: [] as Skill[],
      buffs: [] as Skill[],
      debuffs: [] as Skill[],
      controls: [] as Skill[],
      dots: [] as Skill[],
    };

    for (const skill of skills) {
      const effects = skill.effects || [];
      let isAttack = false;
      let isHeal = false;
      let isBuff = false;
      let isControl = false;
      let isDot = false;

      for (const effect of effects) {
        switch (effect.type) {
          case EffectType.Damage:
          case EffectType.TrueDamage: // 【修复】真实伤害也是攻击类技能
            isAttack = true;
            break;
          case EffectType.Heal:
            isHeal = true;
            break;
          case EffectType.AddBuff: {
            const buffId = (effect.params as { buffId?: string })?.buffId;
            if (buffId) {
              // 检查是控制、DOT 还是普通 Buff
              if (['stun', 'silence', 'root'].includes(buffId)) {
                isControl = true;
              } else if (['burn', 'bleed', 'poison'].includes(buffId)) {
                isDot = true;
              } else if (skill.target_self) {
                isBuff = true;
              }
            }
            break;
          }
          case EffectType.DotDamage:
            isDot = true;
            break;
        }
      }

      // 按优先级分类
      if (isHeal && skill.target_self) {
        result.heals.push(skill);
      }
      if (isBuff) {
        result.buffs.push(skill);
      }
      if (isControl) {
        result.controls.push(skill);
      }
      if (isDot) {
        result.dots.push(skill);
      }
      if (isAttack) {
        result.attacks.push(skill);
      }
    }

    return result;
  }

  /**
   * 随机选择
   */
  private pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /**
   * 处理无技能可用
   */
  private handleNoSkillAvailable(actor: BattleUnit, state: BattleState): void {
    if (actor.hasBuff('silence')) {
      actor.isDefending = true;
      state.log.push(`${actor.getName()} 因被沉默无法施展术法，摆出防御姿态`);
    } else {
      const recoveredMp = Math.floor(actor.maxMp * 0.3);
      actor.restoreMp(recoveredMp);
      state.log.push(
        `${actor.getName()} 因灵力耗尽，使用灵石恢复了 ${recoveredMp} 点灵力`,
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
      `✨ ${winnerUnit.getName()} 获胜！剩余气血：${winnerUnit.currentHp}，对手剩余气血：${loserUnit.currentHp}`,
    );

    // 伤势处理
    this.applyBattleInjuries(loserUnit, state);

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
  private applyBattleInjuries(loser: BattleUnit, state: BattleState): void {
    const hpPercent = loser.currentHp / loser.maxHp;

    if (hpPercent < 0.3) {
      const hasMinorWound = loser.hasBuff('minor_wound');
      const hasMajorWound = loser.hasBuff('major_wound');
      const hasNearDeath = loser.hasBuff('near_death');

      if (hasNearDeath) {
        state.log.push(`${loser.getName()} 的伤势已达濒死状态`);
      } else if (hasMajorWound && hpPercent < 0.1) {
        loser.buffManager.removeBuff('major_wound');
        const config = buffTemplateRegistry.getDefaultConfig('near_death');
        if (config) loser.buffManager.addBuff(config, loser, state.turn);
        state.log.push(`${loser.getName()} 的伤势从重伤升级为濒死！`);
      } else if (hasMinorWound && hpPercent < 0.3) {
        loser.buffManager.removeBuff('minor_wound');
        const config = buffTemplateRegistry.getDefaultConfig('major_wound');
        if (config) loser.buffManager.addBuff(config, loser, state.turn);
        state.log.push(`${loser.getName()} 的伤势从轻伤升级为重伤！`);
      } else if (!hasMinorWound && !hasMajorWound) {
        const woundType = hpPercent < 0.1 ? 'major_wound' : 'minor_wound';
        const config = buffTemplateRegistry.getDefaultConfig(woundType);
        if (config) loser.buffManager.addBuff(config, loser, state.turn);
        state.log.push(
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
