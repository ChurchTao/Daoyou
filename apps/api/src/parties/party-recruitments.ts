import {
  PARTY_CAPACITY,
  PARTY_RECRUITMENT_LABELS,
  PARTY_RECRUITMENT_MINUTES,
  PartyRecruitmentIntentSchema,
  type PartyRecruitmentIntent,
  type PartyRecruitmentNotice,
} from '@daoyou/contracts/party';
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { redis } from '@server/lib/redis/index.js';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter.js';
import { insertChatMessage } from '@server/lib/repositories/chatRepository.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { partyOwns, readParty } from './party.service.js';

const ttl = PARTY_RECRUITMENT_MINUTES * 60_000;
const recruitmentKey = (id: string) => `party:recruitment:item:${id}`;
const indexKey = (intent: PartyRecruitmentIntent) =>
  `party:recruitment:list:${intent}`;
const intents = PartyRecruitmentIntentSchema.options;
const recruitmentSchema = z.object({
  id: z.uuid(),
  intent: PartyRecruitmentIntentSchema,
  expiresAt: z.number(),
});

function parseRecruitment(raw: string | null): PartyRecruitmentNotice | null {
  if (!raw) return null;
  const parsed = recruitmentSchema.safeParse(JSON.parse(raw));
  return parsed.success && parsed.data.expiresAt > Date.now()
    ? parsed.data
    : null;
}

export async function readPartyRecruitment(partyId: string) {
  return parseRecruitment(await redis.get(recruitmentKey(partyId)));
}

export async function listRecruitmentNotices(intent?: PartyRecruitmentIntent) {
  const now = Date.now();
  const groups = await Promise.all(
    (intent ? [intent] : intents).map((entry) =>
      redis.zrevrangebyscore(
        indexKey(entry),
        '+inf',
        `(${now}`,
        'LIMIT',
        0,
        50,
      ),
    ),
  );
  const partyIds = [...new Set(groups.flat())];
  if (!partyIds.length) return [];
  const records = await redis.mget(partyIds.map(recruitmentKey));
  return partyIds
    .flatMap((partyId, index) => {
      const notice = parseRecruitment(records[index] ?? null);
      return notice && (!intent || notice.intent === intent)
        ? [{ partyId, ...notice }]
        : [];
    })
    .sort((a, b) => b.expiresAt - a.expiresAt);
}

async function storeRecruitment(
  partyId: string,
  notice: PartyRecruitmentNotice,
) {
  await redis.eval(
    `
for i = 2, #KEYS do
  redis.call('ZREM', KEYS[i], ARGV[1])
end
redis.call('SET', KEYS[1], ARGV[2], 'PXAT', ARGV[3])
local index = KEYS[tonumber(ARGV[4])]
redis.call('ZREMRANGEBYSCORE', index, '-inf', ARGV[5])
redis.call('ZADD', index, ARGV[3], ARGV[1])
redis.call('PEXPIRE', index, ARGV[6])
`,
    1 + intents.length,
    recruitmentKey(partyId),
    ...intents.map(indexKey),
    partyId,
    JSON.stringify(notice),
    notice.expiresAt,
    intents.indexOf(notice.intent) + 2,
    Date.now(),
    ttl,
  );
}

async function clearRecruitment(partyId: string, noticeId?: string) {
  await redis.eval(
    `
if ARGV[2] ~= '' then
  local raw = redis.call('GET', KEYS[1])
  if not raw or cjson.decode(raw).id ~= ARGV[2] then return 0 end
end
redis.call('DEL', KEYS[1])
for i = 2, #KEYS do
  redis.call('ZREM', KEYS[i], ARGV[1])
end
return 1
`,
    1 + intents.length,
    recruitmentKey(partyId),
    ...intents.map(indexKey),
    partyId,
    noticeId ?? '',
  );
}

async function requireRecruitmentCaptain(
  actor: ActiveCultivatorRef,
  partyId: string,
  tx: DbTransaction,
) {
  const party = await readParty(partyId, tx, 'update');
  if (!party || party.leaderId !== actor.userId || !partyOwns(party, actor))
    throw new ForbiddenException('由队长管理招募');
  return party;
}

export async function publishPartyRecruitment(
  actor: ActiveCultivatorRef,
  partyId: string,
  intent: PartyRecruitmentIntent,
) {
  const id = randomUUID();
  let stored = false;
  try {
    const committed = await db.transaction(async (tx) => {
      const party = await requireRecruitmentCaptain(actor, partyId, tx);
      if (party.members.length >= PARTY_CAPACITY)
        throw new ConflictException('队伍已满');
      const leader = party.members.find(
        (member) => member.userId === actor.userId,
      )!;
      const cooldown = await checkAndAcquireCooldown(
        leader.cultivatorId,
        leader.realm,
      );
      if (!cooldown.allowed)
        throw new HttpException(
          `世界传音仍需等 ${cooldown.remainingSeconds} 秒`,
          HttpStatus.TOO_MANY_REQUESTS,
        );

      const text = `「${leader.name}」招募同行道友 · ${PARTY_RECRUITMENT_LABELS[intent]} · ${party.members.length}/${PARTY_CAPACITY} 人`;
      const message = await insertChatMessage(
        {
          id,
          senderUserId: actor.userId,
          senderCultivatorId: actor.cultivatorId,
          senderName: leader.name,
          senderRealm: leader.realm,
          senderRealmStage: leader.realmStage,
          channel: 'world',
          sectId: null,
          messageType: 'party_recruit',
          textContent: text,
          payload: { version: 1, partyId, recruitmentId: id, text },
        },
        tx,
      );
      await storeRecruitment(partyId, {
        id,
        intent,
        expiresAt: Date.now() + ttl,
      });
      stored = true;
      return message;
    });
    publishTransactionalMessageBestEffort(committed.outboxId, {
      context: 'world-chat',
      messageId: committed.message.id,
    });
  } catch (error) {
    if (stored) await clearRecruitment(partyId, id).catch(() => undefined);
    throw error;
  }
}

export async function stopPartyRecruitment(
  actor: ActiveCultivatorRef,
  partyId: string,
) {
  await db.transaction(async (tx) => {
    await requireRecruitmentCaptain(actor, partyId, tx);
    await clearRecruitment(partyId);
  });
}
