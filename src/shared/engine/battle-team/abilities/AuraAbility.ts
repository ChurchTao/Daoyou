import { AttributeType, ModifierType, type AttributeModifier } from '@shared/engine/battle-v5/core/types';
import { TeamAbility } from '../TeamAbility';
import type { TeamAbilityContext } from '../TeamAbility';
import type { TeamUnit } from '../TeamUnit';
import type { TeamTargetPolicy, TeamBattleInternalEvent } from '../types';

export interface AuraAbilityOptions {
  id: string;
  name: string;
  targetAttr: AttributeType;
  modifierType: ModifierType;
  value: number;
}

/**
 * 光环类技能。
 *
 * 战斗开始时给 ally 队伍所有 alive 单位挂 AttributeModifier。
 * 订阅 UnitDied：死者是自己 → 移除所有已加 modifier；死者是队友 → 从死者身上移除。
 */
export class AuraAbility extends TeamAbility {
  private _targetAttr: AttributeType;
  private _modifierType: ModifierType;
  private _value: number;
  private _appliedModifierIds: Map<string, string> = new Map();

  constructor(opts: AuraAbilityOptions) {
    const policy: TeamTargetPolicy = { team: 'ally', scope: 'aoe', maxTargets: 99 };
    super({
      id: opts.id,
      name: opts.name,
      kind: 'aura',
      targetPolicy: policy,
      cooldown: 0,
      maxUsesPerRound: 0,
    });
    this._targetAttr = opts.targetAttr;
    this._modifierType = opts.modifierType;
    this._value = opts.value;
  }

  onBattleStart(ctx: TeamAbilityContext): (() => void) | void {
    this.applyToAllAllies(ctx);

    const unsub = ctx.subscribe('UnitDied', (e: TeamBattleInternalEvent) => {
      if (e.type !== 'UnitDied') return;
      const deadUnit = e.unit;
      if (deadUnit.id === ctx.source.id) {
        this.removeAllApplied(ctx);
      } else if (this._appliedModifierIds.has(deadUnit.id)) {
        this.removeFromUnit(deadUnit as TeamUnit);
      }
    });

    return unsub;
  }

  private applyToAllAllies(ctx: TeamAbilityContext): void {
    const allies = ctx.engine.selectTargets(ctx.source, {
      team: 'ally',
      scope: 'aoe',
      maxTargets: 99,
    });
    for (const ally of allies) {
      this.applyToUnit(ally as TeamUnit);
    }
    ctx.engine.recordLog({
      round: 0,
      actorId: ctx.source.id,
      abilityId: this.id,
      kind: 'aura_apply',
      text: `${ctx.source.name} 的【${this.name}】生效（${allies.length} 名友军受加持）`,
    });
  }

  private applyToUnit(unit: TeamUnit): void {
    const modifierId = `${this.id}_${unit.id}`;
    const modifier: AttributeModifier = {
      id: modifierId,
      attrType: this._targetAttr,
      type: this._modifierType,
      value: this._value,
      source: this,
    };
    unit.addModifier(modifier);
    unit.addAura(this.id);
    this._appliedModifierIds.set(unit.id, modifierId);
  }

  private removeFromUnit(unit: TeamUnit): void {
    const modifierId = this._appliedModifierIds.get(unit.id);
    if (modifierId) {
      unit.removeModifier(modifierId);
      unit.removeAura(this.id);
      this._appliedModifierIds.delete(unit.id);
    }
  }

  private removeAllApplied(ctx: TeamAbilityContext): void {
    const allies = ctx.engine.selectTargets(ctx.source, {
      team: 'ally',
      scope: 'aoe',
      maxTargets: 99,
    });
    for (const [unitId, modifierId] of this._appliedModifierIds) {
      const unit = allies.find((a) => a.id === unitId) as TeamUnit | undefined;
      if (unit) {
        unit.removeModifier(modifierId);
        unit.removeAura(this.id);
      }
    }
    this._appliedModifierIds.clear();
    ctx.engine.recordLog({
      round: 0,
      actorId: ctx.source.id,
      abilityId: this.id,
      reason: 'death',
      kind: 'aura_remove',
      text: `${ctx.source.name} 的【${this.name}】随阵亡消散`,
    });
  }

  execute(_ctx: TeamAbilityContext, _targets: TeamUnit[]): void {
    void _ctx;
    void _targets;
  }

  isUsableAsAction(): boolean {
    return false;
  }
}
