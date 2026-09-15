import { readCultivatorPublicIdentity } from '@server/lib/services/cultivator/CultivatorFactsReader';
import type { WorldChatCreateMessageRequest } from '@shared/contracts/world-chat';
import { inventoryShowcaseSnapshot } from '@shared/items/showcase';
import type {
  WorldChatItemShowcasePayload,
  WorldChatMessageChannel,
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@shared/types/world-chat';
import { readInventory } from './InventoryService';

export class ChatMessageApplicationError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 | 429,
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
  itemId: string;
  revision: number;
  text?: string;
}): Promise<WorldChatItemShowcasePayload> {
  const bag = await readInventory(params.cultivatorId, {
    location: 'bag',
    page: 0,
    search: '',
    kind: 'all',
  });
  const item = bag.items.find((item) => item.id === params.itemId);
  if (!item)
    throw new ChatMessageApplicationError('道具不在当前角色背包中', 404);
  if (item.revision !== params.revision)
    throw new ChatMessageApplicationError('物品已变化，请刷新后重新选择', 409);
  return {
    version: 1,
    snapshot: inventoryShowcaseSnapshot(item),
    text: params.text?.trim() || undefined,
  };
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

  const showcaseText = (params.request.textContent ?? '').trim();
  if (countChars(showcaseText) > 100) {
    throw new ChatMessageApplicationError('附言长度需在 100 字以内', 400);
  }
  const payload = await buildItemShowcasePayload({
    cultivatorId: params.cultivatorId,
    revision: params.request.revision,
    itemId: params.request.itemId,
    text: showcaseText,
  });
  return params.persist({
    ...senderBase,
    messageType: 'item_showcase',
    textContent: payload.text,
    payload,
  });
}
