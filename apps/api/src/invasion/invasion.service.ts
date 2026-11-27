import { type RealmStage, type RealmType } from '@daoyou/constants/realms';
import type {
  InvasionCommand,
  InvasionPreviousWave,
  InvasionStatus,
} from '@daoyou/contracts/invasion';
import type { GenderType } from '@daoyou/game-domain/character';
import type { InvasionMember } from '@daoyou/game-domain/invasion';
import { isDungeonRecoveryPill } from '@daoyou/game-rules/dungeon';
import {
  invasionDifficulty,
  invasionFirstClear,
  invasionFormation,
  invasionNextWave,
  invasionWeek,
} from '@daoyou/game-rules/invasion';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  advanceArenaV6,
  ArenaV6Error,
  createArenaV6,
} from '@server/combat/application/CombatV6ArenaService.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import {
  getBagConsumable,
  readBagConsumables,
} from '@server/inventory/application/BagConsumables.js';
import { ConsumableUseEngine } from '@server/inventory/application/ConsumableUseEngine.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import {
  invasionProgress as progress,
  invasionRecruitments as recruitments,
  invasionRuns as runs,
  invasionWeeks as weeks,
} from '@server/lib/drizzle/schema.js';
import {
  isRedisLockContention,
  withRedisLock,
} from '@server/lib/redis/lock.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, asc, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { grantPendingInvasionRewards } from './invasion-rewards.js';
import {
  consumeInvasionCards,
  finishInvasionRun,
  invasionClosesAt,
  invasionRosterMatches,
  progressKey,
  runProgress,
  type InvasionProgress,
  type InvasionRun,
} from './invasion-run.js';
import { readPersistentCharacterVitals } from '@server/combat/application/CombatV6PersistentCondition.js';
import {
  announceInvasion,
  invasionIdentity,
  prepareInvasionWeek,
  publishInvasionWeeks,
} from './invasion-week.js';

import {
  PARTY_CAPACITY,
  partyForUser,
  partyOwns,
  readParties,
  readParty,
  requirePartyIdentity,
  type Party,
} from '@server/parties/party.service.js';

function invasionMember(member: Party['members'][number]): InvasionMember {
  return {
    userId: member.userId,
    cultivatorId: member.cultivatorId,
    name: member.name,
    title: member.title,
    gender: (member.gender ?? '男') as GenderType,
    realm: member.realm as RealmType,
    realmStage: member.realmStage as RealmStage,
  };
}

const recruitmentKey = (week: string, partyId: string) =>
  and(eq(recruitments.week, week), eq(recruitments.partyId, partyId));

async function recruitment(
  party: Party,
  week: string,
  executor: DbTransaction | typeof db = db,
) {
  const [row] = await executor
    .select()
    .from(recruitments)
    .where(recruitmentKey(week, party.id));
  return {
    ready: row?.partyRevision === party.revision ? row.ready : [],
    advertised: row?.advertised ?? false,
  };
}
async function updateRecruitment(
  tx: DbTransaction,
  party: Party,
  week: string,
  ready: string[],
  advertised?: boolean,
) {
  await tx
    .insert(recruitments)
    .values({
      week,
      partyId: party.id,
      partyRevision: party.revision,
      ready,
      advertised,
    })
    .onConflictDoUpdate({
      target: [recruitments.week, recruitments.partyId],
      set: { partyRevision: party.revision, ready, advertised },
    });
}

const arena = new CombatV6ArenaStore();

const readProgress = (week: string, userId: string) =>
  db.query.invasionProgress.findFirst({ where: progressKey(week, userId) });

function previousWaveResult(
  run: InvasionRun,
  entry: InvasionProgress,
): InvasionPreviousWave {
  const wave = run.wave - 1;
  if (entry.lastRunId !== run.id || entry.completedWave !== wave)
    return { wave, status: 'assist' };
  if (entry.rewardedWave < wave) return { wave, status: 'pending' };
  const lastWave = entry.reward?.lastWave;
  return {
    wave,
    status: 'settled',
    reward: lastWave?.wave === wave ? lastWave.reward : null,
  };
}

function partyProgress(
  week: string,
  party: Party,
  executor: DbTransaction | typeof db = db,
) {
  return executor
    .select()
    .from(progress)
    .where(
      and(
        eq(progress.week, week),
        inArray(
          progress.userId,
          party.members.map(({ userId }) => userId),
        ),
      ),
    )
    .orderBy(asc(progress.userId));
}

