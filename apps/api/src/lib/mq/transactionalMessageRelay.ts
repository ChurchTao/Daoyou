import { listPendingTransactionalMessages } from '@server/lib/repositories/transactionalMessageRepository.js';
import { publishTransactionalMessage } from './transactionalMessagePublisher.js';

const RECOVERY_INTERVAL_MS = 5_000;
const RECOVERY_BATCH_SIZE = 100;

let recoveryTimer: ReturnType<typeof setInterval> | undefined;
let recoveryWork: Promise<void> | undefined;

async function recoverPendingMessages(): Promise<void> {
  const messages = await listPendingTransactionalMessages(RECOVERY_BATCH_SIZE);
  for (const message of messages) {
    try {
      await publishTransactionalMessage(message.id);
    } catch (error) {
      console.error('[transactional-message] publish failed', {
        messageId: message.id,
        messageKey: message.messageKey,
        error,
      });
    }
  }
}

function scheduleRecovery(): void {
  if (recoveryWork) return;
  recoveryWork = recoverPendingMessages()
    .catch((error) =>
      console.error('[transactional-message] recovery failed', error),
    )
    .finally(() => {
      recoveryWork = undefined;
    });
}

export function startTransactionalMessageRelay(): void {
  if (recoveryTimer) return;

  scheduleRecovery();
  recoveryTimer = setInterval(scheduleRecovery, RECOVERY_INTERVAL_MS);
  recoveryTimer.unref();
}

export async function stopTransactionalMessageRelay(): Promise<void> {
  clearInterval(recoveryTimer);
  recoveryTimer = undefined;
  await recoveryWork;
}
