export const PARTY_CHANGED = 'daoyou:party-changed';
export const PARTY_CHAT_OPEN = 'daoyou:party-chat-open';

export function notifyPartyChanged() {
  window.dispatchEvent(new Event(PARTY_CHANGED));
}

export function openPartyChat() {
  window.dispatchEvent(new Event(PARTY_CHAT_OPEN));
}
