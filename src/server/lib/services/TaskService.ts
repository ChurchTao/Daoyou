import { assertConsumableSpec } from '@shared/lib/consumables';
import { getBreakthroughPillLabel } from '@shared/lib/breakthroughPill';
import { withPlayerAbilityStrategySettings } from '@shared/lib/battle/abilityStrategyInit';
import { isConditionStatusActive } from '@shared/lib/condition';
import { getConditionStatusTemplate } from '@shared/lib/conditionStatusRegistry';
import type { BattleRecord } from '@shared/types/battle';
import type { ConditionStatusKey } from '@shared/types/condition';
import type {
  Consumable,
  CultivationProgress,
  Cultivator,
} from '@shared/types/cultivator';
import type { MailAttachment } from '@shared/types/mail';
import {
  QUALITY_ORDER,
  REALM_ORDER,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type {
  TaskActionLink,
  TaskEvent,
  TaskInstance,
  TaskInstanceMetadata,
  TaskObjectiveDefinition,
  TaskObjectiveProgress,
  TaskObjectiveState,
  TaskProgressSnapshot,
  TaskStageProgress,
  TaskStatus,
} from '@shared/types/task';
import {
  findActiveCultivatorRecordById,
  listCultivatorBreakthroughPills,
  listCultivatorTechniqueQualities,
  type CultivatorBreakthroughPillRecord,
} from '@server/lib/repositories/cultivatorRepository';
import { getNextStage } from '@server/utils/breakthroughCalculator';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import { simulateBattleV5 } from './simulateBattleV5';
import { getCultivatorByIdUnsafe, getInventory } from './cultivatorService';
import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import {
  createCultivatorTask,
  clearTaskRewardGrantPendingForKey,
  findCultivatorTaskById,
  findCultivatorTaskByDefinition,
  listCultivatorTasks,
  markTaskRewardGrantPendingForKey,
  markTaskRewardGrantedForKey,
  type CultivatorTaskRecord,
  updateCultivatorTask,
} from '@server/lib/repositories/taskRepository';
import {
  getDailyTaskDefinitions,
  getTutorialTaskDefinitions,
  getTaskDefinition,
  getBreakthroughTaskDefinition,
  getBreakthroughTaskDefinitionByTransition,
  getTaskChallengeProfile,
  type BreakthroughTaskDefinition,
  type DailyTaskDefinition,
  type RuntimeTaskDefinition,
  type TutorialTaskDefinition,
  type TaskStageTemplate,
} from './taskDefinitions';
import { MailService } from './MailService';

interface TaskServiceWriteOptions {
  tx?: DbTransaction;
}

interface TaskSyncOptions extends TaskServiceWriteOptions {
  hideCompletedBreakthrough?: boolean;
}

export interface TaskChallengeResult {
  task: TaskInstance;
  battleResult: BattleRecord;
  isWin: boolean;
  challengeTitle: string;
}

export interface MajorBreakthroughGate {
  required: boolean;
  blocked: boolean;
  task: TaskInstance | null;
}

export interface TaskRewardClaimResult {
  task: TaskInstance;
  rewards: string[];
}

interface TaskProgressContext {
  cultivatorId: string;
  realm: RealmType;
  realmStage: Cultivator['realm_stage'];
  cultivationProgress: Cultivator['cultivation_progress'];
  condition: Cultivator['condition'];
  highestTechniqueQuality: Quality | null;
  breakthroughPillQuantities: Partial<Record<RealmType, number>>;
  genericBreakthroughPillQuantity: number;
}

const TASK_RESET_TIMEZONE = 'Asia/Shanghai';

function getTaskResetKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TASK_RESET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function getDailyTaskSpiritStoneReward(realm: RealmType): number {
  return (REALM_ORDER[realm] + 1) * 1000;
}

function resolveTaskRewardAttachments(
  definition: Pick<RuntimeTaskDefinition, 'category' | 'rewardAttachments'>,
  realm?: RealmType,
): MailAttachment[] {
  const attachments = definition.rewardAttachments ?? [];
  if (definition.category !== 'daily' || !realm) {
    return attachments;
  }

  const spiritStoneReward = getDailyTaskSpiritStoneReward(realm);
  return attachments.map((attachment) =>
    attachment.type === 'spirit_stones'
      ? {
          ...attachment,
          quantity: spiritStoneReward,
        }
      : attachment,
  );
}

function resolveTaskRewardMailAttachments(
  definition: Pick<
    RuntimeTaskDefinition,
    'category' | 'rewardAttachments' | 'difficulty'
  > & {
    rewardCultivationExp?: number;
  },
  realm?: RealmType,
  realmStage?: Cultivator['realm_stage'],
  expCap?: number,
): MailAttachment[] {
  const attachments = [...resolveTaskRewardAttachments(definition, realm)];

  if (definition.category === 'tutorial' && definition.rewardCultivationExp) {
    attachments.unshift({
      type: 'cultivation_exp',
      name: '修为',
      quantity: definition.rewardCultivationExp,
    });
  }

  if (definition.category === 'daily' && definition.difficulty && realm && realmStage) {
    const expCalc = calculateSceneCultivationExp('daily_task', {
      realm,
      realmStage,
      expCap,
      difficulty: definition.difficulty,
    });

    if (expCalc.baseExp > 0) {
      attachments.push({
        type: 'cultivation_exp',
        name: '修为',
        quantity: expCalc.baseExp,
      });
    }
  }

  return attachments;
}

function formatTaskRewardSummary(
  definition: Pick<RuntimeTaskDefinition, 'category' | 'rewardAttachments' | 'difficulty'> & {
    rewardCultivationExp?: number;
  },
  realm?: RealmType,
  realmStage?: Cultivator['realm_stage'],
  expCap?: number,
): string[] {
  return resolveTaskRewardMailAttachments(
    definition,
    realm,
    realmStage,
    expCap,
  ).map((attachment) => {
    switch (attachment.type) {
      case 'spirit_stones':
      case 'cultivation_exp':
      case 'comprehension_insight':
        return `${attachment.name} x${attachment.quantity}`;
      default:
        return `${attachment.name} x${attachment.quantity}`;
    }
  });
}

function createTaskMetadata(
  definition: RuntimeTaskDefinition,
  resetKey: string,
  realm?: RealmType,
  realmStage?: Cultivator['realm_stage'],
  expCap?: number,
): TaskInstanceMetadata {
  const rewardSummary = formatTaskRewardSummary(definition, realm, realmStage, expCap);

  if (definition.category === 'daily') {
    return {
      dailyKind: definition.dailyKind,
      resetKey,
      rewardSummary: rewardSummary.length > 0 ? rewardSummary : undefined,
    };
  }

  if (definition.category === 'tutorial') {
    return {
      rewardSummary: rewardSummary.length > 0 ? rewardSummary : undefined,
    };
  }

  return {
    fromRealm: definition.fromRealm,
    toRealm: definition.toRealm,
    taskTheme: definition.taskTheme,
    rewardSummary: rewardSummary.length > 0 ? rewardSummary : undefined,
  };
}

function buildDefaultObjectiveStates(
  definition: RuntimeTaskDefinition,
): TaskObjectiveState[] {
  return definition.stages.flatMap((stage) =>
    stage.objectives.map((objective) => createDefaultObjectiveState(objective.id)),
  );
}

function getStatusName(statusKey: ConditionStatusKey): string {
  return getConditionStatusTemplate(statusKey)?.name ?? statusKey;
}

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.toISOString();
}

