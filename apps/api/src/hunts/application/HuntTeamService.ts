import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import {
  ARENA_SPARRING_RULES_V1,
  type ArenaRoomV1,
} from '@daoyou/contracts/arena';
import type { HuntLobby, HuntTeamCommand } from '@daoyou/contracts/hunts';
import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntMember, HuntTeam } from '@daoyou/game-domain/hunts';
import { type HuntEvent } from '@daoyou/game-domain/hunts';
import {
  huntEventById,
  huntIsOpen,
  huntRealmAllowed,
  huntStartError,
  selectHuntTeam,
} from '@daoyou/game-rules/hunts';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import {
  ArenaV6Error,
  createArenaV6,
} from '@server/combat/application/CombatV6ArenaService.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { readCultivatorPublicIdentity } from '@server/cultivator/facts.js';
import { db } from '@server/lib/drizzle/db.js';
import { cultivators, playerJournal } from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import {
  withRedisLock,
  type RedisLeaseContext,
} from '@server/lib/redis/lock.js';
import { checkAndAcquireCooldown } from '@server/lib/redis/worldChatLimiter.js';
import { journalOperationKey } from '@server/lib/repositories/playerJournalRepository.js';
import { createAndPublishWorldChatMessage } from '@server/social/application/chatDelivery.js';
import { and, eq } from 'drizzle-orm';
export type HuntActor = { userId: string; cultivatorId: string };
export const huntTeamKey = (id: string) => `hunt:v1:team:${id}`;
export const huntMemberKey = (id: string) => `hunt:v1:member:${id}`;
export const huntTeamChatKey = (id: string) => `hunt:v1:chat:${id}`;
const teamKey = huntTeamKey;
const memberKey = huntMemberKey;
const eventTeamsKey = (id: string) => `hunt:v1:teams:${id}`;
const battleStore = new CombatV6ArenaStore();
const lock = <T>(task: (lease: RedisLeaseContext) => Promise<T>) =>
  withRedisLock(
    {
      key: 'lock:hunt:v1:teams',
      context: 'hunt-team',
      timeoutMs: 60000,
      retries: 10,
    },
    task,
  );

