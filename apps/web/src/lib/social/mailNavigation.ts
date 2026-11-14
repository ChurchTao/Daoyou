export const SYSTEM_MAIL_CONVERSATION_ID = 'system-mail';
export const SYSTEM_MAIL_HREF = `/game/friends?chat=${SYSTEM_MAIL_CONVERSATION_ID}`;

export function mailGiftHref(cultivatorId: string, conversationId: string) {
  return `/game/friends?chat=${encodeURIComponent(conversationId)}&composeTo=${encodeURIComponent(cultivatorId)}`;
}
