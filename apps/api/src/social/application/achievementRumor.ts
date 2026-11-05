import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { insertChatMessage } from '@server/lib/repositories/chatRepository.js';

export async function queueAchievementRumor(
  tx: DbTransaction,
  input: { text: string },
): Promise<string | undefined> {
  const { outboxId } = await insertChatMessage(
    {
      senderUserId: 'system',
      senderCultivatorId: null,
      senderName: '修仙界传闻',
      senderRealm: '',
      senderRealmStage: '',
      channel: 'system',
      sectId: null,
      messageType: 'text',
      textContent: input.text,
      payload: { text: input.text },
    },
    tx,
  );
  return outboxId;
}
