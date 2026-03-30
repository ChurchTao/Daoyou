import { ActiveSkill } from '../../abilities/ActiveSkill';
import { GameplayTags } from '../../core';
import { AttributeType, BuffType } from '../../core/types';
import { Unit } from '../../units/Unit';
import {
  AttrsStateView,
  BattleStateFrame,
  BattleStateTimeline,
  BuffStateView,
  CooldownStateView,
  StateFramePhase,
  UnitStateDelta,
  UnitStateSnapshot,
} from './types';

/**
 * BattleStateRecorder
 *
 * 职责：在每次行动前后对双方单位进行状态快照，并计算帧间 Delta。
 *
 * 采样时机（在 BattleEngineV5 中触发）：
 *  1. battle_init  — 战斗开始后（基线快照）
 *  2. action_pre   — 每个单位的 ActionPreEvent 发布并处理完毕后
 *  3. action_post  — 该单位的动作执行、Buff 过期、CD 刷新全部完成后
 *  4. battle_end   — 战斗结束后（终态快照）
 *
 * 设计原则：
 *  - 与日志系统完全解耦，不依赖 EventBus
 *  - 只记录 Unit 的公开 API，不侵入内部状态
 *  - Delta 仅包含实际变化的字段（控制体积）
 */
export class BattleStateRecorder {
  private _frames: BattleStateFrame[] = [];
  private _frameCounter: number = 0;
  /** 上一帧各单位的快照，用于计算 delta */
  private _prevSnapshots = new Map<string, UnitStateSnapshot>();

  /**
   * 记录一个状态帧
   * @param phase         帧所在阶段
   * @param turn          当前回合数
   * @param units         所有参战单位
   * @param actorId       当前行动者 ID（action_pre / action_post 时传入）
   * @param sourceSpanId  关联日志 Span ID（可选，供前端联动使用）
   */
  record(
    phase: StateFramePhase,
    turn: number,
    units: Unit[],
    actorId?: string,
    sourceSpanId?: string,
  ): void {
    const snapshots: Record<string, UnitStateSnapshot> = {};
    const deltas: Record<string, UnitStateDelta> = {};

    for (const unit of units) {
      const snapshot = this._buildSnapshot(unit);
      snapshots[unit.id] = snapshot;

      const prev = this._prevSnapshots.get(unit.id);
      if (prev) {
        const delta = this._computeDelta(prev, snapshot);
        if (this._hasDelta(delta)) {
          deltas[unit.id] = delta;
        }
      }

      this._prevSnapshots.set(unit.id, snapshot);
    }

    const frame: BattleStateFrame = {
      frameId: ++this._frameCounter,
      turn,
      phase,
      actorId,
      sourceSpanId,
      units: snapshots,
      deltas: Object.keys(deltas).length > 0 ? deltas : undefined,
    };

    this._frames.push(frame);
  }

  /** 获取所有状态帧的副本 */
  getFrames(): BattleStateFrame[] {
    return [...this._frames];
  }

  /** 获取结构化时间线（含单位 ID/名称映射） */
  getTimeline(units: Unit[]): BattleStateTimeline {
    const unitIds = units.map((u) => u.id);
    const unitNames: Record<string, string> = {};
    for (const unit of units) {
      unitNames[unit.id] = unit.name;
    }
    return {
      frames: [...this._frames],
      unitIds,
      unitNames,
    };
  }

  // ===== Private: Snapshot Building =====

  private _buildSnapshot(unit: Unit): UnitStateSnapshot {
    const { currentHp, maxHp, currentMp, maxMp, currentShield } =
      unit.getSnapshot();
    const hpPercent =
      maxHp > 0 ? Math.round((currentHp / maxHp) * 10000) / 100 : 0;
    const mpPercent =
      maxMp > 0 ? Math.round((currentMp / maxMp) * 10000) / 100 : 0;

    return {
      id: unit.id,
      name: unit.name,
      alive: unit.isAlive(),
      hp: {
        current: Math.round(currentHp),
        max: maxHp,
        percent: hpPercent,
      },
      mp: {
        current: Math.round(currentMp),
        max: maxMp,
        percent: mpPercent,
      },
      shield: Math.round(currentShield),
      attrs: this._buildAttrs(unit),
      buffs: this._buildBuffs(unit),
      cooldowns: this._buildCooldowns(unit),
      canAct:
        unit.isAlive() &&
        !unit.tags.hasAnyTag([
          GameplayTags.STATUS.NO_ACTION,
          GameplayTags.STATUS.STUNNED,
        ]),
    };
  }

  private _buildAttrs(unit: Unit): AttrsStateView {
    const a = unit.attributes;
    return {
      spirit: a.getValue(AttributeType.SPIRIT),
      vitality: a.getValue(AttributeType.VITALITY),
      speed: a.getValue(AttributeType.SPEED),
      willpower: a.getValue(AttributeType.WILLPOWER),
      wisdom: a.getValue(AttributeType.WISDOM),
      atk: a.getValue(AttributeType.ATK),
      def: a.getValue(AttributeType.DEF),
      magicAtk: a.getValue(AttributeType.MAGIC_ATK),
      magicDef: a.getValue(AttributeType.MAGIC_DEF),
      critRate: a.getValue(AttributeType.CRIT_RATE),
      critDamageMult: a.getValue(AttributeType.CRIT_DAMAGE_MULT),
      evasionRate: a.getValue(AttributeType.EVASION_RATE),
      controlHit: a.getValue(AttributeType.CONTROL_HIT),
      controlResistance: a.getValue(AttributeType.CONTROL_RESISTANCE),
      armorPenetration: a.getValue(AttributeType.ARMOR_PENETRATION),
      magicPenetration: a.getValue(AttributeType.MAGIC_PENETRATION),
      critResist: a.getValue(AttributeType.CRIT_RESIST),
      critDamageReduction: a.getValue(AttributeType.CRIT_DAMAGE_REDUCTION),
      accuracy: a.getValue(AttributeType.ACCURACY),
      healAmplify: a.getValue(AttributeType.HEAL_AMPLIFY),
      maxHp: a.getMaxHp(),
      maxMp: a.getMaxMp(),
    };
  }

