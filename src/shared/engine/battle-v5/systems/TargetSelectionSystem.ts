// engine/battle-v5/systems/TargetSelectionSystem.ts

import { Unit } from '../units/Unit';
import { TargetPolicy, TargetFilter } from '../abilities/TargetPolicy';
import { AttributeType } from '../core';

/**
 * TargetSelectionSystem - 目标选择系统
 *
 * EDA 架构设计：
 * - 根据 TargetPolicy 选择目标
 * - 支持队伍筛选、过滤器、范围选择
 * - 未来可订阅 SkillSelectedEvent 进行自动目标选择
 */
export class TargetSelectionSystem {
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor() {
    this._subscribeToEvents();
  }

  private _subscribeToEvents(): void {
    // TODO: 订阅 SkillSelectedEvent（待事件定义后实现）
    // const handler = (event: SkillSelectedEvent) => this._onSkillSelected(event);
    // EventBus.instance.subscribe('SkillSelectedEvent', handler, EventPriorityLevel.ACTION_TRIGGER);
    // this._handlers.set('SkillSelectedEvent', handler);
  }

  /**
   * 选择目标
   * @param caster 施法者
   * @param policy 目标策略
   * @param allUnits 所有战斗单位
   * @returns 选中的目标列表
   */
  selectTargets(
    caster: Unit,
    policy: TargetPolicy,
    allUnits: Unit[]
  ): Unit[] {
    // 1. 根据队伍筛选
    const candidates = this.getTargetCandidates(caster, policy, allUnits);

    // 4. 根据范围选择
    return this._selectByScope(
      candidates,
      policy.scope,
      policy.maxTargets,
      () => caster.runtime.random.next(),
    );
  }

  getTargetCandidates(
    caster: Unit,
    policy: TargetPolicy,
    allUnits: Unit[],
  ): Unit[] {
    return this._applyFilters(
      this._filterByTeam(caster, policy.team, allUnits).filter((unit) =>
        unit.isAlive(),
      ),
      policy.filters,
    );
  }

  private _filterByTeam(
    caster: Unit,
    team: TargetPolicy['team'],
    allUnits: Unit[]
  ): Unit[] {
    switch (team) {
      case 'self':
        return [caster];
      case 'enemy':
        return allUnits.filter((unit) => unit.teamId !== caster.teamId);
      case 'ally':
        return allUnits.filter(
          (unit) => unit.teamId === caster.teamId && unit !== caster,
        );
      case 'any':
        return allUnits;
      default:
        return allUnits;
    }
  }

  private _applyFilters(units: Unit[], filters: TargetFilter[]): Unit[] {
    if (filters.length === 0) return units;

    let result = [...units];

    for (const filter of filters) {
      result = this._applyFilter(result, filter);
    }

    return result;
  }

  private _applyFilter(units: Unit[], filter: TargetFilter): Unit[] {
    if (units.length === 0) return units;

    switch (filter) {
      case 'lowest_hp':
        return [units.reduce((min, u) =>
          u.getCurrentHp() < min.getCurrentHp() ? u : min
        )];
      case 'highest_hp':
        return [units.reduce((max, u) =>
          u.getCurrentHp() > max.getCurrentHp() ? u : max
        )];
      case 'lowest_mp':
        return [units.reduce((min, u) =>
          u.getCurrentMp() < min.getCurrentMp() ? u : min
        )];
      case 'fastest':
        return [units.reduce((max, u) =>
          u.attributes.getValue(AttributeType.ACTION_SPEED) >
          max.attributes.getValue(AttributeType.ACTION_SPEED) ? u : max
        )];
      case 'slowest':
        return [units.reduce((min, u) =>
          u.attributes.getValue(AttributeType.ACTION_SPEED) <
          min.attributes.getValue(AttributeType.ACTION_SPEED) ? u : min
        )];
      default:
        return units;
    }
  }

  private _selectByScope(
    units: Unit[],
    scope: TargetPolicy['scope'],
    maxTargets: number,
    random: () => number,
  ): Unit[] {
    switch (scope) {
      case 'single':
        return units.slice(0, 1);
      case 'random': {
        const shuffled = [...units];
        for (let index = shuffled.length - 1; index > 0; index--) {
          const swapIndex = Math.floor(random() * (index + 1));
          [shuffled[index], shuffled[swapIndex]] = [
            shuffled[swapIndex],
            shuffled[index],
          ];
        }
        return shuffled.slice(0, 1);
      }
      case 'aoe':
        return units.slice(0, maxTargets);
      default:
        return units.slice(0, 1);
    }
  }

  /**
   * 销毁系统
   */
  destroy(): void {
    this._handlers.clear();
  }
}
