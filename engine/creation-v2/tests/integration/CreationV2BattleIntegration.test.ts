import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { ActiveSkill } from '@/engine/battle-v5/abilities/ActiveSkill';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import {
  AbilityFactory,
  AbilityType,
  AttributeType,
  BuffType,
} from '@/engine/creation-v2/contracts/battle';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import {
  Buff,
  DamageEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  EventBus,
  RoundPreEvent,
  SkillCastEvent,
  Unit,
} from '@/engine/creation-v2/contracts/battle-testkit';
import { RolledAffix } from '@/engine/creation-v2/types';

describe('Creation V2 battle integration', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    EventBus.instance.reset();
  });

  function createUnit(id: string, name: string): Unit {
    return new Unit(id, name, {
      [AttributeType.SPIRIT]: 100,
      [AttributeType.VITALITY]: 100,
      [AttributeType.SPEED]: 100,
      [AttributeType.WILLPOWER]: 100,
      [AttributeType.WISDOM]: 100,
    });
  }

  function createSkillOutcome(
    rolledAffixes: RolledAffix[],
    sessionId: string = `creation-v2-skill-${rolledAffixes
      .map((affix) => affix.id)
      .join('-')}`,
  ) {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId,
      productType: 'skill',
      materials: [
        {
          id: 'skill-mat',
          name: '赤炎精铁',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '火',
        },
      ],
    });

    session.state.materialFingerprints = [
      {
        materialId: 'skill-mat',
        materialName: '赤炎精铁',
        materialType: 'ore',
        rank: '灵品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Blade'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 24,
        rarityWeight: 3,
        element: '火',
      },
    ];
    session.state.intent = {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: ['Material.Semantic.Flame'],
      requestedTags: [],
      elementBias: '火',
    };
    session.state.energyBudget = {
      total: 24,
      reserved: 6,
      spent: rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      initialRemaining: 18,
      remaining: Math.max(
        0,
        24 -
          6 -
          rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      ),
      allocations: rolledAffixes.map((affix) => ({
        affixId: affix.id,
        amount: affix.energyCost,
      })),
      rejections: [],
      sources: [{ source: '赤炎精铁', amount: 24 }],
    };
    session.state.rolledAffixes = rolledAffixes;

    orchestrator.composeBlueprintWithDefaults(session);
    return orchestrator.materializeOutcome(session);
  }

  function createArtifactOutcome(
    rolledAffixes: RolledAffix[],
    sessionId: string = `creation-v2-artifact-${rolledAffixes
      .map((affix) => affix.id)
      .join('-')}`,
  ) {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId,
      productType: 'artifact',
      materials: [
        {
          id: 'artifact-mat',
          name: '玄铁矿',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '冰',
        },
      ],
    });

    session.state.materialFingerprints = [
      {
        materialId: 'artifact-mat',
        materialName: '玄铁矿',
        materialType: 'ore',
        rank: '灵品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Ice'],
        semanticTags: ['Material.Semantic.Guard', 'Material.Semantic.Freeze'],
        recipeTags: ['Recipe.ProductBias.Artifact'],
        energyValue: 24,
        rarityWeight: 3,
        element: '冰',
      },
    ];
    session.state.intent = {
      productType: 'artifact',
      outcomeKind: 'artifact',
      dominantTags: ['Material.Semantic.Guard'],
      requestedTags: [],
      elementBias: '冰',
      slotBias: 'armor',
    };
    session.state.energyBudget = {
      total: 24,
      reserved: 4,
      spent: rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      initialRemaining: 20,
      remaining: Math.max(
        0,
        24 -
          4 -
          rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      ),
      allocations: rolledAffixes.map((affix) => ({
        affixId: affix.id,
        amount: affix.energyCost,
      })),
      rejections: [],
      sources: [{ source: '玄铁矿', amount: 24 }],
    };
    session.state.rolledAffixes = rolledAffixes;

    orchestrator.composeBlueprintWithDefaults(session);
    return orchestrator.materializeOutcome(session);
  }

  function createGongFaOutcome(
    rolledAffixes: RolledAffix[],
    sessionId: string = `creation-v2-gongfa-${rolledAffixes
      .map((affix) => affix.id)
      .join('-')}`,
  ) {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId,
      productType: 'gongfa',
      materials: [
        {
          id: 'gongfa-mat',
          name: '悟道竹简',
          type: 'gongfa_manual',
          rank: '真品',
          quantity: 1,
        },
      ],
    });

    session.state.materialFingerprints = [
      {
        materialId: 'gongfa-mat',
        materialName: '悟道竹简',
        materialType: 'gongfa_manual',
        rank: '真品',
        quantity: 1,
        explicitTags: ['Material.Type.Manual'],
        semanticTags: ['Material.Semantic.Manual', 'Material.Semantic.Spirit'],
        recipeTags: ['Recipe.ProductBias.GongFa'],
        energyValue: 24,
        rarityWeight: 3,
      },
    ];
    session.state.intent = {
      productType: 'gongfa',
      outcomeKind: 'gongfa',
      dominantTags: ['Material.Semantic.Manual'],
      requestedTags: [],
    };
    session.state.energyBudget = {
      total: 24,
      reserved: 4,
      spent: rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      initialRemaining: 20,
      remaining: Math.max(
        0,
        24 -
          4 -
          rolledAffixes.reduce((sum, affix) => sum + affix.energyCost, 0),
      ),
      allocations: rolledAffixes.map((affix) => ({
        affixId: affix.id,
        amount: affix.energyCost,
      })),
      rejections: [],
      sources: [{ source: '悟道竹简', amount: 24 }],
    };
    session.state.rolledAffixes = rolledAffixes;

    orchestrator.composeBlueprintWithDefaults(session);
    return orchestrator.materializeOutcome(session);
  }

  it('skill self-buff affix should apply buff to caster instead of target', () => {
    const attacker = createUnit('attacker', '施法者');
    const defender = createUnit('defender', '木桩');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-spirit-boost',
        name: '灵机',
        category: 'prefix',
        tags: ['Material.Semantic.Spirit'],
        weight: 60,
        energyCost: 6,
        rollScore: 0.8,
      },
    ]);

    attacker.abilities.addAbility(outcome.ability);

    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
    });

    expect(attacker.buffs.getAllBuffIds()).toContain('craft-stat-spirit-fixed');
    expect(defender.buffs.getAllBuffIds()).not.toContain(
      'craft-stat-spirit-fixed',
    );
  });

  it('skill percent modifier affix should write into DamageRequestEvent bucket', () => {
    const attacker = createUnit('attacker', '施法者');
    const defender = createUnit('defender', '木桩');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-crit-boost',
        name: '锋锐',
        category: 'prefix',
        tags: ['Material.Semantic.Blade'],
        weight: 60,
        energyCost: 6,
        rollScore: 0.8,
      },
    ]);

    attacker.abilities.addAbility(outcome.ability);

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.damageIncreasePctBucket).toBeGreaterThan(0);
  });

  it('artifact round heal affix should trigger on RoundPreEvent with global scope', () => {
    const owner = createUnit('owner', '护身修士');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-suffix-heal-on-round',
        name: '回生珠',
        category: 'suffix',
        tags: ['Material.Semantic.Sustain'],
        weight: 60,
        energyCost: 8,
        rollScore: 1,
      },
    ]);

    owner.abilities.addAbility(outcome.ability);
    owner.takeDamage(200);
    const beforeHp = owner.getCurrentHp();

    EventBus.instance.publish<RoundPreEvent>({
      type: 'RoundPreEvent',
      timestamp: Date.now(),
      turn: 1,
    });

    expect(owner.getCurrentHp()).toBeGreaterThan(beforeHp);
  });

  it('artifact armor affix should write into incoming damage reduction bucket', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '防御者');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-suffix-armor',
        name: '坚壁',
        category: 'suffix',
        tags: ['Material.Semantic.Guard'],
        weight: 50,
        energyCost: 8,
        rollScore: 1,
      },
    ]);

    defender.abilities.addAbility(outcome.ability);

    const attackAbility = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
    ]).ability;

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: attackAbility,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.damageReductionPctBucket).toBeGreaterThan(0);
  });

  it('active skill listeners should ignore events from other abilities', () => {
    const attacker = createUnit('attacker', '施法者');
    const defender = createUnit('defender', '木桩');
    const boostedSkill = createSkillOutcome(
      [
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-crit-boost',
        name: '锋锐',
        category: 'prefix',
        tags: ['Material.Semantic.Blade'],
        weight: 60,
        energyCost: 6,
        rollScore: 1,
      },
    ],
      'creation-v2-skill-boosted',
    );
    const plainSkill = createSkillOutcome(
      [
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
    ],
      'creation-v2-skill-plain',
    );

    attacker.abilities.addAbility(boostedSkill.ability);
    attacker.abilities.addAbility(plainSkill.ability);

    const event: DamageRequestEvent = {
      type: 'DamageRequestEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: plainSkill.ability,
      baseDamage: 100,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.damageIncreasePctBucket ?? 0).toBe(0);
  });

  it('composed skill blueprint should keep active skill listeners after materialization', () => {
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-crit-boost',
        name: '锋锐',
        category: 'prefix',
        tags: ['Material.Semantic.Blade'],
        weight: 60,
        energyCost: 6,
        rollScore: 1,
      },
    ]);

    expect(outcome.ability.type).toBe(AbilityType.ACTIVE_SKILL);
    expect(projectAbilityConfig(outcome.blueprint.productModel).listeners?.length).toBeGreaterThan(0);
  });

  it('artifact damage immunity affix should nullify magic-tagged damage on DamageEvent', () => {
    const attacker = createUnit('attacker', '施法者');
    const defender = createUnit('defender', '护体者');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-signature-spellward',
        name: '玄罡避法罩',
        category: 'signature',
        tags: ['Material.Semantic.Guard'],
        weight: 24,
        energyCost: 12,
        rollScore: 1,
      },
    ]);

    defender.abilities.addAbility(outcome.ability);

    const magicAbility = AbilityFactory.create({
      slug: 'magic-burst',
      name: '真炎咒',
      type: AbilityType.ACTIVE_SKILL,
      tags: [CreationTags.BATTLE.ABILITY_TYPE_MAGIC],
      effects: [],
    });

    const event: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: magicAbility,
      finalDamage: 120,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBe(0);
  });

  it('gongfa buff immunity affix should reject control buff application', () => {
    const owner = createUnit('owner', '清心修士');
    const outcome = createGongFaOutcome([
      {
        id: 'gongfa-signature-unbound-mind',
        name: '万念不染',
        category: 'signature',
        tags: ['Material.Semantic.Manual'],
        weight: 24,
        energyCost: 12,
        rollScore: 1,
      },
    ]);

    owner.abilities.addAbility(outcome.ability);

    const controlBuff = new Buff('frozen' as never, '冰封', BuffType.CONTROL, 1);
    controlBuff.tags.addTags([CreationTags.BATTLE.BUFF_TYPE_CONTROL]);

    owner.buffs.addBuff(controlBuff);

    expect(owner.buffs.getAllBuffIds()).not.toContain('frozen');
  });

  it('artifact death prevent affix should keep owner at 1 hp on lethal damage', () => {
    const owner = createUnit('owner', '续命修士');
    const attacker = createUnit('attacker', '进攻者');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-signature-last-stand',
        name: '守一续命印',
        category: 'signature',
        tags: ['Material.Semantic.Guard'],
        weight: 18,
        energyCost: 14,
        rollScore: 1,
      },
    ]);

    owner.abilities.addAbility(outcome.ability);

    const event: DamageTakenEvent = {
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: owner,
      damageTaken: owner.getCurrentHp(),
      beforeHp: owner.getCurrentHp(),
      remainHp: 0,
      isLethal: true,
    };

    EventBus.instance.publish(event);

    expect(owner.getCurrentHp()).toBe(1);
  });

  it('skill mana burn core affix should consume target mp on execute', () => {
    const attacker = createUnit('attacker', '蚀元修士');
    const defender = createUnit('defender', '受术者');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-mana-burn',
        name: '裂神蚀元',
        category: 'core',
        tags: ['Material.Semantic.Thunder'],
        weight: 44,
        energyCost: 10,
        rollScore: 1,
      },
    ]);

    attacker.abilities.addAbility(outcome.ability);
    const beforeMp = defender.getCurrentMp();

    outcome.ability.execute({
      caster: attacker,
      target: defender,
    });

    expect(defender.getCurrentMp()).toBeLessThan(beforeMp);
  });

  it('artifact magic shield affix should consume mp and reduce incoming damage', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '法幕护体者');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-suffix-magic-shield',
        name: '玄光法幕',
        category: 'suffix',
        tags: ['Material.Semantic.Spirit'],
        weight: 44,
        energyCost: 9,
        rollScore: 1,
      },
    ]);

    defender.abilities.addAbility(outcome.ability);
    const beforeMp = defender.getCurrentMp();
    const event: DamageEvent = {
      type: 'DamageEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
      finalDamage: 100,
    };

    EventBus.instance.publish(event);

    expect(event.finalDamage).toBeLessThan(100);
    expect(defender.getCurrentMp()).toBeLessThan(beforeMp);
  });

  it('artifact reflect affix should publish reflected damage request to attacker', () => {
    const attacker = createUnit('attacker', '进攻者');
    const defender = createUnit('defender', '荆甲修士');
    const outcome = createArtifactOutcome([
      {
        id: 'artifact-core-reflect-thorns',
        name: '荆甲反噬',
        category: 'core',
        tags: ['Material.Semantic.Guard'],
        weight: 52,
        energyCost: 10,
        rollScore: 1,
      },
    ]);

    defender.abilities.addAbility(outcome.ability);

    let reflectedEvent: DamageRequestEvent | undefined;
    const handler = (event: DamageRequestEvent) => {
      if (event.damageSource === 'reflect') {
        reflectedEvent = event;
      }
    };
    EventBus.instance.subscribe('DamageRequestEvent', handler);

    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
      damageTaken: 100,
      beforeHp: defender.getCurrentHp(),
      remainHp: defender.getCurrentHp() - 100,
      isLethal: false,
    });

    EventBus.instance.unsubscribe('DamageRequestEvent', handler);

    expect(reflectedEvent).toBeDefined();
    expect(reflectedEvent?.target).toBe(attacker);
    expect(reflectedEvent?.finalDamage).toBeGreaterThan(0);
  });

  it('skill cooldown modify affix should increase target other skill cooldown', () => {
    const attacker = createUnit('attacker', '封脉修士');
    const defender = createUnit('defender', '受封者');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-prefix-cooldown-shift',
        name: '回环诀',
        category: 'prefix',
        tags: ['Material.Semantic.Manual'],
        weight: 44,
        energyCost: 7,
        rollScore: 1,
      },
    ]);

    const defenderSkill = AbilityFactory.create({
      slug: 'defender-skill',
      name: '守御术',
      type: AbilityType.ACTIVE_SKILL,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
    }) as ActiveSkill;

    attacker.abilities.addAbility(outcome.ability);
    defender.abilities.addAbility(defenderSkill);

    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
    });

    expect(defenderSkill.getCurrentCooldown()).toBeGreaterThan(0);
  });

  it('skill resource drain affix should heal caster after dealing damage', () => {
    const attacker = createUnit('attacker', '噬生修士');
    const defender = createUnit('defender', '受创木桩');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-suffix-life-siphon',
        name: '噬元回生',
        category: 'suffix',
        tags: ['Material.Semantic.Burst'],
        weight: 50,
        energyCost: 9,
        rollScore: 1,
      },
    ]);

    attacker.abilities.addAbility(outcome.ability);
    attacker.takeDamage(120);
    const beforeHp = attacker.getCurrentHp();

    EventBus.instance.publish<DamageTakenEvent>({
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
      damageTaken: 80,
      beforeHp: defender.getCurrentHp(),
      remainHp: Math.max(0, defender.getCurrentHp() - 80),
      isLethal: false,
    });

    expect(attacker.getCurrentHp()).toBeGreaterThan(beforeHp);
  });

  it('skill tag trigger affix should publish extra damage request for burned target on cast', () => {
    const attacker = createUnit('attacker', '引爆修士');
    const defender = createUnit('defender', '灼痕目标');
    const outcome = createSkillOutcome([
      {
        id: 'skill-core-damage',
        name: '斩击',
        category: 'core',
        tags: ['Material.Semantic.Blade'],
        weight: 80,
        energyCost: 8,
        rollScore: 1,
      },
      {
        id: 'skill-suffix-burn-detonate',
        name: '焰痕引爆',
        category: 'suffix',
        tags: ['Material.Semantic.Flame'],
        weight: 38,
        energyCost: 9,
        rollScore: 1,
      },
    ]);

    attacker.abilities.addAbility(outcome.ability);
    const burnBuff = new Buff('burn-mark' as never, '灼痕', BuffType.DEBUFF, 2);
    burnBuff.tags.addTags(['Status.Burn']);
    defender.buffs.addBuff(burnBuff);
    defender.tags.addTags(['Status.Burn']);
    let triggeredDamageEvent: DamageRequestEvent | undefined;
    const handler = (event: DamageRequestEvent) => {
      if (event.ability?.id === outcome.ability.id && event.target === defender) {
        triggeredDamageEvent = event;
      }
    };
    EventBus.instance.subscribe('DamageRequestEvent', handler);

    EventBus.instance.publish<SkillCastEvent>({
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: defender,
      ability: outcome.ability,
    });

    EventBus.instance.unsubscribe('DamageRequestEvent', handler);

    expect(triggeredDamageEvent).toBeDefined();
    expect(triggeredDamageEvent?.finalDamage).toBeGreaterThan(0);
  });
});