async function lockOwnedRun(
  tx: DbTransaction,
  actor: ActiveCultivatorRef,
  week: string,
  runId: string,
) {
  const [run] = await tx
    .select()
    .from(runs)
    .where(and(eq(runs.id, runId), eq(runs.week, week)))
    .for('update');
  if (!run || run.phase === 'finished')
    throw new ConflictException('本轮已结束');
  const members = await runProgress(run.id, tx);
  const self = members.find(
    ({ userId, cultivatorId }) =>
      userId === actor.userId && cultivatorId === actor.cultivatorId,
  );
  if (!self) throw new ForbiddenException('你未参加本轮挑战');
  return { run, members, self };
}

export async function recruitingInvasionParties(week: string) {
  const candidates = await db
    .select({ partyId: recruitments.partyId })
    .from(recruitments)
    .where(
      and(eq(recruitments.week, week), eq(recruitments.advertised, true)),
    )
    .orderBy(asc(recruitments.partyId))
    .limit(100);
  const parties = await readParties(candidates.map(({ partyId }) => partyId));
  const users = parties.flatMap((party) =>
    party.members.map(({ userId }) => userId),
  );
  const started = new Set(
    users.length
      ? (
          await db
            .select({ userId: progress.userId })
            .from(progress)
            .where(
              and(
                eq(progress.week, week),
                inArray(progress.userId, users),
                isNotNull(progress.activeRunId),
              ),
            )
        ).map(({ userId }) => userId)
      : [],
  );
  return parties
    .filter(
      (party) =>
        party.members.length < PARTY_CAPACITY &&
        party.members.every((member) => !started.has(member.userId)),
    )
    .sort((a, b) => b.members.length - a.members.length);
}

export async function invasionRecruitmentFor(
  party: Party,
  week: string,
  actor: Pick<ActiveCultivatorRef, 'userId' | 'cultivatorId'>,
  tx: DbTransaction | typeof db,
) {
  const clock = invasionWeek(Date.now());
  if (clock.week !== week || !(await recruitment(party, week, tx)).advertised)
    return null;
  const own = await tx.query.invasionProgress.findFirst({
    where: progressKey(week, actor.userId),
  });
  if (own && (own.activeRunId || own.cultivatorId !== actor.cultivatorId))
    return null;
  const entries = await partyProgress(week, party, tx);
  if (entries.some((entry) => entry.activeRunId)) return null;
  return { label: '古魔入侵', deadline: clock.closesAt };
}

@Injectable()
export class InvasionService {
  private task?: Promise<void>;
  private timer?: ReturnType<typeof setInterval>;
  private announcedWeek?: string;
  private nextPublicationCheck = 0;

  start() {
    const tick = () => {
      if (this.task) return;
      this.task = this.tick()
        .catch((error) => console.error('[invasion] tick failed', error))
        .finally(() => {
          this.task = undefined;
        });
    };
    this.timer = setInterval(tick, 1000);
    this.timer.unref();
    tick();
  }

  async stop() {
    clearInterval(this.timer);
    await this.task;
  }

