import type { MysteryCaseFile } from '@daoyou/game-domain/dungeon/mystery';
import { z } from 'zod';

/** 云游剧本管理：库存总览的一行（一个节点 × 案型的库存位）。 */
export interface AdminDungeonSlot {
  mapNodeId: string;
  nodeName: string;
  templateId: string;
  templateName: string;
  /** 当前生成版本的在用剧本数。 */
  active: number;
  queued: number;
  running: number;
  lastFailure: { at: string; error: string | null } | null;
}

export interface AdminDungeonSlotsView {
  slots: AdminDungeonSlot[];
  /** 全服 queued + running 任务数。 */
  pendingTotal: number;
  /** 每个地图节点的待生成上限；同一节点逐个生成，不同节点并发。 */
  maxPendingPerNode: number;
  warmupPerSlot: number;
  generatorVersion: number;
}

export interface AdminDungeonScenarioRow {
  id: string;
  mapNodeId: string;
  nodeName: string;
  templateId: string;
  templateName: string;
  title: string;
  variant: string;
  source: 'generated' | 'seed';
  generatorVersion: number;
  status: 'active' | 'retired';
  reviewIssueCount: number;
  playCount: number;
  completionCount: number;
  averageScore: number | null;
  createdAt: string;
  retiredAt: string | null;
}

export interface AdminDungeonScenarioList {
  rows: AdminDungeonScenarioRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminDungeonScenarioDetail extends AdminDungeonScenarioRow {
  caseFile: MysteryCaseFile;
  generation: Record<string, unknown> | null;
  /** 案型模板里的人物身份名与结案题题面，按 id 查。 */
  labels: { roles: Record<string, string>; questions: Record<string, string> };
}

export interface AdminDungeonJob {
  id: string;
  mapNodeId: string;
  nodeName: string;
  templateId: string;
  templateName: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  reason: string;
  attempts: number;
  error: string | null;
  scenarioId: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

/** 投递结果：enqueued 已排队，skipped 因所在节点队列已满跳过；pendingTotal 为投递后全服待生成数。 */
export interface AdminDungeonEnqueueResult {
  enqueued: number;
  skipped: number;
  pendingTotal: number;
}

const Id = z.string().min(1).max(100);

export const AdminDungeonScenarioListQuerySchema = z.strictObject({
  mapNodeId: Id.optional(),
  templateId: Id.optional(),
  status: z.enum(['active', 'retired']).optional(),
  source: z.enum(['generated', 'seed']).optional(),
  generatorVersion: z.coerce.number().int().min(1).max(1000).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

export const AdminDungeonJobsQuerySchema = z.strictObject({
  status: z.enum(['queued', 'running', 'succeeded', 'failed']).optional(),
});

export const AdminDungeonScenarioStatusSchema = z.strictObject({
  status: z.enum(['active', 'retired']),
});

export const AdminDungeonRestockSchema = z.strictObject({
  mapNodeId: Id,
  templateId: Id,
});

export const AdminDungeonWarmupSchema = z.strictObject({
  perSlot: z.number().int().min(1).max(10),
});
