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
    name: '天机逆命符',
    buffId: 'reshape_fate_talisman',
    expiryDays: 3,
    maxUses: 3,
    description:
      '以此符遮蔽天机，逆转先天之数。三日内可获三次推演命格之机，择优而栖。',
  },
  drawGongfa: {
    name: '悟道演法符',
    buffId: 'draw_gongfa_talisman',
    expiryDays: 3,
    description:
      '燃此符可神游太虚，感悟天地至理。三日内可得一次机缘，从虚空中领悟一部玄品以上功法典籍。',
  },
  drawSkill: {
    name: '神通衍化符',
    buffId: 'draw_skill_talisman',
    expiryDays: 3,
    description:
      '此符蕴含天地法则碎片。三日内可得一次机缘，衍化出一门玄品以上神通秘术。',
  },
} as const;