  private _buildBuffs(unit: Unit): BuffStateView[] {
    return unit.buffs.getAllBuffs().map((buff) => ({
      id: buff.id,
      name: buff.name,
      type: buff.type as BuffType,
      layers: buff.getLayer(),
      remaining: buff.isPermanent() ? -1 : buff.getDuration(),
      isPermanent: buff.isPermanent(),
    }));
  }

  private _buildCooldowns(unit: Unit): CooldownStateView[] {
    return unit.abilities
      .getAllAbilities()
      .filter((a): a is ActiveSkill => a instanceof ActiveSkill)
      .map((skill) => ({
        skillId: skill.id,
        skillName: skill.name,
        current: skill.currentCooldown,
        max: skill.maxCooldown,
      }));
  }

  // ===== Private: Delta Computation =====

  private _computeDelta(
    prev: UnitStateSnapshot,
    curr: UnitStateSnapshot,
  ): UnitStateDelta {
    const delta: UnitStateDelta = { id: curr.id, name: curr.name };

    if (prev.hp.current !== curr.hp.current) {
      delta.hp = {
        from: prev.hp.current,
        to: curr.hp.current,
        change: curr.hp.current - prev.hp.current,
      };
    }

    if (prev.mp.current !== curr.mp.current) {
      delta.mp = {
        from: prev.mp.current,
        to: curr.mp.current,
        change: curr.mp.current - prev.mp.current,
      };
    }

    if (prev.shield !== curr.shield) {
      delta.shield = {
        from: prev.shield,
        to: curr.shield,
        change: curr.shield - prev.shield,
      };
    }

    const changedAttrs: Partial<
      Record<keyof AttrsStateView, { from: number; to: number }>
    > = {};
    for (const key of Object.keys(prev.attrs) as Array<keyof AttrsStateView>) {
      if (prev.attrs[key] !== curr.attrs[key]) {
        changedAttrs[key] = { from: prev.attrs[key], to: curr.attrs[key] };
      }
    }
    if (Object.keys(changedAttrs).length > 0) {
      delta.attrs = changedAttrs;
    }

    const prevBuffMap = new Map(prev.buffs.map((b) => [b.id, b]));
    const currBuffMap = new Map(curr.buffs.map((b) => [b.id, b]));

    const buffsAdded = curr.buffs.filter((b) => !prevBuffMap.has(b.id));
    const buffsRemoved = prev.buffs
      .filter((b) => !currBuffMap.has(b.id))
      .map((b) => ({ id: b.id, name: b.name }));
    const buffsUpdated = curr.buffs
      .filter((b) => {
        const p = prevBuffMap.get(b.id);
        return p && (p.layers !== b.layers || p.remaining !== b.remaining);
      })
      .map((b) => {
        const p = prevBuffMap.get(b.id)!;
        return {
          id: b.id,
          name: b.name,
          layerChange: p.layers !== b.layers ? b.layers - p.layers : undefined,
          remainingChange:
            p.remaining !== b.remaining ? b.remaining - p.remaining : undefined,
        };
      });

    if (buffsAdded.length > 0) delta.buffsAdded = buffsAdded;
    if (buffsRemoved.length > 0) delta.buffsRemoved = buffsRemoved;
    if (buffsUpdated.length > 0) delta.buffsUpdated = buffsUpdated;

    const prevCDMap = new Map(prev.cooldowns.map((c) => [c.skillId, c]));
    const cooldownsChanged = curr.cooldowns
      .filter((c) => {
        const p = prevCDMap.get(c.skillId);
        return p !== undefined && p.current !== c.current;
      })
      .map((c) => ({
        skillId: c.skillId,
        skillName: c.skillName,
        from: prevCDMap.get(c.skillId)!.current,
        to: c.current,
      }));
    if (cooldownsChanged.length > 0) delta.cooldownsChanged = cooldownsChanged;

    if (prev.canAct !== curr.canAct) {
      delta.canActChanged = { from: prev.canAct, to: curr.canAct };
    }

    if (prev.alive !== curr.alive) {
      delta.aliveChanged = { from: prev.alive, to: curr.alive };
    }

    return delta;
  }

  /** 判断 delta 是否包含任何实际变化 */
  private _hasDelta(delta: UnitStateDelta): boolean {
    return !!(
      delta.hp ||
      delta.mp ||
      delta.shield ||
      delta.attrs ||
      delta.buffsAdded?.length ||
      delta.buffsRemoved?.length ||
      delta.buffsUpdated?.length ||
      delta.cooldownsChanged?.length ||
      delta.canActChanged ||
      delta.aliveChanged
    );
  }
}