async function readTeam(id: string): Promise<HuntTeam | null> {
  const raw = await redis.get(teamKey(id));
  return raw ? (JSON.parse(raw) as HuntTeam) : null;
}
export async function huntClaimed(eventId: string, cultivatorId: string) {
  return !!(
    await db
      .select({ id: playerJournal.cultivatorId })
      .from(playerJournal)
      .where(
        and(
          eq(
            playerJournal.operationKey,
            journalOperationKey('hunt_reward', eventId),
          ),
          eq(playerJournal.cultivatorId, cultivatorId),
        ),
      )
      .limit(1)
  )[0];
}
async function member(
  actor: HuntActor,
  event: HuntEvent | null,
): Promise<HuntMember> {
  const row = await db.query.cultivators.findFirst({
    columns: { name: true, realm: true },
    where: and(
      eq(cultivators.id, actor.cultivatorId),
      eq(cultivators.userId, actor.userId),
      eq(cultivators.status, 'active'),
    ),
  });
  if (!row || !REALM_VALUES.includes(row.realm as RealmType))
    throw new ArenaV6Error('这位道友暂时无法出战');
  return {
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    name: row.name,
    realm: row.realm as RealmType,
    ready: false,
    assisting: event ? await huntClaimed(event.id, actor.cultivatorId) : false,
  };
}
function withoutTarget(team: HuntTeam): HuntTeam {
  return {
    ...team,
    event: null,
    status: 'assembling',
    members: team.members.map((m) => ({
      ...m,
      ready: false,
      assisting: false,
    })),
    battleId: undefined,
    startRequestId: undefined,
    revision: team.revision + 1,
  };
}
// One atomic write maintains roster, membership ownership and the event index.
async function saveTeam(
  team: HuntTeam,
  previous: HuntTeam | null,
  lease: RedisLeaseContext,
) {
  lease.assertHeld();
  const removed = (previous?.members ?? []).filter(
    (m) => !team.members.some((n) => n.userId === m.userId),
  );
  const result = await redis.eval(
    `
local raw = redis.call('GET', KEYS[1])
if ARGV[1] == '-1' then if raw then return 0 end
elseif not raw or cjson.decode(raw).revision ~= tonumber(ARGV[1]) then return 0 end
local next = cjson.decode(ARGV[2])
for _,m in ipairs(next.members) do
 local key = 'hunt:v1:member:' .. m.userId
 local owner = redis.call('GET', key)
 if owner and owner ~= next.id then return 0 end
end
for _,m in ipairs(cjson.decode(ARGV[3])) do
 local key = 'hunt:v1:member:' .. m.userId
 if redis.call('GET', key) == next.id then redis.call('DEL', key) end
end
local prevEvent = ARGV[4]
local nextEvent = ARGV[5]
if prevEvent ~= '' then redis.call('SREM', 'hunt:v1:teams:' .. prevEvent, next.id) end
if nextEvent ~= '' and nextEvent ~= prevEvent then redis.call('SREM', 'hunt:v1:teams:' .. nextEvent, next.id) end
if #next.members == 0 then
 redis.call('DEL', KEYS[1])
 redis.call('DEL', ARGV[7])
else
 redis.call('SET', KEYS[1], ARGV[2])
 if nextEvent ~= '' then
  redis.call('SADD', 'hunt:v1:teams:' .. nextEvent, next.id)
  redis.call('ZADD', 'hunt:v1:team-events', tonumber(ARGV[6]), nextEvent)
 end
 for _,m in ipairs(next.members) do redis.call('SET', 'hunt:v1:member:' .. m.userId, next.id) end
end
return 1`,
    1,
    teamKey(team.id),
    previous?.revision ?? -1,
    JSON.stringify(team),
    JSON.stringify(removed),
    previous?.event?.id ?? '',
    team.event?.id ?? '',
    String(team.event?.expiresAt ?? 0),
    huntTeamChatKey(team.id),
  );
  if (Number(result) !== 1) throw new ArenaV6Error('队伍有变，请重新查看');
}
async function currentTeam(actor: HuntActor, lease: RedisLeaseContext) {
  const id = await redis.get(memberKey(actor.userId));
  if (!id) return null;
  const team = await readTeam(id);
  if (!team) {
    await redis.eval(
      "if redis.call('GET',KEYS[1]) == ARGV[1] then redis.call('DEL',KEYS[1]) end",
      1,
      memberKey(actor.userId),
      id,
    );
    return null;
  }
  if (team.status === 'starting' && team.startRequestId) {
    const battleId = await battleStore.source(team.id, team.startRequestId);
    if (battleId) {
      const next = {
        ...team,
        status: 'in_battle' as const,
        battleId,
        revision: team.revision + 1,
      };
      await saveTeam(next, team, lease);
      return next;
    }
    // A crashed starter has no active battle; retry with the same frozen request.
  }
  if (
    team.event &&
    !huntIsOpen(team.event, Date.now()) &&
    team.status !== 'in_battle'
  ) {
    const next = withoutTarget(team);
    await saveTeam(next, team, lease);
    return next;
  }
  return team;
}
function requireEvent(id: string, open = true) {
  const event = huntEventById(id);
  if (!event || (open && !huntIsOpen(event, Date.now())))
    throw new ArenaV6Error('此处异动已平息', 404);
  return event;
}
async function eventTeams(id: string) {
  const ids = await redis.smembers(eventTeamsKey(id));
  const teams = await Promise.all(ids.map(readTeam));
  return teams.filter(
    (t): t is HuntTeam => !!t && t.members.length > 0 && t.event?.id === id,
  );
}
export async function huntLobby(
  id: string,
  actor: HuntActor,
): Promise<HuntLobby> {
  const event = requireEvent(id, false);
  const myTeam = await lock((lease) => currentTeam(actor, lease));
  const open = huntIsOpen(event, Date.now());
  const [teams, claimed] = await Promise.all([
    open ? eventTeams(id) : [],
    huntClaimed(id, actor.cultivatorId),
  ]);
  return {
    event,
    open,
    teams: teams.filter((t) => t.status === 'assembling'),
    myTeam,
    claimed,
    serverNow: Date.now(),
  };
}
export async function readMyHuntTeam(
  actor: HuntActor,
): Promise<HuntTeam | null> {
  const id = await redis.get(memberKey(actor.userId));
  if (!id) return null;
  const team = await readTeam(id);
  if (!team?.members.some((m) => m.userId === actor.userId)) return null;
  return team;
}
export async function createHuntTeam(
  actor: HuntActor,
  input: { eventId?: string; minRealm: RealmType; maxRealm: RealmType },
) {
  return lock(async (lease) => {
    const event = input.eventId ? requireEvent(input.eventId) : null;
    if (await currentTeam(actor, lease))
      throw new ArenaV6Error('请先离开当前讨伐队伍');
    if (await hasActiveCombat(actor.cultivatorId))
      throw new ArenaV6Error('上一场战斗尚未结束，请稍候');
    const self = await member(actor, event);
    if (!huntRealmAllowed(input, self.realm))
      throw new ArenaV6Error('招募的境界范围也需包含你自己');
    const team: HuntTeam = {
      id: crypto.randomUUID(),
      event,
      minRealm: input.minRealm,
      maxRealm: input.maxRealm,
      leaderId: actor.cultivatorId,
      members: [self],
      status: 'assembling',
      revision: 0,
    };
    await saveTeam(team, null, lease);
    return team;
  });
}
export async function joinHuntTeam(
  actor: HuntActor,
  eventId: string,
  teamId?: string,
) {
  return lock(async (lease) => {
    const event = requireEvent(eventId);
    const current = await currentTeam(actor, lease);
    if (current) {
      if (
        current.id === teamId &&
        current.members.some((m) => m.cultivatorId === actor.cultivatorId)
      )
        return current;
      throw new ArenaV6Error('请先离开当前讨伐队伍');
    }
    if (await hasActiveCombat(actor.cultivatorId))
      throw new ArenaV6Error('上一场战斗尚未结束，请稍候');
    const self = await member(actor, event);
    const team = teamId
      ? await readTeam(teamId)
      : selectHuntTeam(await eventTeams(eventId), self.realm, Date.now());
    if (!team) throw new ArenaV6Error('还没有合适的队伍，可先创建队伍招募道友');
    if (
      team.event?.id !== eventId ||
      team.status !== 'assembling' ||
      team.members.length >= 4 ||
      !huntRealmAllowed(team, self.realm)
    )
      throw new ArenaV6Error('这支队伍已满、已出战，或你的境界不在招募范围内');
    const next = {
      ...team,
      members: [...team.members, self],
      revision: team.revision + 1,
    };
    await saveTeam(next, team, lease);
    return next;
  });
}
export async function joinHuntTeamById(actor: HuntActor, teamId: string) {
  return lock(async (lease) => {
    const current = await currentTeam(actor, lease);
    if (current) {
      if (
        current.id === teamId &&
        current.members.some((m) => m.cultivatorId === actor.cultivatorId)
      )
        return current;
      throw new ArenaV6Error('请先离开当前讨伐队伍');
    }
    if (await hasActiveCombat(actor.cultivatorId))
      throw new ArenaV6Error('上一场战斗尚未结束，请稍候');
    const team = await readTeam(teamId);
    if (!team) throw new ArenaV6Error('这支队伍已经散了');
    if (team.status !== 'assembling' || team.members.length >= 4)
      throw new ArenaV6Error('这支队伍已满或已出战');
    if (team.event && !huntIsOpen(team.event, Date.now()))
      throw new ArenaV6Error('这支队伍的目标已经隐去');
    const self = await member(actor, team.event);
    if (!huntRealmAllowed(team, self.realm))
      throw new ArenaV6Error('你的境界不在这支队伍的招募范围内');
    const next = {
      ...team,
      members: [...team.members, self],
      revision: team.revision + 1,
    };
    await saveTeam(next, team, lease);
    return next;
  });
}
function arenaRoom(team: HuntTeam): ArenaRoomV1 {
  const event = team.event;
  if (!event) throw new ArenaV6Error('请先选定讨伐目标');
  const seats = team.members.map((m, slot) => ({
    userId: m.userId,
    cultivatorId: m.cultivatorId,
    displayName: m.name,
    realm: m.realm,
    slot,
    ready: true,
    joinedAt: event.startsAt,
    lastSeenAt: Date.now(),
  }));
  return {
    version: 'arena_room_v1',
    roomId: team.id,
    mode: 'arena_sparring_v1',
    rules: ARENA_SPARRING_RULES_V1,
    inviteCode: '',
    hostUserId: team.members.find((m) => m.cultivatorId === team.leaderId)!
      .userId,
    revision: team.revision,
    createdAt: event.startsAt,
    updatedAt: Date.now(),
    expiresAt: event.expiresAt,
    status: 'starting',
    startRequestId: team.startRequestId,
    teams: { alpha: seats, beta: [] },
    frozenRoster: {
      version: 'arena_frozen_roster_v1',
      startRequestId: team.startRequestId!,
      frozenAt: Date.now(),
      seats: seats.map((s) => ({ ...s, teamId: 'alpha' })),
    },
  };
}
export async function commandHuntTeam(
  actor: HuntActor,
  id: string,
  command: HuntTeamCommand,
) {
  return lock(async (lease) => {
    const team = await currentTeam(actor, lease);
    if (
      !team ||
      team.id !== id ||
      !team.members.some(
        (m) =>
          m.cultivatorId === actor.cultivatorId && m.userId === actor.userId,
      )
    )
      throw new ArenaV6Error('你尚未加入这支队伍', 403);
    if (
      command.type === 'start' &&
      team.status === 'in_battle' &&
      team.leaderId === actor.cultivatorId
    )
      return team;
    if (command.type !== 'recruit' && team.revision !== command.revision)
      throw new ArenaV6Error('队员有变，请确认名单后再试');
    if (team.status === 'in_battle')
      throw new ArenaV6Error('战斗中不能调整队伍');
    if (command.type === 'leave') {
      if (team.status === 'starting')
        throw new ArenaV6Error('队伍正在出战，请稍候');
      const members = team.members
        .filter((m) => m.cultivatorId !== actor.cultivatorId)
        .map((m) => ({ ...m, ready: false }));
      const next = {
        ...team,
        members,
        leaderId: members.some((m) => m.cultivatorId === team.leaderId)
          ? team.leaderId
          : (members[0]?.cultivatorId ?? ''),
        revision: team.revision + 1,
      };
      await saveTeam(next, team, lease);
      return null;
    }
    if (command.type === 'ready') {
      if (team.status !== 'assembling') throw new ArenaV6Error('正在开战');
      const self = await member(actor, team.event);
      if (!huntRealmAllowed(team, self.realm))
        throw new ArenaV6Error('你的境界不在这支队伍的招募范围内');
      const next = {
        ...team,
        members: team.members.map((m) =>
          m.cultivatorId === actor.cultivatorId
            ? { ...self, ready: command.ready }
            : m,
        ),
        revision: team.revision + 1,
      };
      await saveTeam(next, team, lease);
      return next;
    }
    if (command.type === 'target') {
      if (team.leaderId !== actor.cultivatorId)
        throw new ArenaV6Error('只有队长可以更换目标', 403);
      if (team.status !== 'assembling')
        throw new ArenaV6Error('出战中不能更换目标');
      const event = command.eventId ? requireEvent(command.eventId) : null;
      if ((team.event?.id ?? null) === (event?.id ?? null)) return team;
      const members: HuntMember[] = [];
      for (const current of team.members)
        members.push({ ...(await member(current, event)), ready: false });
      const next = {
        ...team,
        event,
        members,
        revision: team.revision + 1,
      };
      await saveTeam(next, team, lease);
      return next;
    }
    if (command.type === 'recruit') {
      if (team.leaderId !== actor.cultivatorId)
        throw new ArenaV6Error('只有队长可以召集', 403);
      if (team.status !== 'assembling')
        throw new ArenaV6Error('出战中无法召集');
      if (team.members.length >= 4) throw new ArenaV6Error('队伍已满');
      const identity = await readCultivatorPublicIdentity(actor.cultivatorId);
      const cooldown = await checkAndAcquireCooldown(
        actor.cultivatorId,
        identity.realm,
      );
      if (!cooldown.allowed)
        throw new ArenaV6Error(`请 ${cooldown.remainingSeconds} 秒后再召集`);
      const target = team.event
        ? `目标${team.event.realm}期·${HUNT_BOSSES[team.event.bossId].name}（${team.event.locationName}）`
        : '尚未选定讨伐目标';
      const text = `${identity.name}召集道友结伴。${team.minRealm}至${team.maxRealm}。${target}。现有${team.members.length}/4人。`;
      await createAndPublishWorldChatMessage({
        senderUserId: actor.userId,
        senderCultivatorId: actor.cultivatorId,
        senderName: identity.name,
        senderRealm: identity.realm,
        senderRealmStage: identity.realmStage,
        channel: 'world',
        messageType: 'hunt_recruit',
        textContent: text,
        payload: {
          version: 1,
          teamId: team.id,
          text,
          minRealm: team.minRealm,
          maxRealm: team.maxRealm,
          memberCount: team.members.length,
          ...(team.event
            ? {
                eventId: team.event.id,
                targetLabel: `${team.event.realm}期·${HUNT_BOSSES[team.event.bossId].name}`,
              }
            : {}),
        },
      });
      return team;
    }
    if (team.leaderId !== actor.cultivatorId)
      throw new ArenaV6Error('只有队长可以开战', 403);
    // Re-read every actor at admission; preparing a room never authorizes a build.
    const members: HuntMember[] = [];
    for (const m of team.members)
      members.push({ ...(await member(m, team.event)), ready: m.ready });
    const error = huntStartError(
      { ...team, members, status: 'assembling' },
      actor.cultivatorId,
      Date.now(),
    );
    if (error) throw new ArenaV6Error(error);
    const starting: HuntTeam = {
      ...team,
      members,
      status: 'starting',
      startRequestId:
        team.status === 'starting' ? team.startRequestId : crypto.randomUUID(),
      battleId: undefined,
      revision: team.revision + 1,
    };
    await saveTeam(starting, team, lease);
    try {
      const battleId = await createArenaV6(arenaRoom(starting), starting);
      const next = {
        ...starting,
        status: 'in_battle' as const,
        battleId,
        revision: starting.revision + 1,
      };
      await saveTeam(next, starting, lease);
      return next;
    } catch (error) {
      // If creation succeeded but its response was lost, leave the frozen roster for recovery.
      if (!(await battleStore.source(starting.id, starting.startRequestId!)))
        await saveTeam(
          {
            ...starting,
            status: 'assembling',
            members: starting.members.map((m) => ({ ...m, ready: false })),
            revision: starting.revision + 1,
          },
          starting,
          lease,
        );
      throw error;
    }
  });
}
export async function finishHuntTeam(
  id: string,
  battleId: string,
  startRequestId: string,
) {
  return lock(async (lease) => {
    const team = await readTeam(id);
    if (
      !team ||
      team.startRequestId !== startRequestId ||
      (team.battleId && team.battleId !== battleId) ||
      team.status === 'assembling'
    )
      return;
    const open = !!team.event && huntIsOpen(team.event, Date.now());
    const members: HuntMember[] = [];
    for (const m of team.members)
      members.push({
        ...m,
        ready: false,
        assisting:
          open && team.event
            ? await huntClaimed(team.event.id, m.cultivatorId)
            : false,
      });
    await saveTeam(
      {
        ...team,
        event: open ? team.event : null,
        status: 'assembling',
        members,
        battleId: undefined,
        lastBattleId: battleId,
        startRequestId: undefined,
        revision: team.revision + 1,
      },
      team,
      lease,
    );
  });
}
export async function cleanupHuntTeams() {
  const ids = await redis.zrangebyscore(
    'hunt:v1:team-events',
    0,
    Date.now(),
    'LIMIT',
    0,
    100,
  );
  for (const id of ids)
    await lock(async (lease) => {
      for (const team of await eventTeams(id)) {
        if (team.status === 'in_battle') continue;
        if (
          team.status === 'starting' &&
          team.startRequestId &&
          (await battleStore.source(team.id, team.startRequestId))
        )
          continue;
        await saveTeam(withoutTarget(team), team, lease);
      }
      if (!(await redis.scard(eventTeamsKey(id)))) {
        await redis.del(eventTeamsKey(id));
        await redis.zrem('hunt:v1:team-events', id);
      }
    });
}
