import { db } from '@/lib/drizzle/db';
import { consumables } from '@/lib/drizzle/schema';
import type { TalismanConfig } from '@/types/cultivator';
import { randomUUID } from 'node:crypto';

export interface CreateTalismanOptions {
  cultivatorId: string;
  name: string;
  buffId: string;
  expiryDays?: number;
  maxUses?: number;
  description?: string;
}

/**
 * 创建符箓消耗品
 */
export async function createTalisman(
  options: CreateTalismanOptions,
): Promise<string> {
  const talismanConfig: TalismanConfig = {
    buffId: options.buffId,
    expiryDays: options.expiryDays ?? 3,
    maxUses: options.maxUses,
  };

  const id = randomUUID();

  await db.insert(consumables).values({
    id,
    cultivatorId: options.cultivatorId,
    name: options.name,
    type: '符箓',
    prompt: '',
    quality: '凡品',
    effects: [],
    quantity: 1,
    description: options.description,
    score: 0,
    details: talismanConfig,
  });

  return id;
}

/**
 * 批量创建符箓
 */
export async function createTalismans(
  cultivatorId: string,
  talismans: Omit<CreateTalismanOptions, 'cultivatorId'>[],
): Promise<string[]> {
  const ids: string[] = [];

  for (const t of talismans) {
    const id = await createTalisman({ ...t, cultivatorId });
    ids.push(id);
  }

  return ids;
}

// 预定义符箓模板
export const TALISMAN_TEMPLATES = {
  reshapeFate: {
    name: '重塑先天命格符',
    buffId: 'reshape_fate_talisman',
    expiryDays: 3,
    maxUses: 3,
    description: '使用后可在3天内重塑先天命格，最多随机3次',
  },
  drawGongfa: {
    name: '功法抽取符',
    buffId: 'draw_gongfa_talisman',
    expiryDays: 3,
    description: '使用后可在3天内抽取一本功法典籍（玄品及以上）',
  },
  drawSkill: {
    name: '神通抽取符',
    buffId: 'draw_skill_talisman',
    expiryDays: 3,
    description: '使用后可在3天内抽取一本神通典籍（玄品及以上）',
  },
} as const;