function isKnownQuality(value: string | null | undefined): value is Quality {
  return Boolean(value && value in QUALITY_ORDER);
}

function getHighestTechniqueQuality(qualities: Array<Quality | null | undefined>): Quality | null {
  let current: Quality | null = null;

  for (const quality of qualities) {
    if (!quality) {
      continue;
    }

    if (!current || QUALITY_ORDER[quality] > QUALITY_ORDER[current]) {
      current = quality;
    }
  }

  return current;
}

function hasActiveStatus(
  context: TaskProgressContext,
  statusKey: Extract<
    ConditionStatusKey,
    'breakthrough_focus' | 'protect_meridians' | 'clear_mind'
  >,
): boolean {
  return (context.condition?.statuses ?? []).some(
    (status) => status.key === statusKey && isConditionStatusActive(status),
  );
}

function buildBreakthroughPillInventory(
  pills: Array<
    | Pick<Consumable, 'quantity' | 'spec'>
    | CultivatorBreakthroughPillRecord
  >,
): Pick<
  TaskProgressContext,
  'breakthroughPillQuantities' | 'genericBreakthroughPillQuantity'
> {
  const breakthroughPillQuantities: Partial<Record<RealmType, number>> = {};
  let genericBreakthroughPillQuantity = 0;

  for (const pill of pills) {
    const spec = assertConsumableSpec(pill.spec);
    if (spec.kind !== 'pill' || spec.family !== 'breakthrough') {
      continue;
    }

    const quantity = Math.max(0, pill.quantity ?? 0);
    if (quantity <= 0) {
      continue;
    }

    const targetRealm = spec.alchemyMeta.breakthroughTargetRealm;
    if (targetRealm) {
      breakthroughPillQuantities[targetRealm] =
        (breakthroughPillQuantities[targetRealm] ?? 0) + quantity;
      continue;
    }

    genericBreakthroughPillQuantity += quantity;
  }

  return {
    breakthroughPillQuantities,
    genericBreakthroughPillQuantity,
  };
}

function getPreparedBreakthroughPillQuantity(
  context: TaskProgressContext,
  targetRealm: RealmType,
): number {
  return (
    (context.breakthroughPillQuantities[targetRealm] ?? 0) +
    context.genericBreakthroughPillQuantity
  );
}

function createTaskProgressContextFromCultivator(
  cultivator: Cultivator,
): TaskProgressContext {
  if (!cultivator.id) {
    throw new Error('角色缺少有效标识');
  }

  return {
    cultivatorId: cultivator.id,
    realm: cultivator.realm,
    realmStage: cultivator.realm_stage,
    cultivationProgress: cultivator.cultivation_progress,
    condition: cultivator.condition,
    highestTechniqueQuality: getHighestTechniqueQuality(
      (cultivator.cultivations ?? []).map((cultivation) => cultivation.quality ?? null),
    ),
    ...buildBreakthroughPillInventory(cultivator.inventory.consumables),
  };
}

async function loadTaskProgressContextOrThrow(
  cultivatorId: string,
  options: TaskServiceWriteOptions = {},
): Promise<TaskProgressContext> {
  const q = options.tx;
  const [record, techniqueRows, breakthroughPills] = await Promise.all([
    findActiveCultivatorRecordById(cultivatorId, q),
    listCultivatorTechniqueQualities(cultivatorId, q),
    listCultivatorBreakthroughPills(cultivatorId, q),
  ]);

  if (!record) {
    throw new Error('角色不存在');
  }

  return {
    cultivatorId: record.id,
    realm: record.realm as RealmType,
    realmStage: record.realm_stage as Cultivator['realm_stage'],
    cultivationProgress: getOrInitCultivationProgress(
      ((record.cultivation_progress ?? {}) as CultivationProgress),
      record.realm as Cultivator['realm'],
      record.realm_stage as Cultivator['realm_stage'],
    ),
    condition:
      (record.condition as Cultivator['condition'] | null | undefined) ?? undefined,
    highestTechniqueQuality: getHighestTechniqueQuality(
      techniqueRows.map((row) => (isKnownQuality(row.quality) ? row.quality : null)),
    ),
    ...buildBreakthroughPillInventory(breakthroughPills),
  };
}

function normalizeObjectiveStates(
  input: unknown,
): TaskObjectiveState[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const item = entry as Partial<TaskObjectiveState>;
    if (typeof item.objectiveId !== 'string') {
      return [];
    }

    return [
      {
        objectiveId: item.objectiveId,
        completed: item.completed === true,
        progressValue:
          typeof item.progressValue === 'number' ? item.progressValue : undefined,
        completedAt:
          typeof item.completedAt === 'string' ? item.completedAt : undefined,
        updatedAt:
          typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
      },
    ];
  });
}

function createDefaultObjectiveState(objectiveId: string): TaskObjectiveState {
  return {
    objectiveId,
    completed: false,
  };
}

function completeObjectiveState(
  state: TaskObjectiveState | undefined,
  progressValue: number | undefined,
  nowIso: string,
): TaskObjectiveState {
  return {
    objectiveId: state?.objectiveId ?? '',
    completed: true,
    progressValue,
    completedAt: state?.completedAt ?? nowIso,
    updatedAt: nowIso,
  };
}

