import { redis } from '@server/lib/redis';

const TICKET_TTL_SECONDS = 60;
const PREFIX = 'battle:online:socket-ticket:';

export interface OnlineBattleTicketIdentity {
  readonly matchId: string;
  readonly playerId: string;
}

export async function issueOnlineBattleTicket(
  identity: OnlineBattleTicketIdentity,
): Promise<string> {
  const ticket = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll('-', '');
  await redis.set(
    `${PREFIX}${ticket}`,
    JSON.stringify(identity),
    'EX',
    TICKET_TTL_SECONDS,
    'NX',
  );
  return ticket;
}

export async function consumeOnlineBattleTicket(
  ticket: string,
): Promise<OnlineBattleTicketIdentity | null> {
  if (!/^[a-f0-9]{64}$/i.test(ticket)) return null;
  const value = await redis.getdel(`${PREFIX}${ticket}`);
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as OnlineBattleTicketIdentity;
    return parsed.matchId && parsed.playerId ? parsed : null;
  } catch {
    return null;
  }
}
