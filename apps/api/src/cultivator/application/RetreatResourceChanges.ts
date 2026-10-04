import type {
  ResourceChangeDescriptor,
  ResourceDataMap,
} from '@daoyou/contracts/resources';
import {
  qiCurrencyChange,
  type QiSettlementBaseline,
} from '@server/cultivator/application/QiResourceChanges.js';

export function retreatChanges(args: {
  profile: Pick<
    ResourceDataMap['player.profile']['cultivator'],
    'age' | 'closed_door_years_total'
  >;
  progress: ResourceDataMap['player.progress'];
  condition: ResourceDataMap['player.condition'];
  qi: QiSettlementBaseline;
  depleted: boolean;
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.profile',
      eventType: 'profile.retreat.changed',
      operation: 'merge',
      payload: { cultivator: args.profile },
    },
    {
      resourceTopic: 'player.progress',
      eventType: 'progress.cultivation.changed',
      operation: 'replace',
      payload: args.progress,
    },
    {
      resourceTopic: 'player.condition',
      eventType: 'condition.retreat.changed',
      operation: 'replace',
      payload: args.condition,
    },
    qiCurrencyChange('currency.qi.spent', args.qi),
  ];
  if (args.depleted) {
    changes.push({
      resourceTopic: 'player.session',
      eventType: 'session.active_cultivator_died',
      operation: 'replace',
      payload: { activeCultivator: null, note: '前世道途已尽' },
    });
  }
  return changes;
}

export function breakthroughChanges(args: {
  profile: Pick<
    ResourceDataMap['player.profile']['cultivator'],
    | 'realm'
    | 'realm_stage'
    | 'age'
    | 'lifespan'
    | 'attributes'
    | 'unallocated_attribute_points'
  >;
  condition: ResourceDataMap['player.condition'];
  progress: ResourceDataMap['player.progress'];
  qi: QiSettlementBaseline;
}): ResourceChangeDescriptor[] {
  return [
    {
      resourceTopic: 'player.profile',
      eventType: 'profile.breakthrough.changed',
      operation: 'merge',
      payload: { cultivator: args.profile },
    },
    {
      resourceTopic: 'player.condition',
      eventType: 'condition.breakthrough.changed',
      operation: 'replace',
      payload: args.condition,
    },
    {
      resourceTopic: 'player.progress',
      eventType: 'progress.breakthrough.changed',
      operation: 'replace',
      payload: args.progress,
    },
    qiCurrencyChange('currency.qi.spent', args.qi),
  ];
}
