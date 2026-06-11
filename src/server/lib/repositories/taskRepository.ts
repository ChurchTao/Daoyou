import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import type {
  TaskCategory,
  TaskInstanceMetadata,
  TaskObjectiveState,
  TaskStatus,
} from '@shared/types/task';
import { and, asc, eq, sql } from 'drizzle-orm';

export type CultivatorTaskRecord = typeof schema.cultivatorTasks.$inferSelect;

function getTaskExecutor(q?: DbExecutor | DbTransaction) {
  return q ?? getExecutor();
}

export async function listCultivatorTasks(
  cultivatorId: string,
  options: {
    status?: TaskStatus;
    hideCompletedBreakthrough?: boolean;
    q?: DbExecutor | DbTransaction;
  } = {},
): Promise<CultivatorTaskRecord[]> {
  const executor = getTaskExecutor(options.q);
  const clauses = [eq(schema.cultivatorTasks.cultivatorId, cultivatorId)];
  if (options.status) {
    clauses.push(eq(schema.cultivatorTasks.status, options.status));
  }
  if (options.hideCompletedBreakthrough) {
    clauses.push(
      sql`not (${schema.cultivatorTasks.category} = 'breakthrough_major' and ${schema.cultivatorTasks.status} = 'completed')`,
    );
  }

  return executor
    .select()
    .from(schema.cultivatorTasks)
    .where(and(...clauses))
    .orderBy(asc(schema.cultivatorTasks.createdAt));
}

export async function findCultivatorTaskById(
  cultivatorId: string,
  taskId: string,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .select()
    .from(schema.cultivatorTasks)
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function findCultivatorTaskByDefinition(
  cultivatorId: string,
  definitionId: string,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .select()
    .from(schema.cultivatorTasks)
    .where(
      and(
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
        eq(schema.cultivatorTasks.definitionId, definitionId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function createCultivatorTask(
  input: {
    cultivatorId: string;
    definitionId: string;
    category: TaskCategory;
    status: TaskStatus;
    currentStage: string | null;
    objectives: TaskObjectiveState[];
    metadata: TaskInstanceMetadata;
  },
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .insert(schema.cultivatorTasks)
    .values({
      cultivatorId: input.cultivatorId,
      definitionId: input.definitionId,
      category: input.category,
      status: input.status,
      currentStage: input.currentStage,
      objectives: input.objectives,
      metadata: input.metadata,
    })
    .returning();

  return rows[0];
}

export async function updateCultivatorTask(
  taskId: string,
  cultivatorId: string,
  input: {
    status?: TaskStatus;
    currentStage?: string | null;
    objectives?: TaskObjectiveState[];
    metadata?: TaskInstanceMetadata;
    completedAt?: Date | null;
  },
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .update(schema.cultivatorTasks)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.currentStage !== undefined
        ? { currentStage: input.currentStage }
        : {}),
      ...(input.objectives !== undefined ? { objectives: input.objectives } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.completedAt !== undefined ? { completedAt: input.completedAt } : {}),
    })
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function markTutorialTaskRewardClaimed(
  taskId: string,
  cultivatorId: string,
  metadata: TaskInstanceMetadata,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .update(schema.cultivatorTasks)
    .set({ metadata })
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
        sql`${schema.cultivatorTasks.metadata}->>'rewardClaimedAt' is null`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function markTaskRewardGrantedForKey(
  taskId: string,
  cultivatorId: string,
  grantKey: string,
  metadata: TaskInstanceMetadata,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .update(schema.cultivatorTasks)
    .set({ metadata })
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
        sql`coalesce(${schema.cultivatorTasks.metadata}->>'rewardGrantedKey', '') <> ${grantKey}`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function markTaskRewardGrantPendingForKey(
  taskId: string,
  cultivatorId: string,
  grantKey: string,
  metadata: TaskInstanceMetadata,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .update(schema.cultivatorTasks)
    .set({ metadata })
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
        sql`coalesce(${schema.cultivatorTasks.metadata}->>'rewardGrantedKey', '') <> ${grantKey}`,
        sql`coalesce(${schema.cultivatorTasks.metadata}->>'rewardGrantPendingKey', '') <> ${grantKey}`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}

export async function clearTaskRewardGrantPendingForKey(
  taskId: string,
  cultivatorId: string,
  grantKey: string,
  metadata: TaskInstanceMetadata,
  q?: DbExecutor | DbTransaction,
): Promise<CultivatorTaskRecord | null> {
  const executor = getTaskExecutor(q);
  const rows = await executor
    .update(schema.cultivatorTasks)
    .set({ metadata })
    .where(
      and(
        eq(schema.cultivatorTasks.id, taskId),
        eq(schema.cultivatorTasks.cultivatorId, cultivatorId),
        sql`${schema.cultivatorTasks.metadata}->>'rewardGrantPendingKey' = ${grantKey}`,
        sql`coalesce(${schema.cultivatorTasks.metadata}->>'rewardGrantedKey', '') <> ${grantKey}`,
      ),
    )
    .returning();

  return rows[0] ?? null;
}