  async status(actor: ActiveCultivatorRef): Promise<InvasionStatus> {
    const serverNow = Date.now();
    const clock = invasionWeek(serverNow);
    const entry = await readProgress(clock.week, actor.userId);
    const reward = entry?.reward;
    const view: InvasionStatus = {
      week: clock.week,
      opensAt: clock.opensAt,
      closesAt: clock.closesAt,
      serverNow,
      otherCharacter: Boolean(
        entry && entry.cultivatorId !== actor.cultivatorId,
      ),
      completedWave: entry?.completedWave ?? 0,
      lastBattleId: entry?.lastBattleId ?? null,
      reward: reward
        ? {
            cultivationExp: reward.cultivationExp,
            spiritStones: reward.spiritStones,
            insight: reward.insight,
            drops: reward.drops,
          }
        : null,
      rewardsPending: !!entry && entry.rewardedWave < entry.completedWave,
      team: null,
    };
    if (view.otherCharacter)
      return {
        ...view,
        lastBattleId: null,
        completedWave: 0,
        reward: null,
        rewardsPending: false,
      };
    if (entry?.activeRunId) {
      const run = await db.query.invasionRuns.findFirst({
        where: eq(runs.id, entry.activeRunId),
      });
      if (run && run.phase !== 'finished') {
        const members = await runProgress(run.id);
        const own =
          members.find(({ userId }) => userId === actor.userId) ?? entry;
        const resources = run.phase === 'rest'
          ? Object.fromEntries(await Promise.all(members.map(async ({ cultivatorId }) =>
              [cultivatorId, await readPersistentCharacterVitals(cultivatorId, db)] as const)))
          : {};
        const regrouping =
          run.phase === 'rest' && !(await invasionRosterMatches(run));
        const recovery =
          run.phase === 'rest' &&
          !regrouping &&
          (resources[actor.cultivatorId]?.hp ?? 0) > 0
            ? (await readBagConsumables(actor.cultivatorId))
                .filter(isDungeonRecoveryPill)
                .map(({ id, name, quantity }) => ({ id, name, quantity }))
            : [];
        view.team = {
          id: run.id,
          realm: run.realm,
          members: run.members.map(invasionIdentity),
          ready: run.ready,
          leader: run.leaderId === actor.userId,
          captainId: run.members.find(({ userId }) => userId === run.leaderId)!
            .cultivatorId,
          phase: run.phase,
          regrouping,
          wave: run.wave,
          restEndsAt: run.phase === 'rest' ? run.dueAt : null,
          battleId: run.battleId,
          firstClear: invasionFirstClear(view.completedWave, run.wave),
          previousWave:
            run.phase === 'rest' ? previousWaveResult(run, own) : undefined,
          resources,
          self: {
            cards: entry.cards,
            selected: run.selectedCards[actor.cultivatorId],
          },
          recovery,
        };
        return view;
      }
    }
    const party = await partyForUser(actor.userId);
    if (!party) return view;
    if (!partyOwns(party, actor)) return { ...view, otherCharacter: true };
    const { ready, advertised } = await recruitment(party, clock.week);
    const entries = await partyProgress(clock.week, party);
    const wave = invasionNextWave(
      entries.find(({ userId }) => userId === party.leaderId)?.completedWave ??
        0,
    );
    const members = party.members.map(invasionMember);
    view.team = {
      id: party.id,
      realm: invasionDifficulty(members),
      members: members.map(invasionIdentity),
      ready,
      recruiting: advertised,
      leader: party.leaderId === actor.userId,
      captainId: members.find(({ userId }) => userId === party.leaderId)!
        .cultivatorId,
      startBlockedReason: entries.some(
        ({ activeRunId }) => activeRunId !== null,
      )
        ? '有队员仍在另一轮挑战中。'
        : entries.some(
            (entry) =>
              !party.members.some(
                ({ cultivatorId }) => cultivatorId === entry.cultivatorId,
              ),
          )
          ? '有队员需要切回本期出战的角色。'
          : undefined,
      phase: 'assembling',
      wave,
      restEndsAt: null,
      battleId: null,
      firstClear: invasionFirstClear(view.completedWave, wave),
      resources: {},
      self: { cards: entry?.cards ?? {} },
      recovery: [],
    };
    return view;
  }

  async command(
    actor: ActiveCultivatorRef,
    input: InvasionCommand,
    week: string | undefined,
  ) {
    const clock = invasionWeek(Date.now());
    if (week !== clock.week)
      throw new ConflictException('期次已更新，请返回营地刷新。');
    const entry = await readProgress(clock.week, actor.userId);
    if (entry && entry.cultivatorId !== actor.cultivatorId)
      throw new ForbiddenException('请使用本期出战的角色');
    if (input.type === 'next' && input.runId !== entry?.activeRunId)
      throw new ConflictException('本轮挑战已变化，请重新查看营地');
    if (!entry?.activeRunId) {
      if (!(await prepareInvasionWeek(clock)))
        throw new ConflictException('本期尚在准备，请稍后再试');
      const launch = await this.lobbyCommand(
        actor,
        clock.week,
        clock.closesAt,
        input,
      );
      if (launch) await this.launch(launch, true);
    } else if (input.type === 'recover') {
      await this.recover(actor, clock.week, entry.activeRunId, input);
    } else if (
      input.type === 'next' ||
      input.type === 'ready' ||
      input.type === 'card' ||
      input.type === 'withdraw'
    ) {
      const launch = await this.restCommand(
        actor,
        clock.week,
        entry.activeRunId,
        input,
      );
      if (launch) await this.launch(launch, true);
    } else {
      throw new ConflictException('本轮挑战尚未结束');
    }
    return this.status(actor);
  }

