import type {
  WorldChatBattleShowcasePayload,
  WorldChatItemShowcasePayload,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';

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

function isBattleShowcasePayload(
  payload: WorldChatMessageDTO['payload'],
): payload is WorldChatBattleShowcasePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'shareCode' in payload &&
    'winner' in payload &&
    'loser' in payload &&
    'turns' in payload &&
    typeof payload.winner === 'object' &&
    payload.winner !== null &&
    typeof payload.winner.name === 'string' &&
    typeof payload.loser === 'object' &&
    payload.loser !== null &&
    typeof payload.loser.name === 'string' &&
    typeof payload.turns === 'number'
  );
}

function isItemShowcasePayload(
  payload: WorldChatMessageDTO['payload'],
): payload is WorldChatItemShowcasePayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'itemType' in payload &&
    'snapshot' in payload
  );
}

export function getWorldChatMessageBody(message: WorldChatMessageDTO) {
  if (
    message.messageType === 'battle_showcase' &&
    isBattleShowcasePayload(message.payload)
  ) {
    const summary = `展示战谱：${message.payload.winner.name}胜${message.payload.loser.name}（${message.payload.turns}回）`;
    return message.payload.text
      ? `${summary} ${message.payload.text}`
      : summary;
  }

  if (
    message.messageType === 'item_showcase' &&
    isItemShowcasePayload(message.payload)
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

  if (isTextPayload(message.payload)) {
    return message.textContent || message.payload.text;
  }

  return message.textContent || '';
}
