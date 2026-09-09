import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { readCultivatorPublicIdentity } from '@server/lib/services/cultivator/CultivatorFactsReader';
import {
  getCultivatorConsumableById,
  getCultivatorMaterialById,
} from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import type { WorldChatCreateMessageRequest } from '@shared/contracts/world-chat';
import type {
  ItemShowcaseSnapshotMap,
  WorldChatItemShowcasePayload,
  WorldChatMessageChannel,
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@shared/types/world-chat';

export class ChatMessageApplicationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 429,
    readonly remainingSeconds?: number,
  ) {
    super(message);
  }
}

function countChars(input: string): number {
  return Array.from(input).length;
}

function normalizeText(
  payload: Extract<WorldChatCreateMessageRequest, { messageType: 'text' }>,
): string {
  return (payload.textContent ?? payload.payload?.text ?? '').trim();
}

async function buildItemShowcasePayload(params: {
  cultivatorId: string;
  itemType: 'artifact' | 'material' | 'consumable' | 'skill' | 'gongfa';
  itemId: string;
  text?: string;
}): Promise<WorldChatItemShowcasePayload | null> {
  const { cultivatorId, itemType, itemId, text } = params;
  const showcaseText = text?.trim() || undefined;

  if (
    itemType === 'artifact' ||
    itemType === 'skill' ||
    itemType === 'gongfa'
  ) {
    const item = await creationProductRepository.findById(itemId);
    if (
      !item ||
      item.cultivatorId !== cultivatorId ||
      item.productType !== itemType
    ) {
      return null;
    }

    if (itemType === 'artifact') {
      const snapshot: ItemShowcaseSnapshotMap['artifact'] = {
        id: item.id,
        name: item.name,
        slot: item.slot as ItemShowcaseSnapshotMap['artifact']['slot'],
        element: item.element as ItemShowcaseSnapshotMap['artifact']['element'],
        quality: item.quality as ItemShowcaseSnapshotMap['artifact']['quality'],
        description: item.description ?? undefined,
        productModel: item.productModel,
      };
      return { itemType, itemId, snapshot, text: showcaseText };
    }

    const snapshot: ItemShowcaseSnapshotMap[typeof itemType] = {
      id: item.id,
      name: item.name,
      productType: itemType,
      element:
        item.element as ItemShowcaseSnapshotMap[typeof itemType]['element'],
      quality:
        item.quality as ItemShowcaseSnapshotMap[typeof itemType]['quality'],
      description: item.description,
      score: item.score ?? 0,
      productModel: item.productModel,
    };
    return { itemType, itemId, snapshot, text: showcaseText };
  }

  if (itemType === 'material') {
    const item = await getCultivatorMaterialById(cultivatorId, itemId);
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

  const item = await getCultivatorConsumableById(cultivatorId, itemId);
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

export async function createCultivatorChatMessage(params: {
  request: WorldChatCreateMessageRequest;
  userId: string;
  cultivatorId: string;
  channel: Extract<WorldChatMessageChannel, 'world' | 'sect'>;
  sectId: string | null;
  acquireCooldown(
    cultivatorId: string,
    realm: string,
  ): Promise<{ allowed: boolean; remainingSeconds: number }>;
  persist(input: {
    senderUserId: string;
    senderCultivatorId: string;
    senderName: string;
    senderRealm: string;
    senderRealmStage: string;
    channel: Extract<WorldChatMessageChannel, 'world' | 'sect'>;
    sectId: string | null;
    messageType: WorldChatMessageType;
    textContent?: string;
    payload: WorldChatPayload;
  }): Promise<WorldChatMessageDTO>;
}): Promise<WorldChatMessageDTO> {
  const identity = await readCultivatorPublicIdentity(params.cultivatorId);
  const cooldown = await params.acquireCooldown(
    params.cultivatorId,
    identity.realm,
  );
  if (!cooldown.allowed) {
    throw new ChatMessageApplicationError(
      `请 ${cooldown.remainingSeconds} 秒后再发言`,
      429,
      cooldown.remainingSeconds,
    );
  }

  const senderBase = {
    senderUserId: params.userId,
    senderCultivatorId: params.cultivatorId,
    senderName: identity.name,
    senderRealm: identity.realm,
    senderRealmStage: identity.realmStage,
    channel: params.channel,
    sectId: params.sectId,
  };

  if (params.request.messageType === 'text') {
    const text = normalizeText(params.request);
    const textLength = countChars(text);
    if (textLength < 1 || textLength > 100) {
      throw new ChatMessageApplicationError('消息长度需在 1-100 字之间', 400);
    }
    return params.persist({
      ...senderBase,
      messageType: 'text',
      textContent: text,
      payload: { text },
    });
  }

  const showcaseText = (
    params.request.textContent ??
    params.request.payload?.text ??
    ''
  ).trim();
  if (countChars(showcaseText) > 100) {
    throw new ChatMessageApplicationError('附言长度需在 100 字以内', 400);
  }
  const payload = await buildItemShowcasePayload({
    cultivatorId: params.cultivatorId,
    itemType: params.request.itemType,
    itemId: params.request.itemId,
    text: showcaseText,
  });
  if (!payload) {
    throw new ChatMessageApplicationError('道具不存在或不属于当前角色', 404);
  }
  return params.persist({
    ...senderBase,
    messageType: 'item_showcase',
    textContent: payload.text,
    payload,
  });
}
