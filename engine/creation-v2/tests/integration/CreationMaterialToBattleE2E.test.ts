import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import {
  CraftFailedEvent,
  MaterialSubmittedEvent,
  OutcomeMaterializedEvent,
} from '@/engine/creation-v2/core/events';
import { CreationEventPriorityLevel } from '@/engine/creation-v2/core/types';
import {
  AbilityType,
  AttributeType,
} from '@/engine/creation-v2/contracts/battle';
import {
  DamageTakenEvent,
  EventBus,
  RoundPreEvent,
  SkillCastEvent,
  Unit,
} from '@/engine/creation-v2/contracts/battle-testkit';

describe('Creation material-to-outcome E2E observability', () => {
  beforeEach(() => {
    EventBus.instance.reset();
  });

  afterEach(() => {
    EventBus.instance.reset();
  });

  function createUnit(id: string, name: string): Unit {
    return new Unit(id, name, {
      [AttributeType.SPIRIT]: 120,
      [AttributeType.VITALITY]: 120,
      [AttributeType.SPEED]: 120,
      [AttributeType.WILLPOWER]: 120,
      [AttributeType.WISDOM]: 120,
    });
  }

  it('应从输入材料端到端生成产物，并可在 battle-v5 正确装配与触发', async () => {
    const orchestrator = new CreationOrchestrator();
    const observable: Array<
      | { stage: 'input'; materialIds: string[]; productType: string }
      | { stage: 'output'; abilityId: string; abilityType: string; outcomeName: string }
    > = [];

    orchestrator.eventBus.subscribe<MaterialSubmittedEvent>(
      'MaterialSubmittedEvent',
      (event) => {
        const materialIds = event.input.materials
          .map((material) => material.id)
          .filter((id): id is string => Boolean(id));

        observable.push({
          stage: 'input',
          materialIds,
          productType: event.input.productType,
        });
      },
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );

    orchestrator.eventBus.subscribe<OutcomeMaterializedEvent>(
      'OutcomeMaterializedEvent',
      (event) => {
        observable.push({
          stage: 'output',
          abilityId: event.outcome.ability.id,
          abilityType: event.outcome.ability.type,
          outcomeName: event.outcome.blueprint.productModel.name,
        });
      },
      CreationEventPriorityLevel.MATERIALIZATION,
    );

    const session = await orchestrator.craftSync({
      sessionId: 'material-to-battle-e2e',
      productType: 'skill',
      materials: [
        {
          id: 'mat-fire-ore',
          name: '赤炎精铁',
          type: 'ore',
          rank: '灵品',
          quantity: 2,
          element: '火',
          description: '蕴含火行意象与锋锐之气',
        },
      ],
      requestedTags: ['Material.Semantic.Flame'],
    });

    expect(session.state.phase).toBe('outcome_materialized');
    expect(session.state.outcome).toBeDefined();
    expect(observable[0]).toMatchObject({
      stage: 'input',
      materialIds: ['mat-fire-ore'],
      productType: 'skill',
    });

    console.log('outcome:', JSON.stringify(session.state.outcome?.blueprint));

    const outputObservation = observable.find((item) => item.stage === 'output');
    expect(outputObservation).toBeDefined();

    const outcome = session.state.outcome!;
    expect(outcome.ability.type).toBe(AbilityType.ACTIVE_SKILL);
    expect(outcome.blueprint.productModel.name).toBeTruthy();

    const caster = createUnit('caster', '铸技修士');
    const target = createUnit('target', '试炼木桩');

    caster.abilities.addAbility(outcome.ability);

    expect(caster.abilities.getAbility(outcome.ability.id)).toBe(outcome.ability);
    expect(outcome.ability.getOwner()).toBe(caster);
    expect(outcome.ability.isActive()).toBe(true);

    const castEvent: SkillCastEvent = {
      type: 'SkillCastEvent',
      timestamp: Date.now(),
      caster,
      target,
      ability: outcome.ability,
    };

    expect(() => EventBus.instance.publish(castEvent)).not.toThrow();
  });

  it('应观测到材料冲突失败链路，并且不会产出可装配 outcome', async () => {
    const orchestrator = new CreationOrchestrator();
    const observable: Array<
      | { stage: 'input'; materialIds: string[] }
      | { stage: 'failed'; reason: string; phase: string }
    > = [];

    orchestrator.eventBus.subscribe<MaterialSubmittedEvent>(
      'MaterialSubmittedEvent',
      (event) => {
        const materialIds = event.input.materials
          .map((material) => material.id)
          .filter((id): id is string => Boolean(id));

        observable.push({ stage: 'input', materialIds });
      },
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );

    orchestrator.eventBus.subscribe<CraftFailedEvent>(
      'CraftFailedEvent',
      (event) => {
        observable.push({
          stage: 'failed',
          reason: event.reason,
          phase: event.phase,
        });
      },
      CreationEventPriorityLevel.AUDIT,
    );

    const session = await orchestrator.craftSync({
      sessionId: 'material-to-battle-e2e-failed',
      productType: 'skill',
      materials: [
        {
          id: 'mat-fire',
          name: '赤炎晶簇',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '火',
          description: '烈焰躁动',
        },
        {
          id: 'mat-ice',
          name: '玄霜寒铁',
          type: 'ore',
          rank: '灵品',
          quantity: 1,
          element: '冰',
          description: '寒意凝结',
        },
      ],
    });

    expect(session.state.phase).toBe('failed');
    expect(session.state.outcome).toBeUndefined();
    expect(observable[0]).toMatchObject({
      stage: 'input',
      materialIds: ['mat-fire', 'mat-ice'],
    });
    expect(observable.find((item) => item.stage === 'failed')).toBeDefined();
  });

  it('应从 artifact 材料生成被动产物并可在 battle-v5 装配触发', async () => {
    const orchestrator = new CreationOrchestrator();
    const session = await orchestrator.craftSync({
      sessionId: 'material-to-battle-e2e-artifact',
      productType: 'artifact',
      materials: [
        {
          id: 'mat-guard-ore',
          name: '玄铁矿',
          type: 'ore',
          rank: '真品',
          quantity: 1,
          element: '金',
          description: '厚重坚固，偏向护体',
        },
      ],
      requestedTags: ['Material.Semantic.Guard'],
    });

    expect(session.state.phase).toBe('outcome_materialized');

    const outcome = session.state.outcome!;
    expect(outcome.ability.type).toBe(AbilityType.PASSIVE_SKILL);

    const owner = createUnit('artifact-owner', '护体修士');
    owner.abilities.addAbility(outcome.ability);

    expect(owner.abilities.getAbility(outcome.ability.id)).toBe(outcome.ability);
    expect(outcome.ability.getOwner()).toBe(owner);

    const roundPreEvent: RoundPreEvent = {
      type: 'RoundPreEvent',
      timestamp: Date.now(),
      turn: 1,
    };

    expect(() => EventBus.instance.publish(roundPreEvent)).not.toThrow();
  });

  it('应从 gongfa 材料生成被动产物并可在 battle-v5 装配触发', async () => {
    const orchestrator = new CreationOrchestrator();
    const session = await orchestrator.craftSync({
      sessionId: 'material-to-battle-e2e-gongfa',
      productType: 'gongfa',
      materials: [
        {
          id: 'mat-manual',
          name: '悟道竹简',
          type: 'gongfa_manual',
          rank: '真品',
          quantity: 1,
          description: '蕴含心法奥义',
        },
      ],
      requestedTags: ['Material.Semantic.Manual'],
    });

    expect(session.state.phase).toBe('outcome_materialized');

    const outcome = session.state.outcome!;
    expect(outcome.ability.type).toBe(AbilityType.PASSIVE_SKILL);

    const owner = createUnit('gongfa-owner', '守神修士');
    const attacker = createUnit('gongfa-attacker', '试炼敌手');
    owner.abilities.addAbility(outcome.ability);

    expect(owner.abilities.getAbility(outcome.ability.id)).toBe(outcome.ability);
    expect(outcome.ability.getOwner()).toBe(owner);

    const damageTakenEvent: DamageTakenEvent = {
      type: 'DamageTakenEvent',
      timestamp: Date.now(),
      caster: attacker,
      target: owner,
      damageTaken: 30,
      beforeHp: owner.getCurrentHp(),
      remainHp: Math.max(0, owner.getCurrentHp() - 30),
      isLethal: false,
    };

    expect(() => EventBus.instance.publish(damageTakenEvent)).not.toThrow();
  });
});