  private async restCommand(
    actor: ActiveCultivatorRef,
    week: string,
    runId: string,
    input: Extract<
      InvasionCommand,
      { type: 'next' | 'ready' | 'card' | 'withdraw' }
    >,
  ) {
    return db.transaction(async (tx) => {
      const { run, self, members } = await lockOwnedRun(tx, actor, week, runId);
      if (run.phase !== 'rest') throw new ConflictException('当前战斗尚未结束');
      if (input.type === 'withdraw') {
        if (
          run.leaderId !== actor.userId &&
          (await invasionRosterMatches(run, tx))
        )
          throw new ForbiddenException('由队长结束本轮挑战');
        await finishInvasionRun(tx, run.id);
        return;
      }
      const now = Date.now();
      if (now >= run.dueAt!) throw new ConflictException('休憩已结束');
      if (input.type === 'next' && input.wave !== run.wave)
        throw new ConflictException('波次已变化，请重新查看营地');
      if (!(await invasionRosterMatches(run, tx))) {
        if (input.type === 'next')
          throw new ConflictException('队伍已有变化，请返回集结后再开阵');
        await finishInvasionRun(tx, run.id);
        return;
      }
      if (input.type === 'next') {
        if (run.leaderId !== actor.userId)
          throw new ForbiddenException('由队长开启下一波');
        if (now >= (await invasionClosesAt(week, tx)))
          throw new ConflictException('活动已截止');
        await this.queueWave(tx, run, now);
        return run.id;
      }
      const ready = run.ready.filter((id) => id !== self.cultivatorId);
      if (input.type === 'card') {
        if (!(await readPersistentCharacterVitals(self.cultivatorId, tx)).hp)
          throw new ConflictException('倒地角色不能使用增益卡');
        const selectedCards = { ...run.selectedCards };
        if (input.card) {
          if (!self.cards[input.card])
            throw new BadRequestException('手中没有这张增益卡');
          selectedCards[self.cultivatorId] = input.card;
        } else delete selectedCards[self.cultivatorId];
        await tx
          .update(runs)
          .set({ ready, selectedCards })
          .where(eq(runs.id, run.id));
        return;
      }
      if (input.ready) ready.push(self.cultivatorId);
      if (members.every(({ cultivatorId }) => ready.includes(cultivatorId))) {
        await this.queueWave(tx, run, now);
        return run.id;
      }
      await tx.update(runs).set({ ready }).where(eq(runs.id, run.id));
    });
  }

  private async lobbyCommand(
    actor: ActiveCultivatorRef,
    week: string,
    closesAt: number,
    input: InvasionCommand,
  ) {
    if (input.type !== 'recruit' && input.type !== 'ready' && input.type !== 'start')
      throw new ConflictException('当前还未开战');
    return db.transaction(async (tx) => {
      const current = await partyForUser(actor.userId, tx);
      const party = current && (await readParty(current.id, tx, 'update'));
      if (!party || !partyOwns(party, actor))
        throw new ForbiddenException('你尚未加入队伍');
      if (Date.now() >= closesAt) throw new ConflictException('活动已截止');
      const { ready } = await recruitment(party, week, tx);
      if (input.type === 'recruit') {
        if (party.leaderId !== actor.userId)
          throw new ForbiddenException('只有队长可以调整营地招募');
        if (input.advertised && (await partyProgress(week, party, tx)).some((row) => row.activeRunId))
          throw new ConflictException('队伍正在挑战');
        await updateRecruitment(tx, party, week, ready, input.advertised);
        return;
      }
      if (input.type === 'ready') {
        await updateRecruitment(tx, party, week, [
          ...ready.filter((id) => id !== actor.cultivatorId),
          ...(input.ready ? [actor.cultivatorId] : []),
        ]);
        return;
      }
      if (party.leaderId !== actor.userId)
        throw new ForbiddenException('由队长开启挑战');
      if (party.members.length < 2)
        throw new ConflictException('至少需要两名道友结队出战');
      const members = party.members.map(invasionMember);
      for (const member of [...members].sort((a, b) =>
        a.userId.localeCompare(b.userId),
      )) {
        await requirePartyIdentity(tx, member);
        await tx
          .insert(progress)
          .values({
            week,
            userId: member.userId,
            cultivatorId: member.cultivatorId,
            rewardRealm: member.realm,
            rewardStage: member.realmStage,
          })
          .onConflictDoNothing();
      }
      const entries = await partyProgress(week, party, tx).for('update');
      if (entries.some(({ activeRunId }) => activeRunId))
        throw new ConflictException('有队员仍在另一轮挑战中');
      if (
        members.some(
          (member) =>
            entries.find(({ userId }) => userId === member.userId)
              ?.cultivatorId !== member.cultivatorId,
        )
      )
        throw new ConflictException('有队员需要使用本期出战的角色');
      await tx
        .select({ week: weeks.week })
        .from(weeks)
        .where(eq(weeks.week, week))
        .for('share');
      const now = Date.now();
      if (now >= closesAt) throw new ConflictException('活动已截止');
      const [run] = await tx
        .insert(runs)
        .values({
          week,
          partyId: party.id,
          partyRevision: party.revision,
          leaderId: actor.userId,
          realm: invasionDifficulty(members),
          members,
          wave: invasionNextWave(
            entries.find(({ userId }) => userId === actor.userId)!
              .completedWave,
          ),
          startedAt: now,
          phase: 'launching',
          launchId: randomUUID(),
          dueAt: now,
        })
        .returning({ id: runs.id });
      await tx
        .update(progress)
        .set({ activeRunId: run.id })
        .where(
          and(
            eq(progress.week, week),
            inArray(
              progress.userId,
              members.map(({ userId }) => userId),
            ),
          ),
        );
      await updateRecruitment(tx, party, week, [], false);
      return run.id;
    });
  }

