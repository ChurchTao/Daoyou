import type {
  MentorshipMutation,
  MentorshipOverview,
  MentorshipProfileInput,
  MentorshipProfileView,
  MentorshipRelationView,
  MentorshipRequestInput,
} from '@daoyou/contracts/mentorship';
import type { PlayerResourceMutationMeta } from '@daoyou/contracts/player';
import type { ResourceChange } from '@daoyou/contracts/resources';
import { MENTORSHIP_CONFIG } from '@daoyou/game-content/mentorship';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import {
  apprenticeshipBlockReason,
  canMentor,
} from '@daoyou/game-rules/mentorship';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { syncMentorshipAchievements } from '@server/achievements/achievement-ledger.js';
import { updateReputation } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type {
  DbClient,
  DbExecutor,
  DbTransaction,
} from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';
import {
  findPlayerMutationRequest,
  insertPlayerMutationRequest,
} from '@server/lib/repositories/playerStateRepository.js';
import { findActiveSectMembership } from '@server/lib/repositories/sectCombatRepository.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { publishResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { queueAchievementRumor } from '@server/social/application/achievementRumor.js';
import { areFriends } from '@server/social/application/FriendService.js';
import {
  assertSocialAccountsAvailable,
  assertSocialContactAllowed,
  ensureFriendPairInTransaction,
  lockSocialAccounts,
} from '@server/social/application/SocialTransaction.js';
import { textFilter } from '@server/social/application/textFilter.js';
import { enqueueSocialNotification } from '@server/social/social-notifications.js';
import { and, desc, eq, gt, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { readMentorshipGraduation } from './application/MentorshipQueries.js';

type Actor = { userId: string; cultivatorId: string };
type Relation = typeof schema.mentorshipRelations.$inferSelect;
type Profile = typeof schema.mentorshipProfiles.$inferSelect;
type RelationMutationResult = {
  success: true;
  data?: { rewards: { mentor: number; disciple: number } };
  state?: PlayerResourceMutationMeta;
  broadcastChanges?: ResourceChange[];
};
const success = { success: true } as const;
const fail = (message: string, status = 409): never => {
  throw new HttpException({ error: message }, status);
};
const identity = (
  row: typeof schema.cultivators.$inferSelect | undefined,
  id: string | null,
  name: string,
) => ({
  id,
  name: row?.name ?? name,
  ...(row
    ? { realm: row.realm, realmStage: row.realm_stage, status: row.status }
    : {}),
});
const profileView = (row: Profile): MentorshipProfileView => ({
  open: row.open,
  directions: row.directions,
  availableTimes: row.availableTimes,
  introduction: row.introduction,
  revision: row.revision,
});

@Injectable()
export class MentorshipService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  private async ensureAccount(tx: DbTransaction, userId: string) {
    await tx
      .insert(schema.mentorshipAccountStates)
      .values({ userId })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(schema.mentorshipAccountStates)
      .where(eq(schema.mentorshipAccountStates.userId, userId))
      .for('update');
    return row!;
  }

  private async requireActor(q: DbExecutor, actor: Actor) {
    const row = await q.query.cultivators.findFirst({
      where: and(
        eq(schema.cultivators.id, actor.cultivatorId),
        eq(schema.cultivators.userId, actor.userId),
      ),
    });
    if (!row || row.status !== 'active')
      return fail('当前角色已无法进行师徒操作');
    return row;
  }

  private async notify(
    tx: DbTransaction,
    relation: Pick<
      Relation,
      | 'mentorUserId'
      | 'discipleUserId'
      | 'mentorCultivatorId'
      | 'discipleCultivatorId'
    >,
  ) {
    await enqueueSocialNotification(tx, relation.mentorUserId, {
      cultivatorId: relation.mentorCultivatorId,
      kind: 'mentorship',
    });
    await enqueueSocialNotification(tx, relation.discipleUserId, {
      cultivatorId: relation.discipleCultivatorId,
      kind: 'mentorship',
    });
  }

  private async mutate<T, TInput extends { requestId: string }>(
    actor: Actor,
    source: string,
    input: TInput,
    participants: Actor[],
    run: (tx: DbTransaction) => Promise<T>,
  ): Promise<T> {
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    return this.database.transaction(async (tx) => {
      await lockSocialAccounts(tx, [
        actor.userId,
        ...participants.map((participant) => participant.userId),
      ]);
      await assertSocialAccountsAvailable(tx, [
        actor.userId,
        ...participants.map((participant) => participant.userId),
      ]);
      const ids = [
        ...new Set([
          actor.cultivatorId,
          ...participants.map((participant) => participant.cultivatorId),
        ]),
      ].sort();
      await tx
        .select({ id: schema.cultivators.id })
        .from(schema.cultivators)
        .where(inArray(schema.cultivators.id, ids))
        .orderBy(schema.cultivators.id)
        .for('no key update');
      await this.requireActor(tx, actor);
      const previous = await findPlayerMutationRequest(
        actor.cultivatorId,
        source,
        input.requestId,
        tx,
      );
      if (previous) {
        if (previous.requestFingerprint !== fingerprint)
          return fail('请求标识已用于不同的操作内容');
        return previous.result as T;
      }
      const result = await run(tx);
      await insertPlayerMutationRequest(
        {
          cultivatorId: actor.cultivatorId,
          source,
          requestId: input.requestId,
          requestFingerprint: fingerprint,
          result,
        },
        tx,
      );
      return result;
    });
  }

  private async admission(tx: DbTransaction, mentor: Actor, disciple: Actor) {
    await assertSocialContactAllowed(tx, mentor.userId, disciple.userId);
    const teacher = await this.requireActor(tx, mentor);
    const student = await this.requireActor(tx, disciple);
    if (!canMentor(teacher.realm)) return fail('化神及以上道友才可收徒');
    const state = await this.ensureAccount(tx, disciple.userId);
    const reason = apprenticeshipBlockReason(student.realm, state.firstBoundAt);
    if (reason) return fail(reason);
    const relations = await tx
      .select()
      .from(schema.mentorshipRelations)
      .where(
        and(
          eq(schema.mentorshipRelations.mentorUserId, mentor.userId),
          eq(schema.mentorshipRelations.status, 'active'),
        ),
      );
    const seat = [1, 2].find(
      (candidate) =>
        !relations.some((relation) => relation.mentorSeat === candidate),
    );
    if (!seat) return fail('这位师父的两名在授名额已满');
    return { teacher, student, seat };
  }

  async overview(actor: Actor): Promise<MentorshipOverview> {
    const current = await this.requireActor(this.database, actor);
    const account = await this.database.query.mentorshipAccountStates.findFirst(
      { where: eq(schema.mentorshipAccountStates.userId, actor.userId) },
    );
    const profile = await this.database.query.mentorshipProfiles.findFirst({
      where: eq(schema.mentorshipProfiles.userId, actor.userId),
    });
    const participant = or(
      eq(schema.mentorshipRelations.mentorUserId, actor.userId),
      eq(schema.mentorshipRelations.discipleUserId, actor.userId),
    );
    const active = await this.database
      .select()
      .from(schema.mentorshipRelations)
      .where(and(participant, eq(schema.mentorshipRelations.status, 'active')))
      .orderBy(desc(schema.mentorshipRelations.startedAt));
    const history = await this.database
      .select()
      .from(schema.mentorshipRelations)
      .where(
        and(participant, eq(schema.mentorshipRelations.status, 'graduated')),
      )
      .orderBy(desc(schema.mentorshipRelations.startedAt))
      .limit(50);
    const relationViews: MentorshipRelationView[] = [];
    const relations = new Map(
      [...active, ...history].map((relation) => [relation.id, relation]),
    );
    for (const relation of relations.values())
      relationViews.push(await this.relationView(relation, actor));
    const requestParticipant = or(
      eq(schema.mentorshipRequests.mentorUserId, actor.userId),
      eq(schema.mentorshipRequests.discipleUserId, actor.userId),
    );
    const now = new Date();
    const pending = await this.database
      .select()
      .from(schema.mentorshipRequests)
      .where(
        and(
          requestParticipant,
          eq(schema.mentorshipRequests.status, 'pending'),
          gt(schema.mentorshipRequests.expiresAt, now),
        ),
      )
      .orderBy(desc(schema.mentorshipRequests.createdAt));
    const requestHistory = await this.database
      .select()
      .from(schema.mentorshipRequests)
      .where(
        and(
          requestParticipant,
          or(
            ne(schema.mentorshipRequests.status, 'pending'),
            lte(schema.mentorshipRequests.expiresAt, now),
          ),
        ),
      )
      .orderBy(desc(schema.mentorshipRequests.createdAt))
      .limit(50);
    const requests = new Map(
      [...pending, ...requestHistory].map((request) => [request.id, request]),
    );
    const requestViews = [];
    for (const request of requests.values()) {
      const mentor = await this.database.query.cultivators.findFirst({
        where: eq(schema.cultivators.id, request.mentorCultivatorId),
      });
      const disciple = await this.database.query.cultivators.findFirst({
        where: eq(schema.cultivators.id, request.discipleCultivatorId),
      });
      requestViews.push({
        id: request.id,
        status:
          request.status === 'pending' && request.expiresAt <= new Date()
            ? ('expired' as const)
            : request.status,
        revision: request.revision,
        incoming: request.initiatorUserId !== actor.userId,
        mentor: identity(mentor, mentor?.id ?? null, '已离去的道友'),
        disciple: identity(disciple, disciple?.id ?? null, '已离去的道友'),
        expiresAt: request.expiresAt.toISOString(),
        createdAt: request.createdAt.toISOString(),
      });
    }
    const graduation = await readMentorshipGraduation(
      actor.cultivatorId,
      this.database,
    );
    const reason = apprenticeshipBlockReason(
      current.realm,
      account?.firstBoundAt ?? null,
    );
    const [graduates] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mentorshipRelations)
      .where(
        and(
          eq(
            schema.mentorshipRelations.mentorOriginalCultivatorId,
            actor.cultivatorId,
          ),
          eq(schema.mentorshipRelations.status, 'graduated'),
        ),
      );
    return {
      actor: identity(current, current.id, current.name),
      eligibility: {
        canMentor: canMentor(current.realm),
        canApprentice: reason === null,
        reasons: reason ? [reason] : [],
        permanentlyBound: !!account?.firstBoundAt,
      },
      profile: profile ? profileView(profile) : null,
      relations: relationViews,
      requests: requestViews,
      graduation,
      honor: {
        graduatedDisciples: graduates?.count ?? 0,
      },
    };
  }

  private async pauseReason(
    relation: Relation,
    q: DbExecutor,
  ): Promise<string | null> {
    if (!relation.mentorCultivatorId || !relation.discipleCultivatorId)
      return '原角色已离去';
    const rows = await q
      .select({ id: schema.cultivators.id, status: schema.cultivators.status })
      .from(schema.cultivators)
      .where(
        inArray(schema.cultivators.id, [
          relation.mentorCultivatorId,
          relation.discipleCultivatorId,
        ]),
      );
    if (rows.length !== 2 || rows.some((row) => row.status !== 'active'))
      return '原角色已离去或正在转服';
    try {
      await assertSocialContactAllowed(
        q,
        relation.mentorUserId,
        relation.discipleUserId,
      );
    } catch (error) {
      if (error instanceof HttpException) return '当前无法联系该道友';
      throw error;
    }
    if (
      !(await areFriends(
        relation.mentorCultivatorId,
        relation.discipleCultivatorId,
        q,
      ))
    )
      return '好友关系已解除，暂无法私聊';
    return null;
  }

  private async relationView(
    relation: Relation,
    actor: Actor,
  ): Promise<MentorshipRelationView> {
    const mentor = relation.mentorCultivatorId
      ? await this.database.query.cultivators.findFirst({
          where: eq(schema.cultivators.id, relation.mentorCultivatorId),
        })
      : undefined;
    const disciple = relation.discipleCultivatorId
      ? await this.database.query.cultivators.findFirst({
          where: eq(schema.cultivators.id, relation.discipleCultivatorId),
        })
      : undefined;
    const reason =
      relation.status === 'active'
        ? await this.pauseReason(relation, this.database)
        : null;
    return {
      id: relation.id,
      status: relation.status,
      revision: relation.revision,
      role: relation.mentorUserId === actor.userId ? 'mentor' : 'disciple',
      mentor: identity(
        mentor,
        relation.mentorCultivatorId,
        relation.mentorName,
      ),
      disciple: identity(
        disciple,
        relation.discipleCultivatorId,
        relation.discipleName,
      ),
      paused: reason !== null,
      pauseReason: reason,
      startedAt: relation.startedAt.toISOString(),
      endedAt: relation.endedAt?.toISOString() ?? null,
      endReason: relation.endReason,
      graduationRewardedAt:
        relation.graduationRewardedAt?.toISOString() ?? null,
      mentorReputationReward: relation.mentorReputationReward,
      discipleReputationReward: relation.discipleReputationReward,
      graduation: await readMentorshipGraduation(
        relation.discipleCultivatorId,
        this.database,
      ),
    };
  }

  async mentors(actor: Actor) {
    const ownMembership = await findActiveSectMembership(
      actor.cultivatorId,
      this.database,
    );
    const ownSectName =
      ownMembership &&
      Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, ownMembership.sectId)
        ? COMBAT_V6_SECT_DEFINITIONS[
            ownMembership.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
          ].name
        : null;
    const profiles = await this.database
      .select({
        profile: schema.mentorshipProfiles,
        character: schema.cultivators,
      })
      .from(schema.mentorshipProfiles)
      .innerJoin(
        schema.cultivators,
        eq(schema.mentorshipProfiles.cultivatorId, schema.cultivators.id),
      )
      .where(
        and(
          eq(schema.mentorshipProfiles.open, true),
          eq(schema.cultivators.status, 'active'),
          ne(schema.mentorshipProfiles.userId, actor.userId),
        ),
      )
      .orderBy(desc(schema.mentorshipProfiles.updatedAt))
      .limit(100);
    const mentors = [];
    for (const { profile, character } of profiles) {
      if (!canMentor(character.realm)) continue;
      try {
        await assertSocialContactAllowed(
          this.database,
          actor.userId,
          profile.userId,
        );
      } catch (error) {
        if (error instanceof HttpException) continue;
        throw error;
      }
      const [count] = await this.database
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.mentorshipRelations)
        .where(
          and(
            eq(schema.mentorshipRelations.mentorUserId, profile.userId),
            eq(schema.mentorshipRelations.status, 'active'),
          ),
        );
      if ((count?.count ?? 0) >= 2) continue;
      const membership = await findActiveSectMembership(
        character.id,
        this.database,
      );
      const sectName =
        membership &&
        Object.hasOwn(COMBAT_V6_SECT_DEFINITIONS, membership.sectId)
          ? COMBAT_V6_SECT_DEFINITIONS[
              membership.sectId as keyof typeof COMBAT_V6_SECT_DEFINITIONS
            ].name
          : null;
      mentors.push({
        cultivatorId: character.id,
        name: character.name,
        realm: character.realm,
        realmStage: character.realm_stage,
        sectName,
        profile: profileView(profile),
        remainingSeats: 2 - (count?.count ?? 0),
      });
    }
    if (ownSectName)
      mentors.sort(
        (left, right) =>
          Number(right.sectName === ownSectName) -
          Number(left.sectName === ownSectName),
      );
    return { mentors };
  }

  updateProfile(actor: Actor, input: MentorshipProfileInput) {
    return this.mutate(actor, 'mentorship.profile', input, [], async (tx) => {
      const character = await this.requireActor(tx, actor);
      if (input.open && !canMentor(character.realm))
        return fail('化神及以上道友才可公开收徒');
      const previous = await tx.query.mentorshipProfiles.findFirst({
        where: eq(schema.mentorshipProfiles.userId, actor.userId),
      });
      if ((previous?.revision ?? 0) !== input.expectedRevision)
        return fail('收徒信息已变化，请刷新');
      const values = {
        cultivatorId: actor.cultivatorId,
        open: input.open,
        directions: [...new Set(input.directions)].map(
          (value) => textFilter.mask(value).text,
        ),
        availableTimes: textFilter.mask(input.availableTimes).text,
        introduction: textFilter.mask(input.introduction).text,
        revision: input.expectedRevision + 1,
        updatedAt: new Date(),
      };
      await tx
        .insert(schema.mentorshipProfiles)
        .values({ userId: actor.userId, ...values })
        .onConflictDoUpdate({
          target: schema.mentorshipProfiles.userId,
          set: values,
        });
      await enqueueSocialNotification(tx, actor.userId, {
        cultivatorId: actor.cultivatorId,
        kind: 'mentorship',
      });
      return success;
    });
  }

  async request(actor: Actor, input: MentorshipRequestInput) {
    const target = await this.database.query.cultivators.findFirst({
      where: eq(schema.cultivators.id, input.targetCultivatorId),
    });
    if (!target) return fail('未找到该道友', 404);
    const other = { userId: target.userId, cultivatorId: target.id };
    return this.mutate(
      actor,
      'mentorship.request',
      input,
      [other],
      async (tx) => {
        const mentor = input.direction === 'apprentice' ? other : actor;
        const disciple = input.direction === 'apprentice' ? actor : other;
        const original = await tx.query.mentorshipRequests.findFirst({
          where: and(
            eq(schema.mentorshipRequests.initiatorUserId, actor.userId),
            eq(schema.mentorshipRequests.requestId, input.requestId),
          ),
        });
        if (original) {
          if (
            original.mentorCultivatorId !== mentor.cultivatorId ||
            original.discipleCultivatorId !== disciple.cultivatorId
          )
            return fail('请求标识已用于不同的师徒申请');
          return success;
        }
        await this.admission(tx, mentor, disciple);
        const now = new Date();
        const since = new Date(now.getTime() - 86400000);
        const [requestsToday] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.mentorshipRequests)
          .where(
            and(
              eq(schema.mentorshipRequests.initiatorUserId, actor.userId),
              gt(schema.mentorshipRequests.createdAt, since),
            ),
          );
        if ((requestsToday?.count ?? 0) >= MENTORSHIP_CONFIG.maxRequestsPerDay)
          return fail('24小时内最多发起10次师徒申请', 429);
        const rejected = await tx.query.mentorshipRequests.findFirst({
          where: and(
            eq(schema.mentorshipRequests.mentorUserId, mentor.userId),
            eq(schema.mentorshipRequests.discipleUserId, disciple.userId),
            eq(schema.mentorshipRequests.status, 'rejected'),
            gt(schema.mentorshipRequests.createdAt, since),
          ),
        });
        if (rejected) return fail('对方近期已拒绝，请明日再试');
        await tx
          .update(schema.mentorshipRequests)
          .set({
            status: 'expired',
            revision: sql`${schema.mentorshipRequests.revision} + 1`,
          })
          .where(
            and(
              eq(schema.mentorshipRequests.status, 'pending'),
              lte(schema.mentorshipRequests.expiresAt, now),
              or(
                eq(schema.mentorshipRequests.initiatorUserId, actor.userId),
                eq(schema.mentorshipRequests.mentorUserId, mentor.userId),
                eq(schema.mentorshipRequests.discipleUserId, disciple.userId),
              ),
            ),
          );
        const [pendingCount] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.mentorshipRequests)
          .where(
            and(
              eq(schema.mentorshipRequests.initiatorUserId, actor.userId),
              eq(schema.mentorshipRequests.status, 'pending'),
              gt(schema.mentorshipRequests.expiresAt, now),
            ),
          );
        if ((pendingCount?.count ?? 0) >= MENTORSHIP_CONFIG.maxPendingRequests)
          return fail('最多保留5份待处理的主动申请，请先撤回已有申请', 429);
        const pending = await tx.query.mentorshipRequests.findFirst({
          where: and(
            eq(
              schema.mentorshipRequests.mentorCultivatorId,
              mentor.cultivatorId,
            ),
            eq(
              schema.mentorshipRequests.discipleCultivatorId,
              disciple.cultivatorId,
            ),
            eq(schema.mentorshipRequests.status, 'pending'),
          ),
        });
        if (pending)
          return fail(
            pending.initiatorUserId === actor.userId
              ? '已有待处理的师徒申请'
              : '对方已发来申请，请明确接受',
          );
        await tx.insert(schema.mentorshipRequests).values({
          mentorUserId: mentor.userId,
          discipleUserId: disciple.userId,
          mentorCultivatorId: mentor.cultivatorId,
          discipleCultivatorId: disciple.cultivatorId,
          initiatorUserId: actor.userId,
          requestId: input.requestId,
          expiresAt: new Date(
            now.getTime() + MENTORSHIP_CONFIG.requestLifetimeDays * 86400000,
          ),
        });
        await this.notify(tx, {
          mentorUserId: mentor.userId,
          discipleUserId: disciple.userId,
          mentorCultivatorId: mentor.cultivatorId,
          discipleCultivatorId: disciple.cultivatorId,
        });
        return success;
      },
    );
  }

  async actRequest(
    actor: Actor,
    id: string,
    action: 'accept' | 'reject' | 'cancel',
    input: MentorshipMutation,
  ) {
    const initial = await this.database.query.mentorshipRequests.findFirst({
      where: eq(schema.mentorshipRequests.id, id),
    });
    if (
      !initial ||
      ![initial.mentorUserId, initial.discipleUserId].includes(actor.userId)
    )
      return fail('未找到该申请', 404);
    const parties = [
      {
        userId: initial.mentorUserId,
        cultivatorId: initial.mentorCultivatorId,
      },
      {
        userId: initial.discipleUserId,
        cultivatorId: initial.discipleCultivatorId,
      },
    ];
    return this.mutate(
      actor,
      `mentorship.request.${action}`,
      { ...input, id },
      parties,
      async (tx) => {
        const row = (
          await tx
            .select()
            .from(schema.mentorshipRequests)
            .where(eq(schema.mentorshipRequests.id, id))
            .for('update')
        )[0]!;
        const ownRole =
          row.mentorUserId === actor.userId
            ? row.mentorCultivatorId
            : row.discipleCultivatorId;
        if (ownRole !== actor.cultivatorId)
          return fail('原角色的申请已不可操作');
        if ((action === 'cancel') !== (row.initiatorUserId === actor.userId))
          return fail('无权处理此申请', 403);
        if (
          row.status !== 'pending' ||
          row.expiresAt <= new Date() ||
          row.revision !== input.expectedRevision
        )
          return fail('申请已失效或发生变化');
        if (action === 'accept') {
          const [mentor, disciple] = parties;
          const { teacher, student, seat } = await this.admission(
            tx,
            mentor,
            disciple,
          );
          await ensureFriendPairInTransaction(tx, mentor, disciple);
          await tx.insert(schema.mentorshipRelations).values({
            mentorUserId: mentor.userId,
            discipleUserId: disciple.userId,
            mentorCultivatorId: mentor.cultivatorId,
            discipleCultivatorId: disciple.cultivatorId,
            mentorOriginalCultivatorId: mentor.cultivatorId,
            discipleOriginalCultivatorId: disciple.cultivatorId,
            mentorName: teacher.name,
            discipleName: student.name,
            mentorSeat: seat,
          });
          await tx
            .update(schema.mentorshipAccountStates)
            .set({
              firstMentorUserId: mentor.userId,
              firstMentorCultivatorId: mentor.cultivatorId,
              firstBoundAt: new Date(),
              revision: sql`${schema.mentorshipAccountStates.revision} + 1`,
            })
            .where(eq(schema.mentorshipAccountStates.userId, disciple.userId));
          await tx
            .update(schema.mentorshipRequests)
            .set({
              status: 'cancelled',
              revision: sql`${schema.mentorshipRequests.revision} + 1`,
            })
            .where(
              and(
                eq(schema.mentorshipRequests.discipleUserId, disciple.userId),
                eq(schema.mentorshipRequests.status, 'pending'),
                ne(schema.mentorshipRequests.id, id),
              ),
            );
          for (const participant of parties)
            await enqueueSocialNotification(tx, participant.userId, {
              cultivatorId: participant.cultivatorId,
              kind: 'friends',
            });
        }
        await tx
          .update(schema.mentorshipRequests)
          .set({
            status:
              action === 'accept'
                ? 'accepted'
                : action === 'reject'
                  ? 'rejected'
                  : 'cancelled',
            revision: row.revision + 1,
          })
          .where(eq(schema.mentorshipRequests.id, id));
        if (action === 'accept') {
          await syncMentorshipAchievements(tx, row.mentorCultivatorId);
          await syncMentorshipAchievements(tx, row.discipleCultivatorId);
        }
        await this.notify(tx, row);
        return success;
      },
    );
  }

  private async findRelation(id: string, actor: Actor) {
    const row = await this.database.query.mentorshipRelations.findFirst({
      where: eq(schema.mentorshipRelations.id, id),
    });
    if (!row || ![row.mentorUserId, row.discipleUserId].includes(actor.userId))
      return fail('未找到该师徒关系', 404);
    return row;
  }

  private relationParties(relation: Relation): Actor[] {
    return [
      {
        userId: relation.mentorUserId,
        cultivatorId: relation.mentorOriginalCultivatorId,
      },
      {
        userId: relation.discipleUserId,
        cultivatorId: relation.discipleOriginalCultivatorId,
      },
    ];
  }

  async relationAction(
    actor: Actor,
    id: string,
    action: 'dissolve' | 'graduate',
    input: MentorshipMutation,
  ) {
    const initial = await this.findRelation(id, actor);
    const committed = await this.mutate(
      actor,
      `mentorship.${action}`,
      { ...input, id },
      this.relationParties(initial),
      async (tx): Promise<RelationMutationResult> => {
        const [relation] = await tx
          .select()
          .from(schema.mentorshipRelations)
          .where(eq(schema.mentorshipRelations.id, id))
          .for('update');
        if (
          !relation ||
          relation.status !== 'active' ||
          relation.revision !== input.expectedRevision
        )
          return fail('师徒关系已变化，请刷新');
        if (action === 'dissolve') {
          await tx
            .update(schema.mentorshipRelations)
            .set({
              status: 'dissolved',
              endReason: 'voluntary',
              endedAt: new Date(),
              revision: relation.revision + 1,
            })
            .where(eq(schema.mentorshipRelations.id, id));
          await this.notify(tx, relation);
          return success;
        }
        if (
          relation.discipleUserId !== actor.userId ||
          relation.discipleCultivatorId !== actor.cultivatorId ||
          relation.discipleOriginalCultivatorId !== actor.cultivatorId
        )
          return fail('只能由在授徒弟本人自主出师', 403);
        if (relation.graduationRewardedAt)
          return fail('此段师徒关系已完成出师结算');
        const progress = await readMentorshipGraduation(actor.cultivatorId, tx);
        if (!progress.ready) return fail('请先完成当前角色的四项出师条件');
        const mentor = await tx.query.cultivators.findFirst({
          where: and(
            eq(schema.cultivators.id, relation.mentorOriginalCultivatorId),
            eq(schema.cultivators.userId, relation.mentorUserId),
          ),
        });
        if (!mentor) return fail('原师父角色记录已变化，请刷新后核对师徒关系');
        const disciple = await this.requireActor(tx, actor);
        const mentorReputation = await updateReputation(
          relation.mentorUserId,
          mentor.id,
          MENTORSHIP_CONFIG.mentorReputationReward,
          tx,
        );
        const discipleReputation = await updateReputation(
          actor.userId,
          actor.cultivatorId,
          MENTORSHIP_CONFIG.discipleReputationReward,
          tx,
        );
        const rewards = {
          mentor: mentorReputation - mentor.reputation,
          disciple: discipleReputation - disciple.reputation,
        };
        const rewardedAt = new Date();
        await tx
          .update(schema.mentorshipRelations)
          .set({
            status: 'graduated',
            endReason: 'graduated',
            endedAt: rewardedAt,
            graduationRewardedAt: rewardedAt,
            mentorReputationReward: rewards.mentor,
            discipleReputationReward: rewards.disciple,
            revision: relation.revision + 1,
          })
          .where(eq(schema.mentorshipRelations.id, id));
        await syncMentorshipAchievements(
          tx,
          relation.mentorOriginalCultivatorId,
        );
        await syncMentorshipAchievements(
          tx,
          relation.discipleOriginalCultivatorId,
        );
        const committer = new ResourceEventCommitter();
        const mentorState = await committer.commit(tx, {
          actor: { userId: relation.mentorUserId, cultivatorId: mentor.id },
          source: 'mentorship.graduated',
          requestId: input.requestId,
          scopeDefaults: {
            accountId: relation.mentorUserId,
            cultivatorId: mentor.id,
          },
          changes: [
            {
              resourceTopic: 'player.currency',
              operation: 'merge',
              eventType: 'mentorship.graduated',
              payload: { reputation: mentorReputation },
            },
          ],
        });
        const discipleState = await committer.commit(tx, {
          actor: { userId: actor.userId, cultivatorId: actor.cultivatorId },
          source: 'mentorship.graduated',
          requestId: input.requestId,
          scopeDefaults: {
            accountId: actor.userId,
            cultivatorId: actor.cultivatorId,
          },
          changes: [
            {
              resourceTopic: 'player.currency',
              operation: 'merge',
              eventType: 'mentorship.graduated',
              payload: { reputation: discipleReputation },
            },
          ],
        });
        await queueAchievementRumor(tx, {
          text: `「${disciple.name}」已学有所成，今日正式拜别恩师「${mentor.name}」出师。愿师徒仙途常相照，道业各有成。`,
        });
        await this.notify(tx, relation);
        return {
          success: true,
          data: { rewards },
          state: discipleState,
          broadcastChanges: [...mentorState.changes, ...discipleState.changes],
        };
      },
    );
    const { broadcastChanges, ...response } = committed;
    if (broadcastChanges?.length) publishResourceEvents(broadcastChanges);
    return response;
  }
}
