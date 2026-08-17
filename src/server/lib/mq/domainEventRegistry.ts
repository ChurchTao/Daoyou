import { closeNatsConnection, getNatsConnection } from '@server/lib/nats';
import { projectMailCreated } from '@server/lib/services/MailDomainEventProjector';
import { projectRealmChangedRanking } from '@server/lib/services/RealmChangedDomainEventProjector';
import {
  areNatsCoreSubscriptionsHealthy,
  stopNatsCoreSubscriptions,
} from '@server/lib/services/natsCorePubSub';
import { projectSectConstructionDonation } from '@server/lib/services/sect-organization/SectConstructionSettlementService';
import { projectTaskDomainEvent } from '@server/lib/services/TaskDomainEventProjector';
import { projectWorldRumorDomainEvent } from '@server/lib/services/WorldRumorDomainEventProjector';
import { processSponsorshipOrder } from '@server/lib/services/SponsorshipApplicationService';
import { db } from '@server/lib/drizzle/db';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository';
import {
  generateYieldRewardAttachments,
  projectYieldReward,
} from '@server/lib/services/YieldDomainEventProjector';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import {
  isBackgroundCommandConsumerHealthy,
  startBackgroundCommandConsumer,
  stopBackgroundCommandConsumer,
} from './backgroundCommandConsumer';
import {
  areDomainEventConsumersHealthy,
  startDomainEventConsumer,
  stopDomainEventConsumers,
} from './domainEventConsumer';
import { executeDomainEvent } from './DomainEventExecutor';
import { DOMAIN_EVENT_CONSUMERS, ensureMessageTopology } from './natsTopology';
import {
  startTransactionalMessageRelay,
  stopTransactionalMessageRelay,
} from './transactionalMessageRelay';
import {
  isBattleReplayArchiveConsumerHealthy,
  startBattleReplayArchiveConsumer,
  stopBattleReplayArchiveConsumer,
} from './battleReplayArchiveConsumer';
import {
  isBattleTerminalFinalizerConsumerHealthy,
  startBattleTerminalFinalizerConsumer,
  stopBattleTerminalFinalizerConsumer,
} from './battleTerminalFinalizerConsumer';
import {
  isBattleResolutionConsumerHealthy,
  startBattleResolutionConsumer,
  stopBattleResolutionConsumer,
} from './battleResolutionConsumer';

let registered = false;

export async function registerMessageInfrastructure(): Promise<void> {
  if (registered) return;

  await getNatsConnection();
  await ensureMessageTopology();
  await Promise.all([
    startBackgroundCommandConsumer(),
    startBattleReplayArchiveConsumer(),
    startBattleTerminalFinalizerConsumer(),
    startBattleResolutionConsumer(),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.sectFacilityProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.sectFacilityProjector.concurrency,
      acceptedTypes: ['sect.construction.donated'],
      handle: handleSectConstructionEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.taskProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.taskProjector.concurrency,
      acceptedTypes: [
        'alchemy.craft.completed',
        'ranking.challenge.completed',
        'dungeon.run.settled',
        'yield.claimed',
      ],
      handle: handleTaskEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.yieldRewardProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.yieldRewardProjector.concurrency,
      acceptedTypes: ['yield.claimed'],
      handle: handleYieldRewardEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.worldRumorProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.worldRumorProjector.concurrency,
      acceptedTypes: [
        'cultivator.realm.changed',
        'craft.item.created',
        'market.material.revealed',
        'bet-battle.created',
        'bet-battle.settled',
        'ranking.position.changed',
      ],
      handle: handleWorldRumorEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.rankingRealmProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.rankingRealmProjector.concurrency,
      acceptedTypes: ['cultivator.realm.changed'],
      handle: handleRankingRealmEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.mailNotificationProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.mailNotificationProjector.concurrency,
      acceptedTypes: ['mail.created'],
      handle: handleMailCreatedEvent,
    }),
    startDomainEventConsumer({
      consumerName: DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.name,
      concurrency: DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.concurrency,
      acceptedTypes: ['sponsorship.order.received'],
      handle: handleSponsorshipOrderEvent,
    }),
  ]);
  startTransactionalMessageRelay();
  registered = true;
}