function serializeObjectiveStates(states: TaskObjectiveState[]): string {
  return JSON.stringify(
    states.map((state) => ({
      ...state,
      progressValue:
        typeof state.progressValue === 'number'
          ? Number(state.progressValue.toFixed(4))
          : undefined,
    })),
  );
}

function resolveObjectiveProgress(
  definition: TaskObjectiveDefinition,
  state: TaskObjectiveState | undefined,
  context: TaskProgressContext,
  nowIso: string,
): {
  objectiveState: TaskObjectiveState;
  progress: TaskObjectiveProgress;
} {
  switch (definition.kind) {
    case 'auto_complete': {
      const nextState = completeObjectiveState(
        {
          ...createDefaultObjectiveState(definition.id),
          ...state,
          objectiveId: definition.id,
        },
        1,
        nowIso,
      );

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed: true,
          progressText: '已备妥',
        },
      };
    }
    case 'craft_breakthrough_pill': {
      const preparedPillQuantity = getPreparedBreakthroughPillQuantity(
        context,
        definition.targetRealm,
      );
      const completed = state?.completed === true || preparedPillQuantity > 0;
      const nextState = completed
        ? completeObjectiveState(
            {
              ...createDefaultObjectiveState(definition.id),
              ...state,
              objectiveId: definition.id,
            },
            preparedPillQuantity || state?.progressValue || 1,
            nowIso,
          )
        : {
            ...createDefaultObjectiveState(definition.id),
            ...state,
            objectiveId: definition.id,
            progressValue: preparedPillQuantity,
            updatedAt: nowIso,
          };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: completed
            ? `已备妥${getBreakthroughPillLabel(definition.targetRealm)}`
            : `尚未炼成${getBreakthroughPillLabel(definition.targetRealm)}`,
        },
      };
    }
    case 'insight_at_least': {
      const currentInsight =
        context.cultivationProgress?.comprehension_insight ?? 0;
      const completed = currentInsight >= definition.threshold;
      const nextState = completed
        ? completeObjectiveState(
            {
              ...createDefaultObjectiveState(definition.id),
              ...state,
              objectiveId: definition.id,
            },
            currentInsight,
            nowIso,
          )
        : {
            ...createDefaultObjectiveState(definition.id),
            ...state,
            objectiveId: definition.id,
            progressValue: currentInsight,
            updatedAt: nowIso,
          };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: `${currentInsight}/${definition.threshold}`,
        },
      };
    }
    case 'technique_quality_at_least': {
      const currentQuality = context.highestTechniqueQuality;
      const completed =
        currentQuality !== null &&
        QUALITY_ORDER[currentQuality] >= QUALITY_ORDER[definition.threshold];
      const nextState = completed
        ? completeObjectiveState(
            {
              ...createDefaultObjectiveState(definition.id),
              ...state,
              objectiveId: definition.id,
            },
            QUALITY_ORDER[currentQuality!],
            nowIso,
          )
        : {
            ...createDefaultObjectiveState(definition.id),
            ...state,
            objectiveId: definition.id,
            progressValue:
              currentQuality !== null ? QUALITY_ORDER[currentQuality] : 0,
            updatedAt: nowIso,
          };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: `${currentQuality ?? '未得'} / 至少 ${definition.threshold}`,
        },
      };
    }
    case 'status_active': {
      const completed = hasActiveStatus(context, definition.statusKey);
      const nextState = completed
        ? completeObjectiveState(
            {
              ...createDefaultObjectiveState(definition.id),
              ...state,
              objectiveId: definition.id,
            },
            1,
            nowIso,
          )
        : {
            ...createDefaultObjectiveState(definition.id),
            ...state,
            objectiveId: definition.id,
            progressValue: 0,
            updatedAt: nowIso,
          };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: completed
            ? `已备妥${getStatusName(definition.statusKey)}`
            : `尚未备妥${getStatusName(definition.statusKey)}`,
        },
      };
    }
    case 'complete_dungeon': {
      const completed = state?.completed === true;
      const nextState = {
        ...createDefaultObjectiveState(definition.id),
        ...state,
        objectiveId: definition.id,
      };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: completed
            ? `已通过${definition.mapNodeName}`
            : `尚未通过${definition.mapNodeName}`,
        },
      };
    }
    case 'win_task_challenge': {
      const completed = state?.completed === true;
      const challengeProfile = getTaskChallengeProfile(definition.challengeId);
      const challengeTitle = challengeProfile?.title ?? '试炼';
      const nextState = {
        ...createDefaultObjectiveState(definition.id),
        ...state,
        objectiveId: definition.id,
      };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: completed
            ? `已渡过${challengeTitle}`
            : `尚未战胜${challengeTitle}`,
        },
      };
    }
    case 'event_count': {
      const currentValue = Math.max(0, state?.progressValue ?? 0);
      const completed = state?.completed === true || currentValue >= definition.threshold;
      const nextState = completed
        ? completeObjectiveState(
            {
              ...createDefaultObjectiveState(definition.id),
              ...state,
              objectiveId: definition.id,
            },
            Math.max(currentValue, definition.threshold),
            nowIso,
          )
        : {
            ...createDefaultObjectiveState(definition.id),
            ...state,
            objectiveId: definition.id,
            progressValue: currentValue,
            updatedAt: nowIso,
          };

      return {
        objectiveState: nextState,
        progress: {
          id: definition.id,
          kind: definition.kind,
          title: definition.title,
          description: definition.description,
          completed,
          progressText: `${Math.min(currentValue, definition.threshold)}/${definition.threshold}`,
        },
      };
    }
  }
}

function resolveStageLinks(
  taskId: string,
  stage: TaskStageTemplate,
  objectiveProgresses: TaskObjectiveProgress[],
): TaskActionLink[] {
  const pendingDungeonObjective = stage.objectives.find((objective) => {
    if (objective.kind !== 'complete_dungeon') return false;
    return objectiveProgresses.some(
      (progress) => progress.id === objective.id && !progress.completed,
    );
  });

  return stage.links.map((link) => {
    switch (link.kind) {
      case 'alchemy':
        return { label: link.label, href: '/game/craft/alchemy' };
      case 'cultivator':
        return { label: link.label, href: '/game/cultivator' };
      case 'dungeon':
        return {
          label: link.label,
          href:
            pendingDungeonObjective?.kind === 'complete_dungeon'
              ? `/game/map?intent=dungeon&nodeId=${encodeURIComponent(
                  pendingDungeonObjective.mapNodeId,
                )}`
              : '/game/map?intent=dungeon',
        };
      case 'inn':
        return { label: link.label, href: '/game/inn' };
      case 'market':
        return { label: link.label, href: '/game/map?intent=market' };
      case 'inventory':
        return { label: link.label, href: '/game/inventory' };
      case 'ranking':
        return { label: link.label, href: '/game/rankings' };
      case 'retreat':
        return { label: link.label, href: '/game/retreat' };
      case 'training':
        return { label: link.label, href: '/game/training-room' };
      case 'challenge':
        return { label: link.label, href: `/game/tasks/${taskId}/challenge` };
      case 'tasks':
      default:
        return { label: link.label, href: '/game/tasks' };
    }
  });
}

