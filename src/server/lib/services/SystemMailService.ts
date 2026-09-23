import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  mails,
  sponsorshipMeritProfiles,
  systemMailCampaigns,
} from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { redis } from '@server/lib/redis';
import {
  materializeRewardAttachments,
  rewardAttachments,
} from '@shared/contracts/adminRewards';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import {
  isSystemMailInWindow,
  matchesSystemMailConditions,
  SystemMailAudienceSnapshotSchema,
  SystemMailConditionsSchema,
} from '@shared/contracts/systemMail';
import { and, asc, eq, gt, lte, notExists, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { MailService } from './MailService';

// A short lease suppresses concurrent connections; only committed observations
// advance the cooldown. Failure leaves the next heartbeat free to retry.
const ACQUIRE = `
local last = tonumber(redis.call('get', KEYS[1]) or '0')
if tonumber(ARGV[1]) - last < tonumber(ARGV[2]) then return 0 end
if not redis.call('set', KEYS[2], ARGV[3], 'PX', 30000, 'NX') then return 0 end
return 1`;
const FINISH = `
if redis.call('get', KEYS[2]) == ARGV[1] then
  if ARGV[2] ~= '' then redis.call('set', KEYS[1], ARGV[2], 'EX', 600) end
  redis.call('del', KEYS[2])
end`;

export async function observeSystemMailAudience(
  cultivatorId: string,
  source: 'connection' | 'heartbeat' | 'mailbox',
): Promise<void> {
  const key = `system-mail:observation:${cultivatorId}`;
  const lease = randomUUID();
  const now = Date.now();
  const acquired = await redis.eval(
    ACQUIRE,
    2,
    key,
    `${key}:lease`,
    String(now),
    String(source === 'heartbeat' ? 300000 : 15000),
    lease,
  );
  if (Number(acquired) !== 1) return;
  let committed = false;
  try {
    const event = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({
          id: cultivators.id,
          createdAt: cultivators.createdAt,
          realm: cultivators.realm,
          stage: cultivators.realm_stage,
          highestTier: sponsorshipMeritProfiles.highestTier,
        })
        .from(cultivators)
        .leftJoin(
          sponsorshipMeritProfiles,
          eq(sponsorshipMeritProfiles.cultivatorId, cultivators.id),
        )
        .where(
          and(
            eq(cultivators.id, cultivatorId),
            eq(cultivators.status, 'active'),
          ),
        )
        .limit(1);
      if (!row) return null;
      const data = SystemMailAudienceSnapshotSchema.parse({
        cultivatorId: row.id,
        createdAt: row.createdAt!.toISOString(),
        realm: { realm: row.realm, stage: row.stage },
        highestSponsorshipTier: row.highestTier,
        checkedAt: new Date().toISOString(),
      });
      return createDomainEvent(
        {
          type: 'cultivator.mail-audience.observed',
          aggregate: { type: 'cultivator', id: cultivatorId },
          data,
        },
        tx,
      );
    });
    committed = true;
    if (event)
      publishTransactionalMessageBestEffort(event.id, {
        source: 'system_mail_observation',
        cultivatorId,
      });
  } finally {
    await redis.eval(
      FINISH,
      2,
      key,
      `${key}:lease`,
      lease,
      committed ? String(now) : '',
    );
  }
}

export function scheduleSystemMailObservation(
  cultivatorId: string,
  source: 'connection' | 'heartbeat' | 'mailbox',
): void {
  void observeSystemMailAudience(cultivatorId, source).catch((error) => {
    console.warn(
      '[system-mail] observation enqueue failed; next activity will retry',
      { cultivatorId, source, error },
    );
  });
}

export async function projectSystemMailAudience(
  event: DomainEventEnvelope<'cultivator.mail-audience.observed'>,
  tx: DbTransaction,
) {
  const facts = event.data;
  const checkedAt = new Date(facts.checkedAt);
  // Character removal/status changes cannot race a delivery transaction.
  const [actor] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, facts.cultivatorId),
        eq(cultivators.status, 'active'),
      ),
    )
    .for('share');
  if (!actor) return { result: { delivered: 0 }, resourceChanges: [] };
  let cursor: string | undefined;
  let delivered = 0;
  while (true) {
    const campaigns = await tx
      .select()
      .from(systemMailCampaigns)
      .where(
        and(
          eq(systemMailCampaigns.status, 'published'),
          lte(systemMailCampaigns.publishedAt, checkedAt),
          lte(systemMailCampaigns.startsAt, checkedAt),
          gt(systemMailCampaigns.endsAt, checkedAt),
          cursor ? gt(systemMailCampaigns.id, cursor) : undefined,
          notExists(
            tx
              .select({ one: sql`1` })
              .from(mails)
              .where(
                and(
                  eq(mails.systemMailCampaignId, systemMailCampaigns.id),
                  eq(mails.cultivatorId, facts.cultivatorId),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(systemMailCampaigns.id))
      .limit(100)
      .for('share');
    for (const campaign of campaigns) {
      if (
        !isSystemMailInWindow(
          {
            publishedAt: campaign.publishedAt!.toISOString(),
            startsAt: campaign.startsAt.toISOString(),
            endsAt: campaign.endsAt.toISOString(),
          },
          facts.checkedAt,
        )
      )
        continue;
      if (
        !matchesSystemMailConditions(
          SystemMailConditionsSchema.parse(campaign.conditions),
          facts,
          campaign.publishedAt!.toISOString(),
        )
      )
        continue;
      if (
        await MailService.sendCampaignRewardMail(
          {
            campaignId: campaign.id,
            cultivatorId: facts.cultivatorId,
            title: campaign.title,
            content: campaign.content,
            attachments: materializeRewardAttachments(
              rewardAttachments(campaign.rewardSelections),
              randomUUID,
            ),
          },
          tx,
        )
      )
        delivered += 1;
    }
    if (campaigns.length < 100) break;
    cursor = campaigns.at(-1)!.id;
  }
  return { result: { delivered }, resourceChanges: [] };
}