  private queueWave(tx: DbTransaction, run: InvasionRun, now: number) {
    return tx
      .update(runs)
      .set({ phase: 'launching', launchId: randomUUID(), dueAt: now })
      .where(eq(runs.id, run.id));
  }

  private async launch(id: string, reportConflict = false) {
    try {
      await withRedisLock(
        {
          key: `lock:invasion:launch:${id}`,
          context: 'invasion-wave',
          timeoutMs: 60_000,
          retries: 0,
        },
        async () => {
          const run = await db.query.invasionRuns.findFirst({
            where: eq(runs.id, id),
          });
          if (!run || run.phase !== 'launching') return;
          const closesAt = await invasionClosesAt(run.week);
          let battleId = await arena.source(id, run.launchId);
          let rejected: ArenaV6Error | undefined;
          if (
            !battleId &&
            Date.now() < closesAt &&
            (await invasionRosterMatches(run))
          ) {
            try {
              battleId = await createArenaV6(
                {
                  roomId: id,
                  startRequestId: run.launchId,
                  frozenRoster: {
                    version: 'arena_frozen_roster_v1',
                    startRequestId: run.launchId,
                    frozenAt: run.startedAt,
                    seats: run.members.map(
                      ({ userId, cultivatorId, name }, slot) => ({
                        slot,
                        userId,
                        cultivatorId,
                        displayName: name,
                        teamId: 'alpha',
                      }),
                    ),
                  },
                },
                undefined,
                {
                  teamId: id,
                  wave: run.wave,
                  endsAt: Math.min(closesAt, Date.now() + 2 * 3_600_000),
                  realm: run.realm,
                  week: run.week,
                  formation: invasionFormation(run.week, run.wave),
                  cards: run.selectedCards,
                },
              );
            } catch (error) {
              battleId = await arena.source(id, run.launchId);
              if (!battleId && error instanceof ArenaV6Error) rejected = error;
              else if (!battleId) throw error;
            }
          }
          const runtime = battleId ? await arena.get(battleId) : null;
          await db.transaction(async (tx) => {
            const [current] = await tx
              .select()
              .from(runs)
              .where(eq(runs.id, id))
              .for('update');
            if (
              !current ||
              current.phase !== 'launching' ||
              current.launchId !== run.launchId
            )
              return;
            if (!runtime) {
              await finishInvasionRun(tx, id);
              return;
            }
            const members = await runProgress(id, tx).for('update');
            await consumeInvasionCards(tx, current, members);
            await tx
              .update(runs)
              .set({
                phase: 'battle',
                battleId,
                selectedCards: {},
                dueAt: runtime.expiresAt,
              })
              .where(eq(runs.id, id));
          });
          if (rejected && reportConflict)
            throw new ConflictException(rejected.message);
        },
      );
    } catch (error) {
      if (isRedisLockContention(error)) return;
      throw error;
    }
  }

