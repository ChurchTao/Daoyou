import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@daoyou/shared/contracts/domainEvents';
import { projectCombatV6Condition } from '@server/combat/application/CombatV6ConditionProjector.js';
import type { CombatV6TrainingSessionService } from '@server/combat/application/CombatV6TrainingSessionService.js';
import {
  generateYieldRewardAttachments,
  projectYieldReward,
} from '@server/cultivator/application/YieldDomainEventProjector.js';
import { projectHuntReward } from '@server/hunts/application/HuntRewardProjector.js';
import { db } from '@server/lib/drizzle/db.js';
import {
  areDomainEventConsumersHealthy,
  startDomainEventConsumer,
  stopDomainEventConsumers,
} from '@server/lib/mq/domainEventConsumer.js';
import {
  DOMAIN_EVENT_CONSUMERS,
  ensureMessageTopology,
} from '@server/lib/mq/natsTopology.js';
import {
  startTransactionalMessageRelay,
  stopTransactionalMessageRelay,
} from '@server/lib/mq/transactionalMessageRelay.js';
import { closeNatsConnection, getNatsConnection } from '@server/lib/nats/index.js';
import { claimMessageForConsumer } from '@server/lib/repositories/messageConsumptionRepository.js';
import { projectMailCreated } from '@server/mail/application/MailDomainEventProjector.js';
import { projectSystemMailAudience } from '@server/mail/application/SystemMailService.js';
import { executeDomainEvent } from '@server/player/application/state/DomainEventExecutor.js';
import {
  areNatsCoreSubscriptionsHealthy,
  stopNatsCoreSubscriptions,
} from '@server/realtime/infrastructure/natsCorePubSub.js';
import {
  isBackgroundCommandConsumerHealthy,
  startBackgroundCommandConsumer,
  stopBackgroundCommandConsumer,
} from '@server/runtime/messaging/backgroundCommandConsumer.js';
import {
  isCombatV6MessagingHealthy,
  startCombatV6Messaging,
  stopCombatV6Messaging,
} from '@server/runtime/messaging/combatV6Messaging.js';
import { projectSectConstructionDonation } from '@server/sects/organization/SectConstructionSettlementService.js';
import { projectWorldRumorDomainEvent } from '@server/social/application/WorldRumorDomainEventProjector.js';
import { processSponsorshipOrder } from '@server/sponsorship/application/SponsorshipApplicationService.js';
import { projectRealmChangedRanking } from '@server/story/application/RealmChangedDomainEventProjector.js';
import { projectStoryDomainEvent } from '@server/story/application/StoryDomainEventProjector.js';
import { projectTaskDomainEvent } from '@server/tasks/application/TaskDomainEventProjector.js';

let registered = false;

export async function registerMessageInfrastructure(
  training: CombatV6TrainingSessionService,
): Promise<void> {
  if (registered) return;
  try {
    await getNatsConnection();
    await ensureMessageTopology();
    const starts = await Promise.allSettled([
      startBackgroundCommandConsumer(),
      startDomainEventConsumer({
        consumerName: DOMAIN_EVENT_CONSUMERS.systemMailProjector.name,
        concurrency: DOMAIN_EVENT_CONSUMERS.systemMailProjector.concurrency,
        acceptedTypes: ['cultivator.mail-audience.observed'],
        handle: async (event) => {
          if (!isDomainEventType(event, 'cultivator.mail-audience.observed'))
            throw new Error('系统邮件事件类型错误');
          await executeDomainEvent({
            consumerName: DOMAIN_EVENT_CONSUMERS.systemMailProjector.name,
            source: 'system_mail_audience',
            event,
            handle: projectSystemMailAudience,
          });
        },
      }),
      startCombatV6Messaging(training),
      startDomainEventConsumer({
        consumerName: DOMAIN_EVENT_CONSUMERS.combatV6Condition.name,
        concurrency: DOMAIN_EVENT_CONSUMERS.combatV6Condition.concurrency,
        acceptedTypes: ['combat.v6.battle.finished'],
        handle: async (event) => {
          if (event.type === 'combat.v6.battle.finished') {
            const data = (
              event as DomainEventEnvelope<'combat.v6.battle.finished'>
            ).data;
            if (data.sourceType === 'hunt') {
              await projectHuntReward(data.battleId);
            } else if (data.sourceType !== 'arena-sparring') {
              await projectCombatV6Condition(data.battleId);
            }
          }
        },
      }),
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
          'equipment.forged',
          'market.material.revealed',
          'ranking.position.changed',
          'beast.exceptional.acquired',
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
        concurrency:
          DOMAIN_EVENT_CONSUMERS.mailNotificationProjector.concurrency,
        acceptedTypes: ['mail.created'],
        handle: handleMailCreatedEvent,
      }),
      startDomainEventConsumer({
        consumerName: DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.name,
        concurrency:
          DOMAIN_EVENT_CONSUMERS.sponsorshipOrderProjector.concurrency,
        acceptedTypes: ['sponsorship.order.received'],
        handle: handleSponsorshipOrderEvent,
      }),
    ]);
    const failures = starts.filter((result) => result.status === 'rejected');
    if (failures.length) {
      throw new AggregateError(
        failures.map((result) => result.reason),
        'Message infrastructure startup failed',
      );
    }
    startTransactionalMessageRelay();
    registered = true;
  } catch (error) {
    await shutdownMessageInfrastructure();
    throw error;
  }
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
    handle: async (event, tx) => {
      const task = await projectTaskDomainEvent(event, tx);
      const story = await projectStoryDomainEvent(event, tx);
      return {
        result: task.result,
        resourceChanges: [...task.resourceChanges, ...story.resourceChanges],
      };
    },
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
  // A failed bootstrap may have opened consumers before registration completed.
  registered = false;
  await stopTransactionalMessageRelay();
  await stopBackgroundCommandConsumer();
  await stopCombatV6Messaging();
  await stopDomainEventConsumers();
  await stopNatsCoreSubscriptions();
  await closeNatsConnection();
}

export function getMessageInfrastructureHealthStatus(): 'up' | 'down' {
  return registered &&
    areDomainEventConsumersHealthy() &&
    isBackgroundCommandConsumerHealthy() &&
    isCombatV6MessagingHealthy() &&
    areNatsCoreSubscriptionsHealthy()
    ? 'up'
    : 'down';
}