async function handleSectConstructionEvent(event: DomainEventEnvelope) {
  if (!isDomainEventType(event, 'sect.construction.donated')) {
    throw new Error(`宗门设施投影不支持领域事件: ${event.type}`);
  }
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.sectFacilityProjector.name,
    source: 'sect_facility_domain_event',
    event,
    handle: projectSectConstructionDonation,
  });
}

async function handleTaskEvent(event: DomainEventEnvelope) {
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.taskProjector.name,
    source: 'task_domain_event',
    event,
    handle: projectTaskDomainEvent,
  });
}

async function handleYieldRewardEvent(event: DomainEventEnvelope) {
  if (!isDomainEventType(event, 'yield.claimed')) {
    throw new Error(`历练奖励投影不支持领域事件: ${event.type}`);
  }
  const attachments = await generateYieldRewardAttachments(event);
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.yieldRewardProjector.name,
    source: 'yield_reward_domain_event',
    event,
    handle: (message, tx) => projectYieldReward(message, attachments, tx),
  });
}

async function handleWorldRumorEvent(event: DomainEventEnvelope) {
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.worldRumorProjector.name,
    source: 'world_rumor_domain_event',
    event,
    handle: projectWorldRumorDomainEvent,
  });
}

async function handleRankingRealmEvent(event: DomainEventEnvelope) {
  if (!isDomainEventType(event, 'cultivator.realm.changed')) {
    throw new Error(`境界榜单投影不支持领域事件: ${event.type}`);
  }
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.rankingRealmProjector.name,
    source: 'ranking_realm_domain_event',
    event,
    handle: projectRealmChangedRanking,
  });
}

async function handleMailCreatedEvent(event: DomainEventEnvelope) {
  if (!isDomainEventType(event, 'mail.created')) {
    throw new Error(`邮件通知投影不支持领域事件: ${event.type}`);
  }
  await executeDomainEvent({
    consumerName: DOMAIN_EVENT_CONSUMERS.mailNotificationProjector.name,
    source: 'mail_notification_domain_event',
    event,
    handle: projectMailCreated,
  });
}

async function handleSponsorshipOrderEvent(event: DomainEventEnvelope) {
  if (!isDomainEventType(event, 'sponsorship.order.received')) {
    throw new Error(`功德订单投影不支持领域事件: ${event.type}`);
  }
  const alreadyProcessed = await db.query.messageConsumptions.findFirst({
    columns: { messageId: true },
    where: (rows, { and, eq }) =>
      and(
        eq(
          rows.consumerName,
          DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.name,
        ),
        eq(rows.messageId, event.id),
      ),
  });
  if (alreadyProcessed) return;
  await processSponsorshipOrder(event.data.orderId);
  await db.transaction(async (tx) => {
    await claimMessageForConsumer(
      {
        consumerName: DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.name,
        messageId: event.id,
        messageKey: event.type,
      },
      tx,
    );
  });
}

export async function shutdownMessageInfrastructure(): Promise<void> {
  if (!registered) return;
  registered = false;
  stopTransactionalMessageRelay();
  await stopBackgroundCommandConsumer();
  await stopBattleReplayArchiveConsumer();
  await stopBattleTerminalFinalizerConsumer();
  await stopBattleResolutionConsumer();
  await stopDomainEventConsumers();
  await stopNatsCoreSubscriptions();
  await closeNatsConnection();
}

export function getMessageInfrastructureHealthStatus(): 'up' | 'down' {
  return registered &&
    areDomainEventConsumersHealthy() &&
    isBackgroundCommandConsumerHealthy() &&
    isBattleReplayArchiveConsumerHealthy() &&
    isBattleTerminalFinalizerConsumerHealthy() &&
    isBattleResolutionConsumerHealthy() &&
    areNatsCoreSubscriptionsHealthy()
    ? 'up'
    : 'down';
}