function definitionHandlesEvent(
  definition: RuntimeTaskDefinition,
  event: TaskEvent,
): boolean {
  return definition.stages.some((stage) =>
    stage.objectives.some(
      (objective) => objective.kind === 'event_count' && objective.event === event,
    ),
  );
}

function withoutRewardGrantPendingKey(
  metadata: TaskInstanceMetadata,
): TaskInstanceMetadata {
  const next = { ...metadata };
  delete next.rewardGrantPendingKey;
  return next;
}

async function grantDailyTaskRewardIfNeeded(
  cultivatorId: string,
  context: TaskProgressContext,
  record: CultivatorTaskRecord,
  definition: DailyTaskDefinition,
  task: TaskInstance,
  resetKey: string,
  options: TaskServiceWriteOptions = {},
): Promise<boolean> {
  const grantKey = `${definition.id}:${resetKey}`;
  if (task.metadata.rewardGrantedKey === grantKey) {
    return false;
  }

  const pendingRecord = await markTaskRewardGrantPendingForKey(
    record.id,
    cultivatorId,
    grantKey,
    {
      ...task.metadata,
      rewardGrantPendingKey: grantKey,
    },
    options.tx,
  );
  if (!pendingRecord) {
    return false;
  }

  const pendingMetadata = pendingRecord.metadata as TaskInstanceMetadata;
  const grantMetadata = pendingMetadata;

  try {
    const rewardAttachments = resolveTaskRewardMailAttachments(
      definition,
      context.realm,
      context.realmStage,
      context.cultivationProgress?.exp_cap,
    );

    if (rewardAttachments.length > 0) {
      await MailService.sendMail(
        cultivatorId,
        `【今日日常】${task.snapshot.title}`,
        `道友已办妥"${task.snapshot.title}"，这份薄礼已由传音玉简送达，请查收附件。`,
        rewardAttachments,
        'reward',
        options.tx,
      );
    }

    await markTaskRewardGrantedForKey(
      record.id,
      cultivatorId,
      grantKey,
      {
        ...withoutRewardGrantPendingKey(grantMetadata),
        rewardGrantedKey: grantKey,
      },
      options.tx,
    );
    return true;
  } catch (error) {
    await clearTaskRewardGrantPendingForKey(
      record.id,
      cultivatorId,
      grantKey,
      withoutRewardGrantPendingKey(grantMetadata),
      options.tx,
    );
    throw error;
  }
}

function buildTaskSnapshot(
  record: CultivatorTaskRecord,
  definition: RuntimeTaskDefinition,
  context: TaskProgressContext,
  nowIso: string,
): {
  snapshot: TaskProgressSnapshot;
  objectiveStates: TaskObjectiveState[];
  status: TaskStatus;
  currentStage: string | null;
} {
  const currentStates = normalizeObjectiveStates(record.objectives);
  const stateMap = new Map(currentStates.map((state) => [state.objectiveId, state]));
  const nextStates: TaskObjectiveState[] = [];
  const stageProgresses: TaskStageProgress[] = [];

  for (const stage of definition.stages) {
    const objectiveProgresses = stage.objectives.map((objective) => {
      const resolved = resolveObjectiveProgress(
        objective,
        stateMap.get(objective.id),
        context,
        nowIso,
      );
      nextStates.push(resolved.objectiveState);
      return resolved.progress;
    });
    const stageCompleted = objectiveProgresses.every((objective) => objective.completed);
    stageProgresses.push({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      completionText: stage.completionText,
      completed: stageCompleted,
      current: false,
      links: resolveStageLinks(record.id, stage, objectiveProgresses),
      objectives: objectiveProgresses,
    });
  }

  const currentStageIndex = stageProgresses.findIndex((stage) => !stage.completed);
  const isCompleted = currentStageIndex === -1;
  const resolvedCurrentStageIndex = isCompleted ? stageProgresses.length : currentStageIndex;
  const currentStageId = isCompleted ? null : stageProgresses[currentStageIndex].id;

  if (!isCompleted && currentStageIndex >= 0) {
    stageProgresses[currentStageIndex].current = true;
  }

  const missingRequirements =
    !isCompleted && currentStageIndex >= 0
      ? stageProgresses[currentStageIndex].objectives
          .filter((objective) => !objective.completed)
          .map((objective) => `${objective.title}：${objective.progressText}`)
      : [];
  const rewardSummary = formatTaskRewardSummary(
    definition,
    context.realm,
    context.realmStage,
    context.cultivationProgress?.exp_cap,
  );

  return {
    snapshot: {
      title: definition.title,
      summary: definition.summary,
      fromRealm:
        definition.category === 'breakthrough_major'
          ? definition.fromRealm
          : undefined,
      toRealm:
        definition.category === 'breakthrough_major'
          ? definition.toRealm
          : undefined,
      isCompleted,
      currentStageId,
      currentStageIndex: resolvedCurrentStageIndex,
      totalStages: definition.stages.length,
      missingRequirements,
      dailyKind:
        definition.category === 'daily' ? definition.dailyKind : undefined,
      resetKey:
        definition.category === 'daily'
          ? (record.metadata as TaskInstanceMetadata | null | undefined)?.resetKey
          : undefined,
      rewardSummary: rewardSummary.length > 0 ? rewardSummary : undefined,
      rewardClaimedAt:
        (record.metadata as TaskInstanceMetadata | null | undefined)
          ?.rewardClaimedAt,
      stages: stageProgresses,
    },
    objectiveStates: nextStates,
    status: isCompleted ? 'completed' : 'active',
    currentStage: currentStageId,
  };
}

