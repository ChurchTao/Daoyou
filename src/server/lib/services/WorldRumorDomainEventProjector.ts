import { createMessage } from '@server/lib/repositories/worldChatRepository';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import { QUALITY_ORDER } from '@shared/types/constants';
import type { WorldChatPayload } from '@shared/types/world-chat';
import type { FeatureCommandResult } from './CommandExecutors';

type RumorProjectionResult = FeatureCommandResult<{
  status: 'ignored' | 'created';
}>;

function deterministicTemplate(eventId: string, templates: readonly string[]) {
  const hash = [...eventId].reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return templates[hash % templates.length];
}

export async function projectWorldRumorDomainEvent(
  event: DomainEventEnvelope,
): Promise<RumorProjectionResult> {
  if (isDomainEventType(event, 'cultivator.realm.changed')) {
    if (!event.data.major) return ignored();
    const target = `${event.data.toRealm}${event.data.toStage}`;
    const text = deterministicTemplate(event.id, [
      `${event.data.cultivatorName}闭关洞府霞光冲霄，竟一举破境，踏入「${target}」！`,
      `有修士夜观天象见异光东来，传闻${event.data.cultivatorName}已至「${target}」！`,
      `${event.data.cultivatorName}冲关成功，道音震荡八方，自此迈入「${target}」！`,
      `灵潮翻涌，雷声隐隐，${event.data.cultivatorName}于万众传闻中晋升「${target}」！`,
      `${event.data.cultivatorName}破开桎梏，境界再上一重楼，正式踏入「${target}」！`,
    ]);
    return createRumor(event, event.data.userId, 'text', text, { text });
  }

  if (isDomainEventType(event, 'craft.item.created')) {
    if (QUALITY_ORDER[event.data.quality] < QUALITY_ORDER['天品']) {
      return ignored();
    }
    const noun = event.data.itemType === 'consumable' ? '丹品' : '品阶';
    const flourish =
      event.data.itemType === 'consumable' ? '药香化霞' : '灵韵自生';
    const text = `由${event.data.cultivatorName}炼成，${noun}已入${event.data.quality}，${flourish}，足令诸修侧目。`;
    return createRumor(event, event.data.userId, 'item_showcase', text, {
      itemType: event.data.itemType,
      itemId: event.data.itemId,
      snapshot: event.data.snapshot,
      text,
    } as WorldChatPayload);
  }

  if (isDomainEventType(event, 'market.material.revealed')) {
    if (QUALITY_ORDER[event.data.quality] < QUALITY_ORDER['天品']) {
      return ignored();
    }
    const text = `鉴宝司金光冲霄，${event.data.cultivatorName}鉴出${event.data.quality}「${event.data.materialName}」，天降异象，诸界皆闻。`;
    return createRumor(event, event.data.userId, 'item_showcase', text, {
      itemType: 'material',
      itemId: event.data.materialId,
      snapshot: event.data.snapshot,
      text,
    } as WorldChatPayload);
  }

  if (isDomainEventType(event, 'ranking.position.changed')) {
    const text =
      event.data.changeType === 'direct_entry'
        ? `万界金榜初开，${event.data.challengerName}登临${event.data.realm}天骄榜第${event.data.rank}名。`
        : event.data.changeType === 'vacancy_entry'
          ? `万界金榜有感，${event.data.challengerName}虽挑战${event.data.targetName ?? '榜上修士'}未胜，仍补入${event.data.realm}天骄榜第${event.data.rank}名。`
          : `万界金榜有感，${event.data.challengerName}击败${event.data.targetName ?? '榜上修士'}，登临${event.data.realm}天骄榜第${event.data.rank}名。`;
    return createRumor(event, event.data.userId, 'text', text, { text });
  }

  throw new Error(`世界传闻投影不支持领域事件: ${event.type}`);
}

function ignored(): RumorProjectionResult {
  return { result: { status: 'ignored' }, resourceChanges: [] };
}

async function createRumor(
  event: DomainEventEnvelope,
  senderUserId: string,
  messageType: 'text' | 'item_showcase',
  text: string,
  payload: WorldChatPayload,
): Promise<RumorProjectionResult> {
  await createMessage({
    id: event.id,
    createdAt: event.occurredAt,
    senderUserId,
    senderCultivatorId: null,
    senderName: '修仙界传闻',
    senderRealm: '炼气',
    senderRealmStage: '系统',
    channel: 'system',
    messageType,
    textContent: text,
    payload,
  });
  return { result: { status: 'created' }, resourceChanges: [] };
}
