import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import { isAttributeResetTalismanScenario } from '@shared/config/attributeResetTalisman';
import { isSectMeridianResetTalismanScenario } from '@shared/config/sectMeridianResetTalisman';
import {
  RESOURCE_DATA_SCHEMAS,
  type ResourceChangeDescriptor,
  type ResourceDataMap,
} from '@shared/contracts/resources';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import { isTalismanConsumable } from '@shared/lib/consumables';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type {
  Consumable,
  CultivationProgress,
  Cultivator,
} from '@shared/types/cultivator';
import {
  qiCurrencyChange,
  qiCurrencyPatch,
  type QiSettlementBaseline,
} from './QiResourceChanges';

export function conditionChangesAfterConsumable(args: {
  consumable: Consumable;
  remainingConsumable: Consumable | null;
  taskSummary: ResourceDataMap['player.task-summary'];
  state: {
    condition: unknown;
    cultivationProgress: unknown;
    realm: RealmType;
    realmStage: RealmStage;
    spiritStones?: number;
    qi?: number;
    qiLastRefreshedAt?: Date | null;
    vitality?: number;
    strength?: number;
    spirit?: number;
    endurance?: number;
    speed?: number;
    willpower?: number;
    unallocatedAttributePoints?: number;
    lifespan?: number;
  };
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.tasks',
      eventType: 'tasks.maybe_changed',
      operation: 'invalidate',
    },
    {
      resourceTopic: 'player.task-summary',
      eventType: 'tasks.maybe_changed',
      operation: 'replace',
      payload: args.taskSummary,
    },
    args.remainingConsumable
      ? {
          resourceTopic: 'inventory.consumables',
          eventType: 'inventory.consumable.used',
          operation: 'upsert-items',
          payload: { idKey: 'id', items: [args.remainingConsumable] },
        }
      : {
          resourceTopic: 'inventory.consumables',
          eventType: 'inventory.consumable.used',
          operation: 'remove-items',
          payload: {
            idKey: 'id',
            ids: args.consumable.id ? [args.consumable.id] : [],
          },
        },
  ];
  if (
    isTalismanConsumable(args.consumable) &&
    isAttributeResetTalismanScenario(args.consumable.spec.scenario)
  ) {
    const attributes = {
      vitality: args.state.vitality,
      strength: args.state.strength,
      spirit: args.state.spirit,
      endurance: args.state.endurance,
      speed: args.state.speed,
      willpower: args.state.willpower,
    };
    if (Object.values(attributes).some((value) => typeof value !== 'number')) {
      throw new Error('洗髓符结算缺少权威属性值');
    }
    changes.push({
      resourceTopic: 'player.profile',
      eventType: 'profile.attributes.reset',
      payload: {
        cultivator: {
          attributes: {
            vitality: attributes.vitality!,
            strength: attributes.strength!,
            spirit: attributes.spirit!,
            endurance: attributes.endurance!,
            speed: attributes.speed!,
            willpower: attributes.willpower!,
          },
          unallocated_attribute_points: args.state.unallocatedAttributePoints,
        },
      },
      operation: 'merge',
    });
  } else if (
    isTalismanConsumable(args.consumable) &&
    isSectMeridianResetTalismanScenario(args.consumable.spec.scenario)
  ) {
    changes.push({
      resourceTopic: 'sect.progression',
      eventType: 'sect.meridian_nodes.reset',
      operation: 'invalidate',
    });
  } else if (isTalismanConsumable(args.consumable)) {
    if (typeof args.state.qi !== 'number' || !args.state.qiLastRefreshedAt) {
      throw new Error('聚灵符结算缺少权威灵气基线');
    }
    changes.push({
      resourceTopic: 'player.currency',
      eventType: 'currency.qi.changed',
      operation: 'merge',
      payload: {
        spiritStones: args.state.spiritStones,
        ...qiCurrencyPatch({
          qiAfter: args.state.qi,
          qiLastRefreshedAt: args.state.qiLastRefreshedAt.toISOString(),
        }),
      },
    });
  } else {
    changes.push(
      {
        resourceTopic: 'player.condition',
        eventType: 'condition.consumable.changed',
        operation: 'replace',
        payload: RESOURCE_DATA_SCHEMAS['player.condition'].parse(
          args.state.condition,
        ),
      },
      {
        resourceTopic: 'player.progress',
        eventType: 'progress.consumable.changed',
        operation: 'replace',
        payload: getOrInitCultivationProgress(
          (args.state.cultivationProgress ?? {}) as CultivationProgress,
          args.state.realm,
          args.state.realmStage,
        ),
      },
      {
        resourceTopic: 'player.profile',
        eventType: 'profile.consumable.changed',
        operation: 'merge',
        payload: {
          cultivator:
            typeof args.state.lifespan === 'number'
              ? { lifespan: args.state.lifespan }
              : {},
        },
      },
    );
  }
  return changes;
}

export function innRecoveryChanges(args: {
  condition: ResourceDataMap['player.condition'];
  spiritStones: number;
  progress: ResourceDataMap['player.progress'];
}): ResourceChangeDescriptor[] {
  return [
    {
      resourceTopic: 'player.condition',
      eventType: 'condition.recovered',
      operation: 'replace',
      payload: args.condition,
    },
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.spirit_stones.changed',
      operation: 'merge',
      payload: { spiritStones: args.spiritStones },
    },
    {
      resourceTopic: 'player.progress',
      eventType: 'progress.inn_recovery_adjusted',
      operation: 'replace',
      payload: args.progress,
    },
  ];
}

export function bodyBreakthroughChanges(args: {
  success: boolean;
  condition: ResourceDataMap['player.condition'];
  inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.condition',
      eventType: args.success
        ? 'condition.body_cultivation.breakthrough'
        : 'condition.body_cultivation.breakthrough_failed',
      operation: 'replace',
      payload: args.condition,
    },
  ];
  for (const inventoryChange of args.inventoryChanges) {
    changes.push(
      inventoryChange.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.body_cultivation.breakthrough_consumed',
            operation: 'upsert-items',
            payload: { idKey: 'id', items: [inventoryChange.item] },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${inventoryChange.kind}`,
            eventType: 'inventory.body_cultivation.breakthrough_consumed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [inventoryChange.id] },
          } as ResourceChangeDescriptor),
    );
  }
  return changes;
}

export function marrowWashBreakthroughChanges(args: {
  condition: ResourceDataMap['player.condition'];
  spiritualRoots: Cultivator['spiritual_roots'];
  qi: QiSettlementBaseline;
}): ResourceChangeDescriptor[] {
  return [
    {
      resourceTopic: 'player.condition',
      eventType: 'condition.marrow_wash.breakthrough',
      operation: 'replace',
      payload: args.condition,
    },
    {
      resourceTopic: 'player.profile',
      eventType: 'profile.spiritual_roots.marrow_wash_bonus',
      operation: 'merge',
      payload: { cultivator: { spiritual_roots: args.spiritualRoots } },
    },
    qiCurrencyChange('currency.qi.spent', args.qi),
  ];
}
