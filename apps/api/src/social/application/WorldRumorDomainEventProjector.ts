import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@daoyou/shared/contracts/domainEvents';
import { alchemyShowcaseSnapshot } from '@daoyou/shared/items/alchemyShowcase';
import { forgingShowcaseSnapshot } from '@daoyou/shared/items/forgingShowcase';
import { QUALITY_ORDER } from '@daoyou/shared/types/constants';
import type { WorldChatPayload } from '@daoyou/shared/types/world-chat';
import type { FeatureCommandResult } from '@server/player/application/state/CommandExecutors.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';

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
    if (event.data.itemType === 'consumable') {
      const snapshot = alchemyShowcaseSnapshot(
        event.data.outputs ?? [event.data.snapshot],
      );
      if (!snapshot) return ignored();
      const text = `由${event.data.cultivatorName}炼成，品相完美，药香化霞，足令诸修侧目。`;
      return createRumor(event, event.data.userId, 'item_showcase', text, {
        version: 1,
        snapshot,
        text,
      });
    }
    if (QUALITY_ORDER[event.data.quality] < QUALITY_ORDER['天品']) {
      return ignored();
    }
    const text = `由${event.data.cultivatorName}炼成，品阶已入${event.data.quality}，灵韵自生，足令诸修侧目。`;
    return createRumor(event, event.data.userId, 'text', text, { text });
  }

  if (isDomainEventType(event, 'equipment.forged')) {
    const snapshot = forgingShowcaseSnapshot(event.data.equipment);
    if (!snapshot) return ignored();
    const special = [
      event.data.equipment.artId ? '器诀' : null,
      event.data.equipment.essenceIds.length ? '器蕴' : null,
    ]
      .filter(Boolean)
      .join('与');
    const text = `由${event.data.cultivatorName}炼成，天生${special}，灵韵自生，足令诸修侧目。`;
    return createRumor(event, event.data.userId, 'item_showcase', text, {
      version: 1,
      snapshot,
      text,
    });
  }

  if (isDomainEventType(event, 'market.material.revealed')) {
    if (QUALITY_ORDER[event.data.quality] < QUALITY_ORDER['天品']) {
      return ignored();
    }
    const text = `鉴宝司金光冲霄，${event.data.cultivatorName}鉴出${event.data.quality}「${event.data.materialName}」，天降异象，诸界皆闻。`;
    return createRumor(event, event.data.userId, 'text', text, { text });
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

  if (isDomainEventType(event, 'beast.exceptional.acquired')) {
    const { beast, cultivatorName, source } = event.data;
    const text =
      source === 'fusion'
        ? `${cultivatorName}融合出身怀${beast.skills.length}项技能的灵兽，奇缘传遍诸界。`
        : `${cultivatorName}捕获变异灵兽，异相惊动诸界。`;
    return createRumor(event, event.data.userId, 'beast_showcase', text, {
      version: 1,
      beast,
      text,
    });
  }

  throw new Error(`世界传闻投影不支持领域事件: ${event.type}`);
}

function ignored(): RumorProjectionResult {
  return { result: { status: 'ignored' }, resourceChanges: [] };
}

async function createRumor(
  event: DomainEventEnvelope,
  senderUserId: string,
  messageType: 'text' | 'item_showcase' | 'beast_showcase',
  text: string,
  payload: WorldChatPayload,
): Promise<RumorProjectionResult> {
  await createAndPublishWorldChatMessage({
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
