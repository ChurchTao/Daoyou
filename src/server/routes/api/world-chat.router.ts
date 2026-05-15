import {
  getValidatedJson,
  getValidatedQuery,
  requireActiveCultivator,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  createMessage,
  listLatestMessages,
  listMessages,
} from '@server/lib/repositories/worldChatRepository';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter';
import {
  getCultivatorArtifacts,
  getCultivatorConsumables,
  getCultivatorMaterials,
} from '@server/lib/services/cultivatorService';
import {
  WorldChatCreateMessageSchema,
  WorldChatListQuerySchema,
  type WorldChatCreateMessageRequest,
  type WorldChatListQuery,
} from '@shared/contracts/world-chat';
import type {
  ItemShowcaseSnapshotMap,
  WorldChatItemShowcasePayload,
} from '@shared/types/world-chat';
import { Hono } from 'hono';

function countChars(input: string): number {
  return Array.from(input).length;
}

function normalizeText(
  payload: Extract<WorldChatCreateMessageRequest, { messageType: 'text' }>,
): string {
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
      description: item.description,
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
    quantity: item.quantity,
    description: item.description,
    spec: item.spec,
  };
  return { itemType, itemId, snapshot, text: showcaseText };
}

const router = new Hono<AppEnv>();

router.get(
  '/messages',
  validateQuery(WorldChatListQuerySchema),
  async (c) => {
    const { limit, page, pageSize } = getValidatedQuery<WorldChatListQuery>(c);

    if (limit) {
      const messages = await listLatestMessages(limit);
      return c.json({
        success: true,
        data: messages,
      });
    }

    const currentPage = page || 1;
    const currentPageSize = pageSize || 20;
    const result = await listMessages({
      page: currentPage,
      pageSize: currentPageSize,
    });

    return c.json({
      success: true,
      data: result.messages,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        hasMore: result.hasMore,
      },
    });
  },
);

router.post(
  '/messages',
  requireActiveCultivator(),
  validateJson(WorldChatCreateMessageSchema),
  async (c) => {
    try {
      const user = c.get('user');
      const cultivator = c.get('cultivator');
      if (!user || !cultivator) {
        return c.json({ success: false, error: '未授权访问' }, 401);
      }

      const parsed = getValidatedJson<WorldChatCreateMessageRequest>(c);
      const cooldown = await checkAndAcquireCooldown(cultivator.id);
      if (!cooldown.allowed) {
        return c.json(
          {
            success: false,
            error: `请 ${cooldown.remainingSeconds} 秒后再发言`,
            remainingSeconds: cooldown.remainingSeconds,
          },
          429,
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
      if (parsed.messageType === 'text') {
        const text = normalizeText(parsed);
        const textLength = countChars(text);
        if (textLength < 1 || textLength > 100) {
          return c.json({ success: false, error: '消息长度需在 1-100 字之间' }, 400);
        }

        message = await createMessage({
          ...senderBase,
          messageType: 'text',
          textContent: text,
          payload: { text },
        });
      } else {
        const showcaseText = (parsed.textContent ?? parsed.payload?.text ?? '').trim();
        if (countChars(showcaseText) > 100) {
          return c.json({ success: false, error: '附言长度需在 100 字以内' }, 400);
        }

        const payload = await buildItemShowcasePayload({
          userId: user.id,
          cultivatorId: cultivator.id,
          itemType: parsed.itemType,
          itemId: parsed.itemId,
          text: showcaseText,
        });

        if (!payload) {
          return c.json({ success: false, error: '道具不存在或不属于当前角色' }, 404);
        }

        message = await createMessage({
          ...senderBase,
          messageType: 'item_showcase',
          textContent: payload.text,
          payload,
        });
      }

      return c.json({
        success: true,
        data: message,
      });
    } catch (error) {
      console.error('Create world chat message error:', error);
      return c.json({ success: false, error: '发送失败，请稍后重试' }, 500);
    }
  },
);

export default router;