function mapTaskInstance(
  record: CultivatorTaskRecord,
  snapshot: TaskProgressSnapshot,
): TaskInstance {
  return {
    id: record.id,
    definitionId: record.definitionId,
    category: record.category as TaskInstance['category'],
    status: record.status as TaskStatus,
    currentStage: record.currentStage,
    objectives: normalizeObjectiveStates(record.objectives),
    metadata: record.metadata as TaskInstanceMetadata,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt?.toISOString() ?? record.createdAt.toISOString(),
    completedAt: toIsoString(record.completedAt),
    snapshot,
  };
}

function getCurrentMajorDefinition(
  context: Pick<TaskProgressContext, 'realm' | 'realmStage'>,
): BreakthroughTaskDefinition | null {
  if (context.realmStage !== '圆满') {
    return null;
  }

  const nextStage = getNextStage(context.realm, context.realmStage);
  if (!nextStage || nextStage.realm === context.realm) {
    return null;
  }

  return getBreakthroughTaskDefinitionByTransition(
    context.realm,
    nextStage.realm,
  );
}

function isOutdatedBreakthroughDefinition(
  context: Pick<TaskProgressContext, 'realm'>,
  definition: RuntimeTaskDefinition,
): definition is BreakthroughTaskDefinition {
  return (
    definition.category === 'breakthrough_major' &&
    REALM_ORDER[context.realm] >= REALM_ORDER[definition.toRealm]
  );
}

function buildArchivedBreakthroughObjectiveState(
  objective: TaskObjectiveDefinition,
  nowIso: string,
): TaskObjectiveState {
  return completeObjectiveState(
    {
      ...createDefaultObjectiveState(objective.id),
      objectiveId: objective.id,
    },
    1,
    nowIso,
  );
}

function buildArchivedBreakthroughSnapshot(
  definition: BreakthroughTaskDefinition,
): TaskProgressSnapshot {
  return {
    title: definition.title,
    summary: definition.summary,
    fromRealm: definition.fromRealm,
    toRealm: definition.toRealm,
    isCompleted: true,
    currentStageId: null,
    currentStageIndex: definition.stages.length,
    totalStages: definition.stages.length,
    missingRequirements: [],
    rewardSummary: undefined,
    stages: definition.stages.map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      completionText: stage.completionText,
      completed: true,
      current: false,
      links: [],
      objectives: stage.objectives.map((objective) => ({
        id: objective.id,
        kind: objective.kind,
        title: objective.title,
        description: objective.description,
        completed: true,
        progressText: '已随境界推进归档',
      })),
    })),
  };
}

async function archiveOutdatedBreakthroughRecord(
  context: TaskProgressContext,
  record: CultivatorTaskRecord,
  definition: BreakthroughTaskDefinition,
  nowIso: string,
  options: TaskServiceWriteOptions = {},
): Promise<TaskInstance> {
  const archivedObjectiveStates = definition.stages.flatMap((stage) =>
    stage.objectives.map((objective) =>
      buildArchivedBreakthroughObjectiveState(objective, nowIso),
    ),
  );
  const completedAt = record.completedAt ?? new Date(nowIso);
  const needsArchiveUpdate =
    record.status !== 'completed' ||
    record.currentStage !== null ||
    !record.completedAt ||
    serializeObjectiveStates(normalizeObjectiveStates(record.objectives)) !==
      serializeObjectiveStates(archivedObjectiveStates);

  const archivedRecord =
    needsArchiveUpdate
      ? (await updateCultivatorTask(record.id, context.cultivatorId, {
          status: 'completed',
          currentStage: null,
          objectives: archivedObjectiveStates,
          completedAt,
        }, options.tx)) ?? {
          ...record,
          status: 'completed',
          currentStage: null,
          objectives: archivedObjectiveStates,
          completedAt,
        }
      : record;

  return mapTaskInstance(
    archivedRecord,
    buildArchivedBreakthroughSnapshot(definition),
  );
}

function isDailyTaskDefinition(
  definition: RuntimeTaskDefinition,
): definition is DailyTaskDefinition {
  return definition.category === 'daily';
}

function isTutorialTaskDefinition(
  definition: RuntimeTaskDefinition,
): definition is TutorialTaskDefinition {
  return definition.category === 'tutorial';
}

async function createTaskRecordIfMissing(
  context: TaskProgressContext,
  definition: RuntimeTaskDefinition,
  options: TaskServiceWriteOptions = {},
): Promise<void> {
  const existing = await findCultivatorTaskByDefinition(
    context.cultivatorId,
    definition.id,
    options.tx,
  );
  if (existing) {
    return;
  }

  const resetKey = getTaskResetKey();

  try {
    await createCultivatorTask({
      cultivatorId: context.cultivatorId,
      definitionId: definition.id,
      category: definition.category,
      status: 'active',
      currentStage: definition.stages[0]?.id ?? null,
      objectives: buildDefaultObjectiveStates(definition),
      metadata: createTaskMetadata(
        definition,
        resetKey,
        context.realm,
        context.realmStage,
        context.cultivationProgress?.exp_cap,
      ),
    }, options.tx);
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      (error as { code?: string }).code !== '23505'
    ) {
      throw error;
    }
  }
}

async function ensureCurrentTaskRecords(
  context: TaskProgressContext,
  options: TaskServiceWriteOptions = {},
): Promise<void> {
  const currentMajorDefinition = getCurrentMajorDefinition(context);
  const definitions: RuntimeTaskDefinition[] = [
    ...getTutorialTaskDefinitions(),
    ...getDailyTaskDefinitions(),
    ...(currentMajorDefinition ? [currentMajorDefinition] : []),
  ];

  for (const definition of definitions) {
    await createTaskRecordIfMissing(context, definition, options);
  }
}

async function resetRepeatableTaskRecordIfNeeded(
  context: TaskProgressContext,
  record: CultivatorTaskRecord,
  definition: RuntimeTaskDefinition,
  options: TaskServiceWriteOptions = {},
): Promise<CultivatorTaskRecord> {
  if (!isDailyTaskDefinition(definition) || definition.repeat !== 'daily') {
    return record;
  }

  const currentResetKey = getTaskResetKey();
  const metadata = (record.metadata as TaskInstanceMetadata | null | undefined) ?? {};

  if (metadata.resetKey === currentResetKey) {
    return record;
  }

  const nextObjectives = buildDefaultObjectiveStates(definition);
  const nextMetadata = createTaskMetadata(
    definition,
    currentResetKey,
    context.realm,
    context.realmStage,
    context.cultivationProgress?.exp_cap,
  );

  return (
    (await updateCultivatorTask(record.id, context.cultivatorId, {
      status: 'active',
      currentStage: definition.stages[0]?.id ?? null,
      objectives: nextObjectives,
      metadata: nextMetadata,
      completedAt: null,
    }, options.tx)) ?? {
      ...record,
      status: 'active',
      currentStage: definition.stages[0]?.id ?? null,
      objectives: nextObjectives,
      metadata: nextMetadata,
      completedAt: null,
    }
  );
}