  private async recover(
    actor: ActiveCultivatorRef,
    week: string,
    runId: string,
    input: Extract<InvasionCommand, { type: 'recover' }>,
  ) {
    await playerCommandExecutor.executeWithLock({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'invasion.recover',
      idempotency: {
        key: input.requestId,
        fingerprint: `${week}:${runId}:${input.itemId}`,
      },
      command: async (tx) => {
        const { run, self } = await lockOwnedRun(tx, actor, week, runId);
        if (
          run.phase !== 'rest' ||
          Date.now() >= run.dueAt! ||
          !(await invasionRosterMatches(run, tx))
        )
          throw new ConflictException('休憩已结束');
        const current = await readPersistentCharacterVitals(actor.cultivatorId, tx);
        if (!current || current.hp <= 0)
          throw new ConflictException('倒地角色不能服药');
        const item = await getBagConsumable(
          actor.cultivatorId,
          input.itemId,
          tx,
        );
        if (!item || !isDungeonRecoveryPill(item))
          throw new BadRequestException('请选用储物袋里的回复品');
        if (current.hp >= current.maxHp && current.mp >= current.maxMp)
          throw new ConflictException('气血法力已满');
        try {
          await ConsumableUseEngine.consume(
            actor.userId,
            actor.cultivatorId,
            input.itemId,
            { tx, invasionRest: true },
          );
          if (Date.now() >= run.dueAt!) throw new ConflictException('休憩已结束');
          await tx.update(runs).set({
            ready: run.ready.filter((id) => id !== self.cultivatorId),
          }).where(eq(runs.id, run.id));
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === 'Error' || error instanceof ConflictException)
          )
            throw new BadRequestException(error.message);
          throw error;
        }
        return {
          result: true,
          resourceChanges: [
            {
              resourceTopic: 'inventory.bag',
              operation: 'invalidate',
              eventType: 'inventory.bag.changed',
            },
            {
              resourceTopic: 'player.condition',
              operation: 'invalidate',
              eventType: 'condition.invasion.recovered',
            },
          ],
        };
      },
    });
  }

  private async tick() {
    const now = Date.now();
    const clock = invasionWeek(now);
    if (this.announcedWeek !== clock.week) {
      try {
        if (await announceInvasion(clock)) this.announcedWeek = clock.week;
      } catch (error) {
        console.error('[invasion] rumor failed', error);
      }
    }
    const due = await db
      .select()
      .from(runs)
      .where(lte(runs.dueAt, now))
      .orderBy(asc(runs.dueAt))
      .limit(50);
    for (const run of due) {
      try {
        if (run.phase === 'launching') await this.launch(run.id);
        if (run.phase === 'rest') {
          const launching = await db.transaction(async (tx) => {
            const [current] = await tx
              .select()
              .from(runs)
              .where(eq(runs.id, run.id))
              .for('update');
            const now = Date.now();
            if (!current || current.phase !== 'rest' || current.dueAt! > now)
              return false;
            if (
              now >= (await invasionClosesAt(current.week, tx)) ||
              !(await invasionRosterMatches(current, tx))
            ) {
              await finishInvasionRun(tx, current.id);
              return false;
            }
            await this.queueWave(tx, current, now);
            return true;
          });
          if (launching) await this.launch(run.id);
        }
        if (run.phase === 'battle' && run.battleId) {
          if (await arena.get(run.battleId)) await advanceArenaV6(run.battleId);
          else
            await db.transaction(async (tx) => {
              const [current] = await tx
                .select()
                .from(runs)
                .where(eq(runs.id, run.id))
                .for('update');
              if (
                current?.phase === 'battle' &&
                current.battleId === run.battleId
              )
                await finishInvasionRun(tx, run.id);
            });
        }
      } catch (error) {
        console.error('[invasion] run work failed', { runId: run.id, error });
        await db
          .update(runs)
          .set({ dueAt: Date.now() + 5000 })
          .where(
            and(
              eq(runs.id, run.id),
              eq(runs.phase, run.phase),
              eq(runs.dueAt, run.dueAt!),
            ),
          );
      }
    }
    if (now >= this.nextPublicationCheck) {
      await publishInvasionWeeks(now);
      this.nextPublicationCheck = now + 5_000;
    }
    await grantPendingInvasionRewards();
  }
}
