import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getRealmStageRank } from '@shared/config/realmProgression';
import { BuffType, DamageSource, DamageType } from '../../core/types';
import { DamageRequestEvent } from '../../core/events';
import { EventBus } from '../../core/EventBus';
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { ApplyBuffEffect } from '../../effects/ApplyBuffEffect';

describe('realm pressure integration', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    EventBus.instance.reset();
  });

  function createUnit(id: string, rank?: number): Unit {
    const unit = new Unit(id, id, {});
    if (rank !== undefined) {
      unit.setRealmMeta({ realmRank: rank });
    }
    return unit;
  }

  function publishTrueDamage(caster: Unit, target: Unit): DamageRequestEvent {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const damageSystem = new DamageSystem();
    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster,
      target,
      damageSource: DamageSource.DIRECT,
      damageType: DamageType.TRUE,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);
    damageSystem.destroy();
    return event;
  }

  it('keeps missing realm meta as same-rank behavior', () => {
    const event = publishTrueDamage(createUnit('attacker'), createUnit('defender'));
    expect(event.finalDamage).toBe(100);
  });

  it('increases high-rank damage and reduces low-rank damage', () => {
    const lowRank = getRealmStageRank('炼气', '初期');
    const highRank = getRealmStageRank('筑基', '初期');

    expect(publishTrueDamage(createUnit('high', highRank), createUnit('low', lowRank)).finalDamage).toBe(140);
    expect(publishTrueDamage(createUnit('low', lowRank), createUnit('high', highRank)).finalDamage).toBe(68);
  });

  it('applies realm pressure to hostile debuff and control chances only', () => {
    const low = createUnit('low', 0);
    const high = createUnit('high', 4);
    vi.spyOn(Math, 'random').mockReturnValue(0.7);

    new ApplyBuffEffect({
      target: 'target',
      chance: 0.8,
      buffConfig: {
        id: 'slow',
        name: '迟滞',
        type: BuffType.DEBUFF,
        duration: 1,
      },
    }).execute({ caster: low, target: high });
    expect(high.buffs.getAllBuffIds()).toEqual([]);

    new ApplyBuffEffect({
      target: 'target',
      chance: 0.8,
      buffConfig: {
        id: 'slow_high',
        name: '威压迟滞',
        type: BuffType.DEBUFF,
        duration: 1,
      },
    }).execute({ caster: high, target: low });
    expect(low.buffs.getAllBuffIds()).toContain('slow_high');

    new ApplyBuffEffect({
      target: 'caster',
      chance: 1,
      buffConfig: {
        id: 'focus',
        name: '凝神',
        type: BuffType.BUFF,
        duration: 1,
      },
    }).execute({ caster: low, target: high });
    expect(low.buffs.getAllBuffIds()).toContain('focus');
  });
});