async function syncTaskRecord(
  context: TaskProgressContext,
  record: CultivatorTaskRecord,
  options: TaskServiceWriteOptions = {},
): Promise<TaskInstance> {
  const definition = getTaskDefinition(record.definitionId);
  if (!definition) {
    throw new Error(`缺少任务定义：${record.definitionId}`);
  }

  const nowIso = new Date().toISOString();
  if (isOutdatedBreakthroughDefinition(context, definition)) {
    return archiveOutdatedBreakthroughRecord(
      context,
      record,
      definition,
      nowIso,
      options,
    );
  }

  const preparedRecord = await resetRepeatableTaskRecordIfNeeded(
    context,
    record,
    definition,
    options,
  );
  const resolved = buildTaskSnapshot(preparedRecord, definition, context, nowIso);
  const serializedCurrent = serializeObjectiveStates(
    normalizeObjectiveStates(preparedRecord.objectives),
  );
  const serializedNext = serializeObjectiveStates(resolved.objectiveStates);
  const currentMetadata =
    (preparedRecord.metadata as TaskInstanceMetadata | null | undefined) ??
    undefined;
  const nextMetadata = isDailyTaskDefinition(definition)
    ? {
        ...createTaskMetadata(
          definition,
          currentMetadata?.resetKey ?? getTaskResetKey(),
          context.realm,
          context.realmStage,
          context.cultivationProgress?.exp_cap,
        ),
        rewardGrantPendingKey: currentMetadata?.rewardGrantPendingKey,
        rewardExpGrantedKey: currentMetadata?.rewardExpGrantedKey,
        rewardGrantedKey: currentMetadata?.rewardGrantedKey,
      }
    : currentMetadata;
  const metadataNeedsUpdate =
    JSON.stringify(currentMetadata) !== JSON.stringify(nextMetadata);
  const needsUpdate =
    serializedCurrent !== serializedNext ||
    preparedRecord.status !== resolved.status ||
    preparedRecord.currentStage !== resolved.currentStage ||
    metadataNeedsUpdate ||
    (resolved.status === 'completed' && !preparedRecord.completedAt);

  const nextRecord =
    needsUpdate
      ? (await updateCultivatorTask(preparedRecord.id, context.cultivatorId, {
          status: resolved.status,
          currentStage: resolved.currentStage,
          objectives: resolved.objectiveStates,
          completedAt:
            resolved.status === 'completed'
              ? preparedRecord.completedAt ?? new Date(nowIso)
              : null,
        ...(metadataNeedsUpdate ? { metadata: nextMetadata } : {}),
        }, options.tx)) ?? {
          ...preparedRecord,
          status: resolved.status,
          currentStage: resolved.currentStage,
          objectives: resolved.objectiveStates,
          completedAt:
            resolved.status === 'completed'
              ? preparedRecord.completedAt ?? new Date(nowIso)
              : null,
          ...(metadataNeedsUpdate ? { metadata: nextMetadata } : {}),
        }
      : preparedRecord;

  return mapTaskInstance(nextRecord, resolved.snapshot);
}

async function loadBundleOrThrow(cultivatorId: string): Promise<Cultivator> {
  const bundle = await getCultivatorByIdUnsafe(cultivatorId);
  if (!bundle) {
    throw new Error('角色不存在');
  }

  return bundle.cultivator;
}

async function syncCultivatorTasksWithContext(
  context: TaskProgressContext,
  options: TaskSyncOptions = {},
): Promise<TaskInstance[]> {
  await ensureCurrentTaskRecords(context, options);
  const records = await listCultivatorTasks(context.cultivatorId, {
    q: options.tx,
  });
  const tasks = await Promise.all(
    records.map((record) => syncTaskRecord(context, record, options)),
  );

  if (!options.hideCompletedBreakthrough) {
    return tasks;
  }

  const currentMajorDefinition = getCurrentMajorDefinition(context);
  return tasks.filter(
    (task) =>
      !(
        task.category === 'breakthrough_major' &&
        task.status === 'completed' &&
        task.definitionId !== currentMajorDefinition?.id
      ),
  );
}

async function resolveMissingTaskRewardAttachments(
  userId: string,
  cultivatorId: string,
  attachments: MailAttachment[],
): Promise<MailAttachment[]> {
  const inventory = await getInventory(userId, cultivatorId);
  const missing: MailAttachment[] = [];

  for (const attachment of attachments) {
    switch (attachment.type) {
      case 'material': {
        const ownedQuantity = inventory.materials
          .filter(
            (material) =>
              material.name === attachment.name &&
              (!attachment.data ||
                !('rank' in attachment.data) ||
                material.rank === attachment.data.rank),
          )
          .reduce((sum, material) => sum + material.quantity, 0);
        const deficit = attachment.quantity - ownedQuantity;
        if (deficit > 0) {
          missing.push({ ...attachment, quantity: deficit });
        }
        break;
      }
      case 'consumable': {
        const ownedQuantity = inventory.consumables
          .filter(
            (consumable) =>
              consumable.name === attachment.name &&
              (!attachment.data ||
                !('quality' in attachment.data) ||
                consumable.quality === attachment.data.quality),
          )
          .reduce((sum, consumable) => sum + consumable.quantity, 0);
        const deficit = attachment.quantity - ownedQuantity;
        if (deficit > 0) {
          missing.push({ ...attachment, quantity: deficit });
        }
        break;
      }
      case 'artifact': {
        const ownedQuantity = inventory.artifacts.filter(
          (artifact) => artifact.name === attachment.name,
        ).length;
        const deficit = attachment.quantity - ownedQuantity;
        if (deficit > 0) {
          missing.push({ ...attachment, quantity: deficit });
        }
        break;
      }
      case 'spirit_stones':
      case 'cultivation_exp':
      case 'comprehension_insight':
        break;
    }
  }

  return missing;
}

