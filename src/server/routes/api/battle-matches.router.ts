import { BattleBoardgameSessionClient } from '@server/lib/services/BattleBoardgameSessionClient';
import { BattleMatchmakerService } from '@server/lib/services/BattleMatchmakerService';
import { buildOnlineBattleMatchState } from '@server/lib/services/BattleOnlineMatchFactory';
import {
  acceptBattleMatchParticipant,
  createBattleMatchParticipants,
  getBattleMatchParticipant,
  listBattleMatchInvitations,
} from '@server/lib/services/BattleMatchParticipantRepository';
import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';
import { z } from 'zod';

const MatchIdSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const CreateOnlineMatchSchema = z.object({
  team: z.object({ cultivatorIds: z.array(z.string().uuid()).min(1).max(4) }),
  opponentTeam: z.object({ cultivatorIds: z.array(z.string().uuid()).min(1).max(4) }),
}).strict();

const router = new Hono<AppEnv>();
const sessionClient = new BattleBoardgameSessionClient();
const matchmaker = new BattleMatchmakerService();

router.get('/invitations', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  return c.json({ invitations: await listBattleMatchInvitations(user.id) });
});

router.post('/', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const body = CreateOnlineMatchSchema.parse(await c.req.json());
  const state = await buildOnlineBattleMatchState({
    matchId: `online-${crypto.randomUUID()}`,
    teams: [body.team, body.opponentTeam],
  });
  const ownControllers = state.controllers.filter((controller) => controller.teamId === 'alpha');
  if (!ownControllers.some((controller) => controller.playerId === user.id)) {
    return c.json({ error: '创建者必须控制己方队伍中的至少一个角色' }, 403);
  }
  const created = await matchmaker.createAndPrejoin({
    state,
    prejoinControllerIndexes: state.controllers
      .map((controller, index) => controller.playerId === user.id ? index : -1)
      .filter((index) => index >= 0),
    acceptedControllerIndexes: state.controllers
      .map((controller, index) => controller.playerId === user.id ? index : -1)
      .filter((index) => index >= 0),
  });
  await createBattleMatchParticipants(state.controllers.map((controller, index) => ({
    matchId: created.matchID,
    userId: controller.playerId,
    teamId: controller.teamId,
    boardgamePlayerId: String(index),
    cultivatorIds: controller.unitIds,
    status: controller.playerId === user.id ? 'accepted' : 'invited',
  })));
  const session = created.sessions.find((value) => value.playerID === String(
    state.controllers.findIndex((controller) => controller.playerId === user.id),
  ));
  return c.json({ matchID: created.matchID, session: session ?? null });
});

router.get('/:matchId/session', requireUser(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const participant = await getBattleMatchParticipant(matchId, user.id);
  if (!participant) return c.json({ error: '无权访问该对局' }, 403);
  if (participant.status !== 'accepted') return c.json({ error: '请先接受对局邀请' }, 409);
  try {
    const session = await sessionClient.getPlayerSession(matchId, user.id);
    if (!session) return c.json({ error: '对局不存在或尚未分配玩家席位' }, 404);
    return c.json({ session });
  } catch (error) {
    console.error('[battle-match-session] gateway failed', error);
    return c.json({ error: '战斗服务暂不可用' }, 503);
  }
});

router.post('/:matchId/accept', requireUser(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const participant = await getBattleMatchParticipant(matchId, user.id);
  if (!participant) return c.json({ error: '无权访问该对局' }, 403);
  const session = await matchmaker.joinPlayer(
    matchId,
    participant.boardgamePlayerId,
    user.id,
  ).catch((error) => {
    if (error instanceof Error && /already joined|already has/i.test(error.message)) return null;
    throw error;
  });
  await matchmaker.acceptPlayer(matchId, participant.boardgamePlayerId);
  await acceptBattleMatchParticipant(matchId, user.id);
  return c.json({ accepted: true, session });
});

export default router;
