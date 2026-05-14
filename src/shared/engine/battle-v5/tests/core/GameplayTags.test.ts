import { GameplayTagContainer, GameplayTags } from '@shared/engine/shared/tag-domain';

describe('GameplayTagContainer', () => {
  describe('基础操作', () => {
    it('应支持添加单个标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      expect(container.hasTag('Ability.Fire')).toBe(true);
    });

    it('应支持批量添加标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water', 'Ability.Earth']);

      expect(container.hasTag('Ability.Fire')).toBe(true);
      expect(container.hasTag('Ability.Water')).toBe(true);
      expect(container.hasTag('Ability.Earth')).toBe(true);
    });

    it('应支持移除标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);
      container.removeTags(['Ability.Fire']);

      expect(container.hasTag('Ability.Fire')).toBe(false);
      expect(container.hasTag('Ability.Water')).toBe(true);
    });

    it('应支持清空所有标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);
      container.clear();

      expect(container.getTags()).toEqual([]);
    });
  });

  describe('父标签匹配', () => {
    it('应支持父标签精确匹配', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Status.Immune']);

      expect(container.hasTag('Status.Immune')).toBe(true);
      expect(container.hasTag('Status.Immune.Stun')).toBe(true);
    });

    it('应支持多层父标签匹配', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Element']);

      expect(container.hasTag('Ability.Element.Fire')).toBe(true);
      expect(container.hasTag('Ability.Element.Water.Ice')).toBe(true);
    });

    it('子标签不应匹配父标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Element.Fire']);

      expect(container.hasTag('Ability.Element')).toBe(false);
      expect(container.hasTag('Ability.Element.Fire')).toBe(true);
    });
  });

  describe('批量查询', () => {
    it('hasAnyTag 应在有任意匹配时返回 true', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      expect(container.hasAnyTag(['Ability.Fire', 'Ability.Water'])).toBe(true);
      expect(container.hasAnyTag(['Ability.Water', 'Ability.Earth'])).toBe(false);
    });

    it('hasAllTags 应在全部匹配时返回 true', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);

      expect(container.hasAllTags(['Ability.Fire', 'Ability.Water'])).toBe(true);
      expect(container.hasAllTags(['Ability.Fire', 'Ability.Earth'])).toBe(false);
    });
  });

  describe('克隆功能', () => {
    it('应正确克隆标签容器', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire', 'Ability.Water']);

      const cloned = container.clone();

      expect(cloned.hasTag('Ability.Fire')).toBe(true);
      expect(cloned.hasTag('Ability.Water')).toBe(true);
    });

    it('克隆的容器应独立于原容器', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);

      const cloned = container.clone();
      cloned.addTags(['Ability.Water']);

      expect(container.hasTag('Ability.Water')).toBe(false);
      expect(cloned.hasTag('Ability.Water')).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('应处理空标签路径', () => {
      const container = new GameplayTagContainer();
      expect(container.hasTag('')).toBe(false);
    });

    it('应忽略重复添加的标签', () => {
      const container = new GameplayTagContainer();
      container.addTags(['Ability.Fire']);
      container.addTags(['Ability.Fire']);

      expect(container.getTags()).toEqual(['Ability.Fire']);
    });

    it('应处理格式错误的标签路径', () => {
      const container = new GameplayTagContainer();
      container.addTags(['A..B']);

      expect(container.hasTag('A..B')).toBe(true);
    });
  });
});

describe('GameplayTags 常量对象', () => {
  it('应包含所有必需的标签分类', () => {
    expect(GameplayTags.UNIT).toBeDefined();
    expect(GameplayTags.STATUS).toBeDefined();
    expect(GameplayTags.ABILITY).toBeDefined();
    expect(GameplayTags.BUFF).toBeDefined();
  });

  it('应包含核心单位标签', () => {
    expect(GameplayTags.UNIT.TYPE.COMBATANT).toBe('Unit.Type.Combatant');
    expect(GameplayTags.UNIT.TYPE.PLAYER).toBe('Unit.Type.Player');
  });

  it('应包含核心状态标签', () => {
    expect(GameplayTags.STATUS.IMMUNE.ROOT).toBe('Status.Immune');
    expect(GameplayTags.STATUS.IMMUNE.DEBUFF).toBe('Status.Immune.Debuff');
  });

  it('应包含核心技能标签', () => {
    expect(GameplayTags.ABILITY.FUNCTION.DAMAGE).toBe(
      'Ability.Function.Damage',
    );
    expect(GameplayTags.ABILITY.FUNCTION.BUFF).toBe('Ability.Function.Buff');
    expect(GameplayTags.ABILITY.CHANNEL.MAGIC).toBe('Ability.Channel.Magic');
    expect(GameplayTags.ABILITY.ELEMENT.FIRE).toBe('Ability.Element.Fire');
    expect(
      Object.prototype.hasOwnProperty.call(GameplayTags.ABILITY, 'TYPE_MAGIC'),
    ).toBe(false);
    expect(
      Object.prototype.hasOwnProperty.call(GameplayTags.ABILITY, 'FUNCTION_DAMAGE'),
    ).toBe(false);
  });

  it('应包含核心 BUFF 标签', () => {
    expect(GameplayTags.BUFF.TYPE.DEBUFF).toBe('Buff.Type.Debuff');
    expect(GameplayTags.BUFF.DOT.POISON).toBe('Buff.Dot.Poison');
  });
});