export const TaskService = {
  async syncCultivatorTasks(cultivatorId: string): Promise<TaskInstance[]> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId);
    return syncCultivatorTasksWithContext(context);
  },

  async listCultivatorTasks(
    cultivatorId: string,
    status?: TaskStatus,
  ): Promise<TaskInstance[]> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId);
    const tasks = await syncCultivatorTasksWithContext(context, {
      hideCompletedBreakthrough: true,
    });
    if (!status) {
      return tasks;
    }

    return tasks.filter((task) => task.status === status);
  },

  async getCultivatorTask(
    cultivatorId: string,
    taskId: string,
  ): Promise<TaskInstance | null> {
    const tasks = await this.syncCultivatorTasks(cultivatorId);
    return tasks.find((task) => task.id === taskId) ?? null;
  },

  async getMajorBreakthroughGate(cultivatorId: string): Promise<MajorBreakthroughGate> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId);
    const definition = getCurrentMajorDefinition(context);
    if (!definition) {
      return {
        required: false,
        blocked: false,
        task: null,
      };
    }

    const tasks = await syncCultivatorTasksWithContext(context);
    const task = tasks.find((item) => item.definitionId === definition.id) ?? null;

    return {
      required: true,
      blocked: task?.status !== 'completed',
      task,
    };
  },

  async recordDungeonCompletion(
    cultivatorId: string,
    mapNodeId: string,
    options: TaskServiceWriteOptions = {},
  ): Promise<TaskInstance[]> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId, options);
    await ensureCurrentTaskRecords(context, options);
    const records = await listCultivatorTasks(cultivatorId, {
      status: 'active',
      q: options.tx,
    });
    const nowIso = new Date().toISOString();

    for (const record of records) {
      const definition = getBreakthroughTaskDefinition(record.definitionId);
      if (!definition) {
        continue;
      }

      const nextStates = normalizeObjectiveStates(record.objectives);
      let changed = false;

      for (const stage of definition.stages) {
        for (const objective of stage.objectives) {
          if (
            objective.kind !== 'complete_dungeon' ||
            objective.mapNodeId !== mapNodeId
          ) {
            continue;
          }

          const stateIndex = nextStates.findIndex(
            (state) => state.objectiveId === objective.id,
          );
          const currentState =
            stateIndex >= 0 ? nextStates[stateIndex] : createDefaultObjectiveState(objective.id);
          if (currentState.completed) {
            continue;
          }

          const completedState = completeObjectiveState(
            {
              ...currentState,
              objectiveId: objective.id,
            },
            1,
            nowIso,
          );
          if (stateIndex >= 0) {
            nextStates[stateIndex] = completedState;
          } else {
            nextStates.push(completedState);
          }
          changed = true;
        }
      }

      if (changed) {
        await updateCultivatorTask(record.id, cultivatorId, {
          objectives: nextStates,
        }, options.tx);
      }
    }

    return syncCultivatorTasksWithContext(context, options);
  },

  async recordTaskEvent(
    cultivatorId: string,
    event: TaskEvent,
    options: TaskServiceWriteOptions = {},
  ): Promise<TaskInstance[]> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId, options);
    await ensureCurrentTaskRecords(context, options);

    const records = await listCultivatorTasks(cultivatorId, {
      q: options.tx,
    });
    const currentResetKey = getTaskResetKey();
    let changedAny = false;

    for (const originalRecord of records) {
      const definition = getTaskDefinition(originalRecord.definitionId);
      if (
        !definition ||
        (!isDailyTaskDefinition(definition) &&
          !isTutorialTaskDefinition(definition))
      ) {
        continue;
      }

      let record = isDailyTaskDefinition(definition)
        ? await resetRepeatableTaskRecordIfNeeded(
            context,
            originalRecord,
            definition,
            options,
          )
        : originalRecord;

      if (
        isDailyTaskDefinition(definition) &&
        record.status === 'completed' &&
        (record.metadata as TaskInstanceMetadata | null | undefined)?.resetKey ===
          currentResetKey &&
        definitionHandlesEvent(definition, event)
      ) {
        const task = await syncTaskRecord(context, record, options);
        const granted = await grantDailyTaskRewardIfNeeded(
          cultivatorId,
          context,
          record,
          definition,
          task,
          currentResetKey,
          options,
        );
        changedAny = changedAny || granted;
        continue;
      }

      if (record.status !== 'active') {
        continue;
      }

      const nextStates = normalizeObjectiveStates(record.objectives);
      let changed = false;

      for (const stage of definition.stages) {
        for (const objective of stage.objectives) {
          if (
            objective.kind !== 'event_count' ||
            objective.event !== event
          ) {
            continue;
          }

          const stateIndex = nextStates.findIndex(
            (state) => state.objectiveId === objective.id,
          );
          const currentState =
            stateIndex >= 0
              ? nextStates[stateIndex]
              : createDefaultObjectiveState(objective.id);

          if (currentState.completed) {
            continue;
          }

          const nextProgress = Math.min(
            objective.threshold,
            Math.max(0, currentState.progressValue ?? 0) + 1,
          );
          const completed = nextProgress >= objective.threshold;
          const nextState = completed
            ? completeObjectiveState(
                {
                  ...currentState,
                  objectiveId: objective.id,
                },
                nextProgress,
                new Date().toISOString(),
              )
            : {
                ...createDefaultObjectiveState(objective.id),
                ...currentState,
                objectiveId: objective.id,
                progressValue: nextProgress,
                updatedAt: new Date().toISOString(),
              };

          if (stateIndex >= 0) {
            nextStates[stateIndex] = nextState;
          } else {
            nextStates.push(nextState);
          }
          changed = true;
        }
      }

      if (!changed) {
        continue;
      }

      const nextMetadata = createTaskMetadata(
        definition,
        currentResetKey,
        context.realm,
        context.realmStage,
        context.cultivationProgress?.exp_cap,
      );
      record =
        (await updateCultivatorTask(record.id, cultivatorId, {
          objectives: nextStates,
          metadata: nextMetadata,
        }, options.tx)) ?? {
          ...record,
          objectives: nextStates,
          metadata: nextMetadata,
        };
      const task = await syncTaskRecord(context, record, options);
      changedAny = true;

      if (task.status === 'completed' && isDailyTaskDefinition(definition)) {
        await grantDailyTaskRewardIfNeeded(
          cultivatorId,
          context,
          record,
          definition,
          task,
          currentResetKey,
          options,
        );
      }
    }

    if (!changedAny) {
      return syncCultivatorTasksWithContext(context, options);
    }

    return syncCultivatorTasksWithContext(context, options);
  },

  async claimTaskReward(
    userId: string,
    cultivatorId: string,
    taskId: string,
    options: { tx?: DbTransaction } = {},
  ): Promise<TaskRewardClaimResult> {
    const context = await loadTaskProgressContextOrThrow(cultivatorId);
    await ensureCurrentTaskRecords(context);
    let task = await this.getCultivatorTask(cultivatorId, taskId);
    if (!task) {
      throw new Error('任务不存在');
    }

    const definition = getTaskDefinition(task.definitionId);
    if (!definition || !isTutorialTaskDefinition(definition)) {
      throw new Error('该任务没有可手动领取的新手奖励');
    }
    if (task.status !== 'completed') {
      throw new Error('任务尚未完成');
    }
    const grantKey = `tutorial:${definition.id}`;
    const alreadyClaimed = Boolean(task.metadata.rewardClaimedAt);
    if (task.metadata.rewardGrantedKey === grantKey) {
      throw new Error('奖励已经领取');
    }

    const rewardAttachments = resolveTaskRewardAttachments(definition, context.realm);
    const mailAttachments = alreadyClaimed
      ? await resolveMissingTaskRewardAttachments(
          userId,
          cultivatorId,
          rewardAttachments,
        )
      : resolveTaskRewardMailAttachments(
          definition,
          context.realm,
          context.realmStage,
          context.cultivationProgress?.exp_cap,
        );
    const rewards = formatTaskRewardSummary(
      definition,
      context.realm,
      context.realmStage,
      context.cultivationProgress?.exp_cap,
    );
    const claimedAt = new Date().toISOString();
    const currentMetadata = task.metadata;
    const claimedTask = task;

    let grantedRecord: CultivatorTaskRecord | null = null;
    const grantReward = async (tx: DbTransaction) => {
      const pendingRecord = await markTaskRewardGrantPendingForKey(
        taskId,
        cultivatorId,
        grantKey,
        {
          ...currentMetadata,
          rewardClaimedAt: currentMetadata.rewardClaimedAt ?? claimedAt,
          rewardSummary: rewards,
          rewardGrantPendingKey: grantKey,
        },
        tx,
      );
      if (!pendingRecord) {
        throw new Error('奖励已经领取');
      }

      if (mailAttachments.length > 0) {
        await MailService.sendMail(
          cultivatorId,
          `【任务奖励】${claimedTask.snapshot.title}`,
          `道友已完成"${claimedTask.snapshot.title}"，任务奖励已封入附件，请前往传音符诏领取。`,
          mailAttachments,
          'reward',
          tx,
        );
      }

      grantedRecord = await markTaskRewardGrantedForKey(
        taskId,
        cultivatorId,
        grantKey,
        {
          ...withoutRewardGrantPendingKey(
            pendingRecord.metadata as TaskInstanceMetadata,
          ),
          rewardGrantedKey: grantKey,
        },
        tx,
      );
      if (!grantedRecord) {
        throw new Error('奖励已经领取');
      }
    };

    if (options.tx) {
      await grantReward(options.tx);
    } else {
      await getExecutor().transaction(grantReward);
    }

    if (!grantedRecord) {
      throw new Error('奖励已经领取');
    }

    const updatedSnapshot = buildTaskSnapshot(
      grantedRecord,
      definition,
      context,
      new Date().toISOString(),
    );
    task = mapTaskInstance(grantedRecord, updatedSnapshot.snapshot);

    return {
      task,
      rewards,
    };
  },

  async runTaskChallenge(
    cultivatorId: string,
    taskId: string,
  ): Promise<TaskChallengeResult> {
    const cultivator = await loadBundleOrThrow(cultivatorId);
    const context = createTaskProgressContextFromCultivator(cultivator);
    await ensureCurrentTaskRecords(context);
    const record = await findCultivatorTaskById(cultivatorId, taskId);
    if (!record) {
      throw new Error('任务不存在');
    }

    const definition = getBreakthroughTaskDefinition(record.definitionId);
    if (!definition) {
      throw new Error('任务定义不存在');
    }

    const preview = buildTaskSnapshot(
      record,
      definition,
      context,
      new Date().toISOString(),
    );
    const currentStage = preview.snapshot.stages.find((stage) => stage.current);
    if (!currentStage) {
      throw new Error('当前任务已无可执行试炼');
    }

    const challengeObjective = definition.stages
      .find((stage) => stage.id === currentStage.id)
      ?.objectives.find(
        (objective) =>
          objective.kind === 'win_task_challenge' &&
          !preview.snapshot.stages
            .find((stage) => stage.id === currentStage.id)
            ?.objectives.find((item) => item.id === objective.id)?.completed,
      );

    if (!challengeObjective || challengeObjective.kind !== 'win_task_challenge') {
      throw new Error('当前阶段没有可执行的试炼挑战');
    }

    const challengeProfile = getTaskChallengeProfile(challengeObjective.challengeId);
    if (!challengeProfile) {
      throw new Error('试炼配置不存在');
    }

    const opponent = await challengeProfile.buildOpponent(cultivator);
    const battleResult = simulateBattleV5(
      cultivator,
      opponent,
      withPlayerAbilityStrategySettings(undefined, cultivator),
    );
    const isWin = battleResult.winner.id === cultivator.id;

    if (isWin) {
      const nextStates = normalizeObjectiveStates(record.objectives);
      const nowIso = new Date().toISOString();
      const stateIndex = nextStates.findIndex(
        (state) => state.objectiveId === challengeObjective.id,
      );
      const currentState =
        stateIndex >= 0
          ? nextStates[stateIndex]
          : createDefaultObjectiveState(challengeObjective.id);
      const completedState = completeObjectiveState(
        {
          ...currentState,
          objectiveId: challengeObjective.id,
        },
        1,
        nowIso,
      );

      if (stateIndex >= 0) {
        nextStates[stateIndex] = completedState;
      } else {
        nextStates.push(completedState);
      }

      await updateCultivatorTask(record.id, cultivatorId, {
        objectives: nextStates,
      });
    }

    const task = (await syncCultivatorTasksWithContext(context)).find(
      (item) => item.id === taskId,
    );
    if (!task) {
      throw new Error('任务同步失败');
    }

    return {
      task,
      battleResult,
      isWin,
      challengeTitle: challengeProfile.title,
    };
  },
};
