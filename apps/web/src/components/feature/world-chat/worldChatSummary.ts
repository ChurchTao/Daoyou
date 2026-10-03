import { isInventoryShowcase } from '@daoyou/shared/items/showcase';
import type {
  WorldChatMessageDTO,
} from '@daoyou/shared/types/world-chat';

function isTextPayload(
  payload: WorldChatMessageDTO['payload'],
): payload is { text: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'text' in payload &&
    typeof payload.text === 'string'
  );
}

export function getWorldChatMessageBody(message: WorldChatMessageDTO) {
  if (message.messageType === 'combat_v6_replay' && 'version' in message.payload && message.payload.version === 1 && 'sides' in message.payload && Array.isArray(message.payload.sides) && Array.isArray(message.payload.sides[0]) && Array.isArray(message.payload.sides[1])) {
    return `分享战绩：${message.payload.sides[0].join('、')} 对阵 ${message.payload.sides[1].join('、')}（${message.payload.roundCount} 回）`;
  }
  if (message.messageType === 'beast_showcase' && 'beast' in message.payload) {
    const beast = message.payload.beast;
    return `${beast.isMutant ? '变异灵兽' : '灵兽'}「${beast.name}」${message.payload.text ? ` ${message.payload.text}` : ''}`;
  }
  if (
    message.messageType === 'item_showcase' &&
    isInventoryShowcase(message.payload)
  ) {
    const name =
      typeof message.payload.snapshot?.name === 'string'
        ? message.payload.snapshot.name
        : null;
    const text =
      typeof message.payload.text === 'string' ? message.payload.text : '';

    if (name && text) {
      return `展示了「${name}」 ${text}`;
    }

    if (name) {
      return `展示了「${name}」`;
    }

    return message.textContent || '【道具展示】';
  }

  if (message.messageType === 'item_showcase') {
    const text =
      message.textContent ||
      (isTextPayload(message.payload) ? message.payload.text : '');
    return text || '道具详情暂不可查看';
  }

  if (isTextPayload(message.payload)) {
    return message.textContent || message.payload.text;
  }

  return message.textContent || '';
}
