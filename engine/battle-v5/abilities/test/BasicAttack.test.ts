// engine/battle-v5/abilities/test/BasicAttack.test.ts
import { BasicAttack } from '../BasicAttack';
import { Unit } from '../../units/Unit';
import { AbilityType } from '../../core/types';
import { GameplayTags } from '../../core/GameplayTags';

describe('BasicAttack', () => {
  let basicAttack: BasicAttack;
  let owner: Unit;

  beforeEach(() => {
    basicAttack = new BasicAttack();
    owner = new Unit('test_unit', '测试单位', {});
  });

  describe('构造函数配置', () => {
    it('should have correct id', () => {
      expect(basicAttack.id).toBe('basic_attack');
    });

    it('should have correct name', () => {
      expect(basicAttack.name).toBe('普攻');
    });

    it('should be active skill type', () => {
      expect(basicAttack.type).toBe(AbilityType.ACTIVE_SKILL);
    });

    it('should have zero mana cost', () => {
      expect(basicAttack.manaCost).toBe(0);
    });

    it('should have 1.0 damage coefficient', () => {
      expect(basicAttack.damageCoefficient).toBe(1.0);
    });

    it('should have 20 base damage', () => {
      expect(basicAttack.baseDamage).toBe(20);
    });

    it('should be physical ability', () => {
      expect(basicAttack.tags.hasTag(GameplayTags.ABILITY.TYPE_PHYSICAL)).toBe(true);
      expect(basicAttack.tags.hasTag(GameplayTags.ABILITY.TYPE_MAGIC)).toBe(false);
    });

    it('should have zero priority', () => {
      expect(basicAttack.priority).toBe(0);
    });

    it('should have zero cooldown', () => {
      expect(basicAttack.getCurrentCooldown()).toBe(0);
      expect(basicAttack.isReady()).toBe(true);
    });
  });

  describe('执行行为', () => {
    it('should be triggerable with no mana cost', () => {
      owner.currentMp = 0;
      expect(basicAttack.canTrigger({ caster: owner, target: owner })).toBe(true);
    });

    it('should have empty executeSkill implementation', () => {
      // executeSkill is protected, but we can test through execute()
      // This should not throw any errors
      expect(() => {
        basicAttack.execute({ caster: owner, target: owner });
      }).not.toThrow();
    });
  });

  describe('生命周期', () => {
    it('should be able to set owner and activate', () => {
      basicAttack.setOwner(owner);
      basicAttack.setActive(true);

      expect(basicAttack.getOwner()).toBe(owner);
      expect(basicAttack.isActive()).toBe(true);
    });

    it('should handle cooldown correctly', () => {
      basicAttack.setCooldown(0);
      expect(basicAttack.isReady()).toBe(true);

      basicAttack.startCooldown();
      expect(basicAttack.isReady()).toBe(true); // Cooldown is 0, so still ready
    });
  });
});
