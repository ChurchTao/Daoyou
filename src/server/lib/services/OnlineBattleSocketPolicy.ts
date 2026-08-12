export const MAX_SOCKET_MESSAGE_BYTES = 256 * 1024;
export const MAX_BATTLE_CONNECTIONS_PER_PLAYER = 3;
export const MAX_COMMANDS_PER_WINDOW = 30;
export const COMMAND_WINDOW_MS = 5_000;

export function onlineBattleMessageByteLength(message: string): number {
  return new TextEncoder().encode(message).byteLength;
}

export class OnlineBattleCommandRateWindow {
  private windowStartedAt: number;
  private count = 0;

  constructor(startedAt = Date.now()) {
    this.windowStartedAt = startedAt;
  }

  accept(now = Date.now()): boolean {
    if (now - this.windowStartedAt >= COMMAND_WINDOW_MS) {
      this.windowStartedAt = now;
      this.count = 0;
    }
    this.count += 1;
    return this.count <= MAX_COMMANDS_PER_WINDOW;
  }
}
