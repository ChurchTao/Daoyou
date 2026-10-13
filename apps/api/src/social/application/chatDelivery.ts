import { createSectChatMessage } from '@server/lib/repositories/sectChatRepository.js';
import { createMessage } from '@server/lib/repositories/worldChatRepository.js';

export async function createAndPublishWorldChatMessage(
  input: Parameters<typeof createMessage>[0],
) {
  const message = await createMessage(input);
  return message;
}

export async function createAndPublishSectChatMessage(
  input: Parameters<typeof createSectChatMessage>[0],
) {
  const message = await createSectChatMessage(input);
  return message;
}
