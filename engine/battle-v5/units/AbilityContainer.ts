import { Unit } from './Unit';
import { Ability } from '../abilities/Ability';

export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.setActive(true);
  }

  removeAbility(abilityId: string): void {
    const ability = this._abilities.get(abilityId);
    if (ability) {
      ability.setActive(false);
      this._abilities.delete(abilityId);
    }
  }

  getAbility(abilityId: string): Ability | undefined {
    return this._abilities.get(abilityId);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this._abilities.values());
  }

  clone(owner: Unit): AbilityContainer {
    const clone = new AbilityContainer(owner);
    // TODO: 实现深拷贝：遍历 this._abilities，复制每个 Ability 实例并添加到 clone
    // 当前返回空容器，适用于 Ability 系统未完成时的占位实现
    return clone;
  }
}
