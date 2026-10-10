import type { HuntTeamChatMessage } from '@daoyou/contracts/hunts';
import { HUNT_TEAM_CHAT_MAX_CHARS } from '@daoyou/contracts/hunts';
import type { HuntTeam } from '@daoyou/game-domain/hunts';
import { ArenaV6Error } from '@server/combat/application/CombatV6ArenaService.js';
import { readCultivatorPublicIdentity } from '@server/cultivator/facts.js';
import { acquireRedisCooldown } from '@server/lib/redis/cooldownLimiter.js';
import { redis } from '@server/lib/redis/index.js';
import { publishHuntTeamChat } from '@server/realtime/infrastructure/huntTeamChatBroadcaster.js';
import { textFilter } from '@server/social/application/textFilter.js';
import {
  huntMemberKey,
  huntTeamChatKey,
  huntTeamKey,
  type HuntActor,
} from './HuntTeamService.js';

const CHAT_LIMIT = 50;
const CHAT_TTL_SECONDS = 60 * 60 * 48;
const COOLDOWN_SECONDS = 1;

function countChars(input: string) {
  return Array.from(input).length;
}

function parseMessage(raw: string, teamId: string): HuntTeamChatMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<HuntTeamChatMessage>;
    if (
      parsed.teamId !== teamId ||
      typeof parsed.id !== 'string' ||
      typeof parsed.senderCultivatorId !== 'string' ||
      typeof parsed.senderName !== 'string' ||
      typeof parsed.text !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      teamId,
      senderCultivatorId: parsed.senderCultivatorId,
      senderName: parsed.senderName,
      text: parsed.text,
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function requireMember(actor: HuntActor, teamId: string) {
  const owner = await redis.get(huntMemberKey(actor.userId));
  if (owner !== teamId) throw new ArenaV6Error('你尚未加入这支队伍', 403);
  const raw = await redis.get(huntTeamKey(teamId));
  if (!raw) throw new ArenaV6Error('这支队伍已经散了', 404);
  let team: HuntTeam;
  try {
    team = JSON.parse(raw) as HuntTeam;
  } catch {
    throw new ArenaV6Error('这支队伍已经散了', 404);
  }
  if (
    team.id !== teamId ||
    !team.members.some(
      (member) =>
        member.userId === actor.userId &&
        member.cultivatorId === actor.cultivatorId,
    )
  ) {
    throw new ArenaV6Error('你尚未加入这支队伍', 403);
  }
  return team;
}

export async function listHuntTeamChat(
  actor: HuntActor,
  teamId: string,
): Promise<HuntTeamChatMessage[]> {
  await requireMember(actor, teamId);
  const rows = await redis.lrange(huntTeamChatKey(teamId), 0, CHAT_LIMIT - 1);
  return rows
    .map((raw) => parseMessage(raw, teamId))
    .filter((message): message is HuntTeamChatMessage => Boolean(message))
    .reverse();
}

export async function sendHuntTeamChat(
  actor: HuntActor,
  teamId: string,
  text: string,
): Promise<HuntTeamChatMessage> {
  const team = await requireMember(actor, teamId);
  const trimmed = text.trim();
  const length = countChars(trimmed);
  if (length < 1 || length > HUNT_TEAM_CHAT_MAX_CHARS) {
    throw new ArenaV6Error(
      `消息长度需在 1-${HUNT_TEAM_CHAT_MAX_CHARS} 字之间`,
      400,
    );
  }
  const cooldown = await acquireRedisCooldown({
    key: `hunt:v1:chat:cooldown:${actor.cultivatorId}`,
    cooldownSeconds: COOLDOWN_SECONDS,
  });
  if (!cooldown.allowed) {
    throw new ArenaV6Error(`请 ${cooldown.remainingSeconds} 秒后再发言`, 409);
  }
  const identity = await readCultivatorPublicIdentity(actor.cultivatorId);
  const message: HuntTeamChatMessage = {
    id: crypto.randomUUID(),
    teamId,
    senderCultivatorId: actor.cultivatorId,
    senderName: identity.name,
    text: textFilter.mask(trimmed).text,
    createdAt: new Date().toISOString(),
  };
  const stored = await redis.eval(
    `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local raw = redis.call('GET', KEYS[2])
if not raw then return 0 end
local team = cjson.decode(raw)
if team.id ~= ARGV[1] then return 0 end
local found = false
for _, member in ipairs(team.members or {}) do
  if member.userId == ARGV[2] and member.cultivatorId == ARGV[3] then
    found = true
    break
  end
end
if not found then return 0 end
redis.call('LPUSH', KEYS[3], ARGV[4])
redis.call('LTRIM', KEYS[3], 0, tonumber(ARGV[6]) - 1)
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[5]))
return 1`,
    3,
    huntMemberKey(actor.userId),
    huntTeamKey(teamId),
    huntTeamChatKey(teamId),
    teamId,
    actor.userId,
    actor.cultivatorId,
    JSON.stringify(message),
    String(CHAT_TTL_SECONDS),
    String(CHAT_LIMIT),
  );
  if (Number(stored) !== 1) throw new ArenaV6Error('你尚未加入这支队伍', 403);
  publishHuntTeamChat(
    team.members.map((member) => member.userId),
    message,
  );
  return message;
}
