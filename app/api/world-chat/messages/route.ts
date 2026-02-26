import { withActiveCultivator } from '@/lib/api/withAuth';
import {
  createMessage,
  listLatestMessages,
  listMessages,
} from '@/lib/repositories/worldChatRepository';
import { checkAndAcquireCooldown } from '@/lib/redis/worldChatLimiter';
import {
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@/lib/services/cultivatorService';
import type {
  ItemShowcaseSnapshotMap,
  WorldChatItemShowcasePayload,
} from '@/types/world-chat';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const TextMessageSchema = z.object({
  messageType: z.literal('text'),
  textContent: z.string().trim().optional(),
  payload: z
    .object({
      text: z.string().trim(),
    })
    .optional(),
});

const ItemShowcaseMessageSchema = z.object({
  messageType: z.literal('item_showcase'),
  itemType: z.enum(['artifact', 'material', 'consumable']),
  itemId: z.string().trim().min(1),
  textContent: z.string().trim().max(100).optional(),
  payload: z
    .object({
      text: z.string().trim().max(100),
    })
    .optional(),
});

const CreateMessageSchema = z.discriminatedUnion('messageType', [
  TextMessageSchema,
  ItemShowcaseMessageSchema,
]);

function countChars(input: string): number {
  return Array.from(input).length;
}

function normalizeText(payload: z.infer<typeof TextMessageSchema>): string {
  return (payload.textContent ?? payload.payload?.text ?? '').trim();
}

async function buildItemShowcasePayload(params: {
  userId: string;
  cultivatorId: string;
  itemType: 'artifact' | 'material' | 'consumable';
  itemId: string;
  text?: string;
}): Promise<WorldChatItemShowcasePayload | null> {
  const { userId, cultivatorId, itemType, itemId, text } = params;
  const showcaseText = text?.trim() || undefined;

  if (itemType === 'artifact') {
    const artifacts = await getCultivatorArtifacts(userId, cultivatorId);
    const item = artifacts.find((artifact) => artifact.id === itemId);
    if (!item) return null;
    const snapshot: ItemShowcaseSnapshotMap['artifact'] = {
      id: item.id || itemId,
      name: item.name,
      slot: item.slot,
      element: item.element,
      quality: item.quality,
      required_realm: item.required_realm,
      description: item.description,
      effects: item.effects,
    };
    return { itemType, itemId, snapshot, text: showcaseText };
  }

  if (itemType === 'material') {
    const materials = await getCultivatorMaterials(userId, cultivatorId);
    const item = materials.find((material) => material.id === itemId);
    if (!item) return null;
    const snapshot: ItemShowcaseSnapshotMap['material'] = {
      id: item.id || itemId,
      name: item.name,
      type: item.type,
      rank: item.rank,
      element: item.element,
      description: item.description,
      quantity: item.quantity,
    };
    return { itemType, itemId, snapshot, text: showcaseText };
  }

  const consumables = await getCultivatorConsumables(userId, cultivatorId);
  const item = consumables.find((consumable) => consumable.id === itemId);
  if (!item) return null;
  const snapshot: ItemShowcaseSnapshotMap['consumable'] = {
    id: item.id || itemId,
    name: item.name,
    type: item.type,
    quality: item.quality,
    effects: item.effects,
    quantity: item.quantity,
    description: item.description,
  };
  return { itemType, itemId, snapshot, text: showcaseText };
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const limitRaw = searchParams.get('limit');

  if (limitRaw) {
    const limitParsed = parseInt(limitRaw, 10);
    const limit = Number.isNaN(limitParsed)
      ? 5
      : Math.min(50, Math.max(1, limitParsed));
    const messages = await listLatestMessages(limit);
    return NextResponse.json({
      success: true,
      data: messages,
    });
  }

  const pageRaw = parseInt(searchParams.get('page') || '1', 10);
  const pageSizeRaw = parseInt(searchParams.get('pageSize') || '20', 10);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? 20
    : Math.min(100, Math.max(1, pageSizeRaw));

  const result = await listMessages({ page, pageSize });
  return NextResponse.json({
    success: true,
    data: result.messages,
    pagination: {
      page,
      pageSize,
      hasMore: result.hasMore,
    },
  });
}

export const POST = withActiveCultivator(
  async (req: NextRequest, { user, cultivator }) => {
    try {
      const body = await req.json();
      const parsed = CreateMessageSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: '消息格式错误，仅支持文本或道具展示消息' },
          { status: 400 },
        );
      }

      const cooldown = await checkAndAcquireCooldown(cultivator.id);
      if (!cooldown.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `请 ${cooldown.remainingSeconds} 秒后再发言`,
            remainingSeconds: cooldown.remainingSeconds,
          },
          { status: 429 },
        );
      }

      const senderBase = {
        senderUserId: user.id,
        senderCultivatorId: cultivator.id,
        senderName: cultivator.name,
        senderRealm: cultivator.realm,
        senderRealmStage: cultivator.realm_stage,
      };

      let message;
      if (parsed.data.messageType === 'text') {
        const text = normalizeText(parsed.data);
        const textLength = countChars(text);
        if (textLength < 1 || textLength > 100) {
          return NextResponse.json(
            { success: false, error: '消息长度需在 1-100 字之间' },
            { status: 400 },
          );
        }
        message = await createMessage({
          ...senderBase,
          messageType: 'text',
          textContent: text,
          payload: { text },
        });
      } else {
        const showcaseText = (
          parsed.data.textContent ?? parsed.data.payload?.text ?? ''
        ).trim();
        const showcaseTextLength = countChars(showcaseText);
        if (showcaseTextLength > 100) {
          return NextResponse.json(
            { success: false, error: '附言长度需在 100 字以内' },
            { status: 400 },
          );
        }
        const payload = await buildItemShowcasePayload({
          userId: user.id,
          cultivatorId: cultivator.id,
          itemType: parsed.data.itemType,
          itemId: parsed.data.itemId,
          text: showcaseText,
        });
        if (!payload) {
          return NextResponse.json(
            { success: false, error: '道具不存在或不属于当前角色' },
            { status: 404 },
          );
        }
        message = await createMessage({
          ...senderBase,
          messageType: 'item_showcase',
          textContent: payload.text,
          payload,
        });
      }

      return NextResponse.json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error('Create world chat message error:', error);
      return NextResponse.json(
        { success: false, error: '发送失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
