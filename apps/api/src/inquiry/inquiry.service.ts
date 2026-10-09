import { getInquiryPlay, INQUIRY_FALLBACKS, inquiryPlayForNode } from '@daoyou/game-content/inquiry';
import { DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/dungeon';
import { getMapNode } from '@daoyou/game-content/world/map';
import type { RealmType } from '@daoyou/constants/realms';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { DungeonRewardEntry } from '@daoyou/game-domain/dungeon';
import { MaterialFactsSchema } from '@daoyou/game-domain/inventory';
import type {
  InquiryCaseFile,
  InquiryPlay,
  InquiryProgress,
  InquiryStatus,
} from '@daoyou/game-domain/inquiry';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import { getRealmStageLevel } from '@daoyou/game-domain/progression';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { ResourceOperation } from '@daoyou/game-domain/resources';
import {
  applyInquiryAction,
  createInquiryProgress,
  finishInquiryBattle,
  inquiryActions,
  compileInquiryCase,
  inquiryCanonicalProse,
  inquiryNarrativeFacts,
  inquiryVerdictReady,
  type InquiryActionView,
  inquiryBattleKey,
  inquiryVisitKey,
  judgeInquiryVerdict,
  planInquiryBattleReward,
  planInquiryCompletionReward,
  planInquiryVisitReward,
  quoteInquiryCost,
} from '@daoyou/game-rules/inquiry';
import { appendDungeonReward } from '@daoyou/game-rules/rewards/dungeon';
import {
  canChallengeDungeonRealm,
  resolveDungeonMapConfig,
} from '@daoyou/game-rules/world/dungeon';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { hasActiveDungeon } from '@server/dungeon/occupancy.js';
import { grantDungeonBeastExperience } from '@server/dungeon/application/flow/combatV6.js';
import type { DungeonState } from '@server/dungeon/application/flow/types.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import { QiInsufficientError, QiService } from '@server/cultivator/application/QiService.js';
import { generateRealmMaterials } from '@server/inventory/application/MaterialRewardService.js';
import { grantInventory } from '@server/inventory/operations.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators, inquiryHistories, inquiryRuns } from '@server/lib/drizzle/schema.js';
import { PlayerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { ResourceEngine } from '@server/player/application/state/ResourceEngine.js';
import { hasOpenInquiry } from './occupancy.js';
import { fightInquiryCasket } from './fight.js';
import { streamInquiryNarration } from './narration.js';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';

export interface InquiryView {
  runId: string;
  status: InquiryStatus;
  revision: number;
  mapNodeId: string;
  locationId: InquiryProgress['locationId'];
  prose: string;
  actions: InquiryActionView[];
  clues: Array<{ id: string; title: string; body: string }>;
  notes: Array<{ id: string; title: string; body: string }>;
  heldItemIds: string[];
  verdictReady: boolean;
  verdict: {
    answerLabel: string;
    answers: Array<{ id: string; label: string }>;
    containerLabel: string;
    containerOptions: Array<{ id: 'leave_shut' | 'open'; label: string }>;
  } | null;
  feedback?: string;
  settlement?: {
    correct: boolean;
    rating: string | null;
    narrative: string;
  } | null;
}

type InquiryRow = typeof inquiryRuns.$inferSelect;

export interface InquiryNarrationJob {
  cultivatorId: string;
  runId: string;
  revision: number;
  key: string;
  fallback: string;
  lines: string[];
  play: InquiryPlay;
}

export type InquiryEvent = (event: string, data: unknown) => void;

function fail(message: string, status: 400 | 404 | 409 | 500 = 400): never {
  throw new HttpException({ success: false, error: message }, status);
}

@Injectable()
export class InquiryService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(PlayerCommandExecutor) private readonly commands: PlayerCommandExecutor,
    @Inject(ResourceEngine) private readonly resources: ResourceEngine,
  ) {}

  async state(cultivatorId: string): Promise<{ run: InquiryView | null }> {
    const row = await this.openRow(cultivatorId);
    return { run: row?.caseFile ? this.present(row) : null };
  }

  async assertCanOpen(cultivatorId: string, mapNodeId: string) {
    if (!inquiryPlayForNode(mapNodeId)) fail('这处秘境还没有开放探查', 400);
    if (await hasOpenInquiry(cultivatorId)) fail('已经在一处秘境里', 409);
    if (await hasActiveDungeon(cultivatorId)) fail('旧版秘境还没结束', 409);
    const map = getMapNode(mapNodeId);
    if (!map || !('realm_requirement' in map)) fail('秘境地图无效', 400);
    const [cultivator] = await this.database
      .select({ realm: cultivators.realm })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);
    if (!cultivator) fail('角色不存在', 404);
    if (!canChallengeDungeonRealm(cultivator.realm as RealmType, map.realm_requirement)) {
      fail(`当前境界${cultivator.realm}不可探查${map.realm_requirement}秘境`, 409);
    }
  }

  async openWithEvents(
    userId: string,
    cultivatorId: string,
    mapNodeId: string,
    emit: InquiryEvent,
  ) {
    await this.assertCanOpen(cultivatorId, mapNodeId);
    emit('action_status', { message: '正在进入秘境' });
    const detailed = await this.openDetailed(userId, cultivatorId, mapNodeId);
    emit('state', detailed.response);
    if (detailed.stream) {
      const text = await streamInquiryNarration(
        {
          play: detailed.stream.play,
          fallback: detailed.stream.fallback,
          lines: detailed.stream.lines,
        },
        (token) => emit('token', { text: token }),
      );
      await this.rememberNarration(
        detailed.stream.cultivatorId,
        detailed.stream.runId,
        detailed.stream.revision,
        detailed.stream.key,
        text,
      );
      emit('prose', { text });
    }
    emit('ready', detailed.response);
  }

  async open(userId: string, cultivatorId: string, mapNodeId: string) {
    const detailed = await this.openDetailed(userId, cultivatorId, mapNodeId);
    return detailed.response;
  }

  async openDetailed(userId: string, cultivatorId: string, mapNodeId: string) {
    const play = inquiryPlayForNode(mapNodeId);
    if (!play) fail('这处秘境还没有开放探查', 400);
    const compiled = compileInquiryCase(play, INQUIRY_FALLBACKS[play.id]);
    if (!compiled.ok) fail(compiled.reason, 500);
    try {
      const committed = await this.commands.executeWithLock({
        userId,
        cultivatorId,
        source: 'inquiry_start',
        lock: { context: 'inquiry-start', timeoutMs: 30_000 },
        command: (tx) =>
          this.openInTransaction(userId, cultivatorId, mapNodeId, compiled.caseFile, tx),
      });
      return {
        response: toPlayerStateMutationResponse({
          result: committed.result.view,
          state: committed.state,
        }),
        stream: committed.result.stream,
      };
    } catch (error) {
      if (error instanceof QiInsufficientError) fail('QI_INSUFFICIENT', 409);
      throw error;
    }
  }

  async act(
    userId: string,
    cultivatorId: string,
    input: { runId: string; actionId: string; expectedRevision: number },
  ) {
    const detailed = await this.actDetailed(userId, cultivatorId, input);
    return detailed.response;
  }

  async actDetailed(
    userId: string,
    cultivatorId: string,
    input: { runId: string; actionId: string; expectedRevision: number },
  ) {
    const committed = await this.commands.executeWithLock({
      userId,
      cultivatorId,
      source: 'inquiry_action',
      allowEmpty: true,
      lock: { context: 'inquiry-action', timeoutMs: 30_000 },
      command: (tx) => this.actInTransaction(userId, cultivatorId, input, tx),
    });
    return {
      response: toPlayerStateMutationResponse({
        result: committed.result.view,
        state: committed.state,
      }),
      stream: committed.result.stream,
    };
  }

  async rememberNarration(
    cultivatorId: string,
    runId: string,
    revision: number,
    key: string,
    text: string,
  ) {
    const [row] = await this.database
      .select()
      .from(inquiryRuns)
      .where(and(eq(inquiryRuns.id, runId), eq(inquiryRuns.cultivatorId, cultivatorId)))
      .limit(1);
    if (!row) return;
    const narrations = { ...(row.narrations ?? {}), [key]: text };
    if (row.revision === revision) narrations.latest = text;
    await this.database
      .update(inquiryRuns)
      .set({ narrations })
      .where(eq(inquiryRuns.id, row.id));
  }

  async verdict(
    userId: string,
    cultivatorId: string,
    input: {
      runId: string;
      expectedRevision: number;
      answerId: string;
      container: 'leave_shut' | 'open';
    },
  ) {
    const committed = await this.commands.executeWithLock({
      userId,
      cultivatorId,
      source: 'inquiry_verdict',
      allowEmpty: true,
      lock: { context: 'inquiry-verdict', timeoutMs: 30_000 },
      command: (tx) => this.verdictInTransaction(userId, cultivatorId, input, tx),
    });
    return toPlayerStateMutationResponse(committed);
  }

  async leave(
    userId: string,
    cultivatorId: string,
    input: { runId: string; expectedRevision: number },
  ) {
    const committed = await this.commands.executeWithLock({
      userId,
      cultivatorId,
      source: 'inquiry_leave',
      allowEmpty: true,
      lock: { context: 'inquiry-leave', timeoutMs: 30_000 },
      command: (tx) =>
        this.leaveInTransaction(userId, cultivatorId, input.runId, input.expectedRevision, tx),
    });
    return toPlayerStateMutationResponse(committed);
  }

  private async openInTransaction(
    userId: string,
    cultivatorId: string,
    mapNodeId: string,
    caseFile: InquiryCaseFile,
    tx: DbTransaction,
  ) {
    if (!inquiryPlayForNode(mapNodeId)) fail('这处秘境还没有开放探查', 400);
    if (await hasOpenInquiry(cultivatorId, tx)) fail('已经在一处秘境里', 409);
    if (await hasActiveDungeon(cultivatorId)) fail('旧版秘境还没结束', 409);
    const map = getMapNode(mapNodeId);
    if (!map || !('realm_requirement' in map)) fail('秘境地图无效', 400);
    const [cultivator] = await tx
      .select({ realm: cultivators.realm })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);
    if (!cultivator) fail('角色不存在', 404);
    if (!canChallengeDungeonRealm(cultivator.realm as RealmType, map.realm_requirement)) {
      fail(`当前境界${cultivator.realm}不可探查${map.realm_requirement}秘境`, 409);
    }
    const play = inquiryPlayForNode(mapNodeId);
    if (!play) fail('这处秘境还没有开放探查', 400);
    const progress = createInquiryProgress(play);
    const rewardSeed = randomInt(0, 0x7fffffff);
    const rewards = [
      await this.materializeReward(
        rewardSeed,
        play.startLocationId,
        map.realm_requirement,
        cultivator.realm as RealmType,
        resolveDungeonMapConfig(map).difficultyTier,
        tx,
      ),
    ];
    const actionInstanceId = randomUUID();
    const reservation = await QiService.reserveQi({
      cultivatorId,
      action: 'inquiry_start',
      actionInstanceId,
      metadata: { mapNodeId },
      tx,
    });
    const [inserted] = await tx
      .insert(inquiryRuns)
      .values({
        cultivatorId,
        mapNodeId,
        status: 'INVESTIGATING',
        templateId: caseFile.playId,
        rewardSeed,
        truthId: caseFile.truthId,
        caseFile,
        progress,
        narrations: { focus: `move:${play.startLocationId}` },
        v6Rewards: rewards,
      })
      .returning();
    if (!inserted) fail('探查没能开始', 500);
    await QiService.commitReservation({
      actionInstanceId,
      metadata: { runId: inserted.id },
      tx,
    });
    const openingKey = `move:${play.startLocationId}`;
    return {
      result: {
        view: this.present(inserted),
        stream: this.narrationJob(inserted, play, progress, openingKey),
      },
      resourceChanges: [
        {
          resourceTopic: 'player.currency',
          eventType: 'currency.changed',
          operation: 'merge',
          payload: {
            qi: reservation.qiAfter,
            qiLastRefreshedAt: reservation.qiLastRefreshedAt,
          },
        },
      ] satisfies ResourceChangeDescriptor[],
    };
  }

  private async actInTransaction(
    userId: string,
    cultivatorId: string,
    input: { runId: string; actionId: string; expectedRevision: number },
    tx: DbTransaction,
  ): Promise<{
    result: { view: InquiryView; stream: InquiryNarrationJob | null };
    resourceChanges: ResourceChangeDescriptor[];
  }> {
    const row = await this.lockRow(cultivatorId, input.runId, input.expectedRevision, tx);
    if (row.status !== 'INVESTIGATING' || !row.caseFile) fail('现在不能探查', 409);
    const play = this.playFor(row.caseFile);
    const progressNow = this.progressFor(play, row.progress);
    const applied = applyInquiryAction(progressNow, play, row.caseFile, input.actionId);
    if (applied.effect.kind === 'rejected') fail(applied.effect.message, 409);
    if (applied.effect.kind === 'known') {
      const view = this.present(row);
      return {
        result: {
          view: {
            ...view,
            prose: inquiryCanonicalProse(play, row.caseFile, input.actionId),
          },
          stream: null,
        },
        resourceChanges: [],
      };
    }
    const map = this.mapOf(row.mapNodeId);
    const [cultivator] = await tx
      .select({ realm: cultivators.realm, condition: cultivators.condition })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);
    if (!cultivator?.condition) fail('角色状态缺失', 409);
    const changes: ResourceChangeDescriptor[] = [];
    if (applied.cost) {
      const priced = quoteInquiryCost(
        applied.cost,
        map.realm_requirement,
        resolveDungeonMapConfig(map).difficultyTier,
      );
      if (priced.type === 'spirit_stones' || priced.type === 'lifespan') {
        const spent = await this.resources.applyInTransaction({
          userId,
          cultivatorId,
          tx,
          consume: [{ type: priced.type, value: priced.value }],
        });
        if (!spent.success) fail(spent.errors?.join('；') || '代价付不起', 409);
        this.pushSettlement(changes, spent.settlement);
      } else {
        const next = this.applyBodyLoss(
          cultivator.condition as CultivatorCondition,
          priced.type,
          priced.value,
        );
        await tx
          .update(cultivators)
          .set({ condition: next })
          .where(eq(cultivators.id, cultivatorId));
        changes.push({
          resourceTopic: 'player.condition',
          eventType: 'condition.changed',
          operation: 'replace',
          payload: next,
        });
      }
    }

    let progress = applied.progress;
    let rewards = row.v6Rewards ?? [];
    let focus =
      applied.effect.kind === 'clue' ||
      applied.effect.kind === 'note' ||
      applied.effect.kind === 'battle'
        ? applied.effect.narrationKey
        : input.actionId;
    if (applied.rewardKey) {
      rewards = appendDungeonReward(
        rewards,
        await this.materializeReward(
          row.rewardSeed,
          progress.locationId,
          map.realm_requirement,
          cultivator.realm as RealmType,
          resolveDungeonMapConfig(map).difficultyTier,
          tx,
          applied.rewardKey,
        ),
      );
    }
    if (applied.effect.kind === 'battle') {
      const fight = await fightInquiryCasket(cultivatorId, row.mapNodeId, tx);
      const beaten = this.applyBodyAbsolute(
        cultivator.condition as CultivatorCondition,
        fight,
      );
      await tx
        .update(cultivators)
        .set({ condition: beaten })
        .where(eq(cultivators.id, cultivatorId));
      changes.push({
        resourceTopic: 'player.condition',
        eventType: 'condition.changed',
        operation: 'replace',
        payload: beaten,
      });
      const containerId = focus.startsWith('open:') ? focus.slice('open:'.length) : '';
      progress = finishInquiryBattle(progress, fight.victory ? 'victory' : 'retreat', containerId);
      if (!fight.victory) {
        const finished = await this.finish(
          userId,
          cultivatorId,
          row,
          progress,
          rewards,
          false,
          null,
          '守剑傀把你逼出了洞府。',
          tx,
          changes,
        );
        return {
          result: { view: finished.result, stream: null },
          resourceChanges: finished.resourceChanges,
        };
      }
      const battleReward = await this.materializeBattle(
        row.rewardSeed,
        randomUUID(),
        map.realm_requirement,
        cultivator.realm as RealmType,
        resolveDungeonMapConfig(map).difficultyTier,
        tx,
      );
      if (fight.beastExperience) battleReward.beastExperience = fight.beastExperience;
      rewards = appendDungeonReward(rewards, battleReward);
      focus = `battle_won:${focus.startsWith('open:') ? focus.slice('open:'.length) : ''}`;
    }

    const narrations = {
      ...(row.narrations ?? {}),
      focus,
      feedback: '',
    };
    const [saved] = await tx
      .update(inquiryRuns)
      .set({
        progress,
        narrations,
        v6Rewards: rewards,
        revision: row.revision + 1,
        status: 'INVESTIGATING',
      })
      .where(eq(inquiryRuns.id, row.id))
      .returning();
    if (!saved?.caseFile) fail('探查状态没能保存', 500);
    const savedPlay = this.playFor(saved.caseFile);
    return {
      result: {
        view: this.present(saved),
        stream: row.narrations?.[focus]
          ? null
          : this.narrationJob(saved, savedPlay, progress, focus),
      },
      resourceChanges: changes,
    };
  }

  private async verdictInTransaction(
    userId: string,
    cultivatorId: string,
    input: {
      runId: string;
      expectedRevision: number;
      answerId: string;
      container: 'leave_shut' | 'open';
    },
    tx: DbTransaction,
  ) {
    const row = await this.lockRow(cultivatorId, input.runId, input.expectedRevision, tx);
    if (row.status !== 'INVESTIGATING' || !row.caseFile) fail('现在不能下定论', 409);
    const play = this.playFor(row.caseFile);
    const judged = judgeInquiryVerdict(this.progressFor(play, row.progress), play, row.caseFile, {
      answerId: input.answerId,
      container: input.container,
    });
    if (!judged.correct) {
      const [saved] = await tx
        .update(inquiryRuns)
        .set({
          revision: row.revision + 1,
          narrations: { ...(row.narrations ?? {}), feedback: judged.message },
        })
        .where(eq(inquiryRuns.id, row.id))
        .returning();
      if (!saved) fail('定论没能记下', 500);
      return {
        result: { ...this.present(saved), feedback: judged.message },
        resourceChanges: [],
      };
    }
    const map = this.mapOf(row.mapNodeId);
    const [cultivator] = await tx
      .select({ realm: cultivators.realm })
      .from(cultivators)
      .where(eq(cultivators.id, cultivatorId))
      .limit(1);
    if (!cultivator) fail('角色不存在', 404);
    const rewards = appendDungeonReward(
      row.v6Rewards ?? [],
      await this.materializeCompletion(
        row.rewardSeed,
        map.realm_requirement,
        cultivator.realm as RealmType,
        resolveDungeonMapConfig(map).difficultyTier,
        tx,
      ),
    );
    return this.finish(
      userId,
      cultivatorId,
      row,
      row.progress,
      rewards,
      true,
      judged.rating,
      row.caseFile.truthText,
      tx,
      [],
    );
  }

  private async leaveInTransaction(
    userId: string,
    cultivatorId: string,
    runId: string,
    expectedRevision: number,
    tx: DbTransaction,
  ) {
    const row = await this.lockRow(cultivatorId, runId, expectedRevision, tx);
    if (row.status !== 'INVESTIGATING') fail('现在不能离开', 409);
    return this.finish(
      userId,
      cultivatorId,
      row,
      row.progress,
      row.v6Rewards ?? [],
      false,
      null,
      '你带着已经看过的东西离开了洞府。',
      tx,
      [],
    );
  }

  private async finish(
    userId: string,
    cultivatorId: string,
    row: InquiryRow,
    progress: InquiryProgress,
    rewards: DungeonRewardEntry[],
    correct: boolean,
    rating: 'A' | 'B' | null,
    narrative: string,
    tx: DbTransaction,
    changes: ResourceChangeDescriptor[],
  ) {
    const gains: ResourceOperation[] = [];
    const experience = rewards.reduce((sum, reward) => sum + reward.experience, 0);
    const spiritStones = rewards.reduce((sum, reward) => sum + reward.spiritStones, 0);
    if (experience > 0) gains.push({ type: 'cultivation_exp', value: experience });
    if (spiritStones > 0) gains.push({ type: 'spirit_stones', value: spiritStones });
    const items = rewards.flatMap((reward) => reward.items);
    await grantInventory(cultivatorId, items, tx);
    if (rewards.some((reward) => reward.beastExperience)) {
      await grantDungeonBeastExperience(
        { cultivatorId, v6Rewards: rewards } as DungeonState,
        tx,
      );
    }
    if (gains.length) {
      const gained = await this.resources.applyInTransaction({
        userId,
        cultivatorId,
        tx,
        gain: gains,
      });
      if (!gained.success) fail(gained.errors?.join('；') || '收获没能入账', 409);
      this.pushSettlement(changes, gained.settlement);
    }
    changes.push({
      resourceTopic: 'inventory.bag',
      eventType: 'inventory.inquiry.changed',
      operation: 'invalidate',
    });
    const settlement = { correct, rating, narrative };
    await tx.insert(inquiryHistories).values({
      cultivatorId,
      runId: row.id,
      mapNodeId: row.mapNodeId,
      theme: row.caseFile?.truthText.slice(0, 100) || '洞府遗藏',
      correct,
      rating,
      narrative,
      realGains: gains,
    });
    const [saved] = await tx
      .update(inquiryRuns)
      .set({
        status: 'FINISHED',
        progress,
        v6Rewards: rewards,
        settlement,
        endedAt: new Date(),
        revision: row.revision + 1,
        activeBattleId: null,
      })
      .where(eq(inquiryRuns.id, row.id))
      .returning();
    if (!saved) fail('探查没能结束', 500);
    return { result: this.present(saved), resourceChanges: changes };
  }

  private async materializeReward(
    seed: number,
    locationId: InquiryProgress['locationId'],
    mapRealm: RealmType,
    playerRealm: RealmType,
    difficultyTier: ReturnType<typeof resolveDungeonMapConfig>['difficultyTier'],
    tx: DbTransaction,
    key = inquiryVisitKey(locationId),
  ): Promise<DungeonRewardEntry> {
    const level = getRealmStageLevel(mapRealm, '初期');
    const context = { mapRealm, playerRealm, dangerScore: 20, difficultyTier };
    const planned = planInquiryVisitReward(seed, locationId, level, context);
    if (planned.key !== key && key.startsWith('inquiry:visit:')) {
      return this.entryFrom(planned.key, 'exploration', seed, level, context, tx);
    }
    return this.entryFrom(planned.key, 'exploration', seed, level, context, tx);
  }

  private materializeBattle(
    seed: number,
    battleId: string,
    mapRealm: RealmType,
    playerRealm: RealmType,
    difficultyTier: ReturnType<typeof resolveDungeonMapConfig>['difficultyTier'],
    tx: DbTransaction,
  ) {
    const level = getRealmStageLevel(mapRealm, '初期');
    return this.entryFrom(
      inquiryBattleKey(battleId),
      'battle',
      seed,
      level,
      { mapRealm, playerRealm, dangerScore: 20, difficultyTier },
      tx,
    );
  }

  private materializeCompletion(
    seed: number,
    mapRealm: RealmType,
    playerRealm: RealmType,
    difficultyTier: ReturnType<typeof resolveDungeonMapConfig>['difficultyTier'],
    tx: DbTransaction,
  ) {
    const level = getRealmStageLevel(mapRealm, '初期');
    return this.entryFrom(
      'inquiry:completion',
      'completion',
      seed,
      level,
      { mapRealm, playerRealm, dangerScore: 20, difficultyTier },
      tx,
    );
  }

  private async entryFrom(
    key: string,
    source: 'exploration' | 'battle' | 'completion',
    seed: number,
    level: number,
    context: {
      mapRealm: RealmType;
      playerRealm: RealmType;
      dangerScore: number;
      difficultyTier: ReturnType<typeof resolveDungeonMapConfig>['difficultyTier'];
    },
    tx: DbTransaction,
  ): Promise<DungeonRewardEntry> {
    const planned =
      source === 'battle'
        ? planInquiryBattleReward(seed, key.slice('inquiry:battle:'.length), level, context)
        : source === 'completion'
          ? planInquiryCompletionReward(seed, level, context)
          : planInquiryVisitReward(
              seed,
              key.startsWith('inquiry:visit:') ? key.slice('inquiry:visit:'.length) : key,
              level,
              context,
            );
    const plan = planned.plan;
    const materials = await generateRealmMaterials(
      plan.materialRealm,
      plan.materialCount,
      plan.materialSeed,
      true,
      tx,
      DUNGEON_MATERIAL_QUALITY_CHANCE_BY_REALM[plan.materialRealm],
    );
    return {
      key,
      ...planned.resources,
      items: [
        ...plan.items,
        ...materials.map((material) => ({
          definitionId: 'material.v1',
          quantity: 1,
          instanceData: MaterialFactsSchema.parse({
            name: material.name,
            type: material.type,
            rank: material.rank,
            element: material.element ?? null,
            description: material.description ?? '',
          }),
        })),
      ],
    };
  }

  private narrationJob(
    row: InquiryRow,
    play: InquiryPlay,
    progress: InquiryProgress,
    key: string,
  ): InquiryNarrationJob | null {
    if (!row.caseFile || row.narrations?.[key]) return null;
    const facts = inquiryNarrativeFacts(play, row.caseFile, progress, key);
    return {
      cultivatorId: row.cultivatorId,
      runId: row.id,
      revision: row.revision,
      key,
      fallback: facts.fallback,
      lines: facts.lines,
      play,
    };
  }

  private playFor(caseFile: InquiryCaseFile) {
    const play = getInquiryPlay(caseFile.playId);
    if (!play) fail('这场探查的玩法配置已经不在', 409);
    return play;
  }

  private progressFor(play: InquiryPlay, raw: InquiryProgress): InquiryProgress {
    return {
      locationId: raw.locationId || play.startLocationId,
      knownClueIds: raw.knownClueIds ?? [],
      heldItemIds: raw.heldItemIds ?? [],
      visitedLocationIds: raw.visitedLocationIds ?? [play.startLocationId],
      inspectedObjectIds: raw.inspectedObjectIds ?? [],
      unlockedObjectIds: raw.unlockedObjectIds ?? [],
      openedObjectIds: raw.openedObjectIds ?? [],
      heardTopicIds: raw.heardTopicIds ?? [],
      heardHintIds: raw.heardHintIds ?? [],
      paidLifespan: raw.paidLifespan ?? false,
      foughtContainer: raw.foughtContainer ?? false,
      pendingBattle: raw.pendingBattle ?? false,
    };
  }

  private applyBodyLoss(
    condition: CultivatorCondition,
    type: 'hp_loss' | 'mp_loss',
    fraction: number,
  ): CultivatorCondition {
    const maxHp = condition.resources.hp.max ?? condition.resources.hp.current ?? 1;
    const maxMp = condition.resources.mp.max ?? condition.resources.mp.current ?? 0;
    const hpLoss = type === 'hp_loss' ? Math.floor(maxHp * fraction) : 0;
    const mpLoss = type === 'mp_loss' ? Math.floor(maxMp * fraction) : 0;
    return ConditionService.applyCombatV6Resources(condition, {
      hp: Math.max(1, (condition.resources.hp.current ?? maxHp) - hpLoss),
      mp: Math.max(0, (condition.resources.mp.current ?? maxMp) - mpLoss),
      maxHp,
      maxMp,
    });
  }

  private applyBodyAbsolute(
    condition: CultivatorCondition,
    resources: { hp: number; mp: number; maxHp: number; maxMp: number },
  ) {
    return ConditionService.applyCombatV6Resources(condition, {
      hp: Math.max(1, resources.hp),
      mp: resources.mp,
      maxHp: resources.maxHp,
      maxMp: resources.maxMp,
    });
  }

  private pushSettlement(
    changes: ResourceChangeDescriptor[],
    settlement: {
      spiritStones?: number;
      reputation?: number;
      lifespan?: number;
      cultivationProgress?: ResourceChangeDescriptor extends never ? never : unknown;
    } | undefined,
  ) {
    if (!settlement) return;
    const currency: Record<string, number> = {};
    if (settlement.spiritStones !== undefined) currency.spiritStones = settlement.spiritStones;
    if (settlement.reputation !== undefined) currency.reputation = settlement.reputation;
    if (Object.keys(currency).length) {
      changes.push({
        resourceTopic: 'player.currency',
        eventType: 'currency.changed',
        operation: 'merge',
        payload: currency,
      });
    }
    if (settlement.lifespan !== undefined) {
      changes.push({
        resourceTopic: 'player.profile',
        eventType: 'profile.changed',
        operation: 'merge',
        payload: { cultivator: { lifespan: settlement.lifespan } },
      });
    }
    if (settlement.cultivationProgress) {
      changes.push({
        resourceTopic: 'player.progress',
        eventType: 'progress.changed',
        operation: 'replace',
        payload: settlement.cultivationProgress as CultivationProgress,
      });
    }
  }

  private mapOf(mapNodeId: string) {
    const map = getMapNode(mapNodeId);
    if (!map || !('realm_requirement' in map)) fail('秘境地图无效', 400);
    return map;
  }

  private async openRow(cultivatorId: string) {
    const [row] = await this.database
      .select()
      .from(inquiryRuns)
      .where(and(eq(inquiryRuns.cultivatorId, cultivatorId), isNull(inquiryRuns.endedAt)))
      .orderBy(desc(inquiryRuns.updatedAt))
      .limit(1);
    return row ?? null;
  }

  private async lockRow(
    cultivatorId: string,
    runId: string,
    expectedRevision: number,
    tx: DbTransaction,
  ) {
    const [row] = await tx
      .select()
      .from(inquiryRuns)
      .where(and(eq(inquiryRuns.id, runId), eq(inquiryRuns.cultivatorId, cultivatorId)))
      .limit(1);
    if (!row || row.endedAt) fail('这场探查已经结束', 404);
    if (row.revision !== expectedRevision) fail('洞府里的情况已经变了，请刷新', 409);
    return row;
  }

  private present(row: InquiryRow): InquiryView {
    const caseFile = row.caseFile;
    if (!caseFile?.playId || !getInquiryPlay(caseFile.playId)) {
      return {
        runId: row.id,
        status: row.status,
        revision: row.revision,
        mapNodeId: row.mapNodeId,
        locationId: row.progress?.locationId || '',
        prose: '这场探查的案卷已经过期，可以离开。',
        actions: [],
        clues: [],
        notes: [],
        heldItemIds: [],
        verdictReady: false,
        verdict: null,
        feedback: row.narrations?.feedback,
        settlement: row.status === 'FINISHED' ? (row.settlement as InquiryView['settlement']) : null,
      };
    }
    const play = this.playFor(caseFile);
    const progress = this.progressFor(play, row.progress);
    const verdictReady = inquiryVerdictReady(play, progress);
    const settlement = row.settlement as InquiryView['settlement'];
    return {
      runId: row.id,
      status: row.status,
      revision: row.revision,
      mapNodeId: row.mapNodeId,
      locationId: progress.locationId,
      prose:
        (row.narrations?.focus && row.narrations[row.narrations.focus]) ||
        inquiryCanonicalProse(
          play,
          caseFile,
          row.narrations?.focus || `move:${progress.locationId}`,
        ),
      actions: row.status === 'INVESTIGATING' ? inquiryActions(progress, play, caseFile) : [],
      verdictReady,
      verdict: verdictReady
        ? {
            answerLabel: play.verdict.answerLabel,
            answers: play.verdict.answers.map((answer) => ({
              id: answer.id,
              label: caseFile.objects[answer.id]?.name || answer.label,
            })),
            containerLabel: play.verdict.containerLabel,
            containerOptions: play.verdict.containerOptions,
          }
        : null,
      clues: progress.knownClueIds.map((id) => ({
        id,
        title: caseFile.clues[id]?.title ?? id,
        body: caseFile.clues[id]?.body ?? '',
      })),
      notes: [
        ...progress.heardTopicIds.flatMap((topicId) => {
          const npc = play.npcs.find((item) => item.topics.some((topic) => topic.id === topicId));
          const topic = npc?.topics.find((item) => item.id === topicId);
          if (!npc || !topic) return [];
          return [{ id: topic.id, title: npc.name, body: topic.line }];
        }),
        ...progress.heardHintIds.flatMap((hintId) => {
          const hint = play.hints.find((item) => item.id === hintId);
          if (!hint) return [];
          return [{ id: hint.id, title: '提示', body: hint.text }];
        }),
      ],
      heldItemIds: progress.heldItemIds,
      feedback: row.narrations?.feedback,
      settlement: row.status === 'FINISHED' ? settlement : null,
    };
  }
}
