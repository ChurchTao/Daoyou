import { getExecutor } from '@server/lib/drizzle/db';
import { getValidatedJson, requireActiveCultivator, validateJson } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { commitPlayerStateMutation, toPlayerStateMutationResponse } from '@server/lib/services/PlayerStateMutationService';
import { SectCommissionService } from '@server/lib/services/SectCommissionService';
import { SectError, SectService } from '@server/lib/services/SectService';
import {
  SectAbilityLoadoutRequestSchema,
  SectMeridianLoadoutRequestSchema,
  SectMethodTrainRequestSchema,
  SectTacticRequestSchema,
} from '@shared/contracts/sect';
import { getSectMethodLevelCap, listUnlockedAbilityIds, type CultivatorSectState, type SectTacticId } from '@shared/engine/sect';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { Cultivator } from '@shared/types/cultivator';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { getPlayerRuntimeCultivatorById } from '@server/lib/services/cultivatorService';
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { DbTransaction } from '@server/lib/drizzle/db';

const router = new Hono<AppEnv>();

function failure(c: Parameters<Parameters<typeof router.onError>[0]>[1], error: unknown) {
  if (error instanceof SectError) return c.json({ success: false as const, error: error.message, code: error.code }, error.status as 400 | 409);
  console.error('[sects]', error);
  return c.json({ success: false as const, error: '宗门事务处理失败' }, 500);
}

router.get('/current', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  const sect = await SectService.getState(cultivator.id!, getExecutor());
  const commission = await SectCommissionService.getToday(cultivator.id!, getExecutor());
  return c.json({ success: true, data: {
    playerRace: cultivator.playerRace ?? 'human', raceNarrative: cultivator.raceNarrative,
    sect: sect ?? null,
    methodLevelCap: getSectMethodLevelCap(cultivator.realm as RealmType, cultivator.realm_stage as RealmStage),
    knownAbilityIds: sect ? listUnlockedAbilityIds(sect) : [], commission,
  } });
});

router.post('/lingxiao/experience', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const runtimeCultivator = await getPlayerRuntimeCultivatorById(user.id, cultivator.id, getExecutor());
    if (!runtimeCultivator) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const borrowedSect: CultivatorSectState = {
      membershipId: 'trial', sectId: 'lingxiao', status: 'active', pathId: undefined,
      contribution: 0, tacticId: 'steady', activeMeridianSlot: 1, configVersion: 1,
      methods: { 'lingxiao-canon': 10, 'sword-guidance': 10 },
      meridianLoadouts: [{ slot: 1, nodeIds: [], version: 1 }, { slot: 2, nodeIds: [], version: 1 }, { slot: 3, nodeIds: [], version: 1 }],
      abilityLoadout: ['guiding-sword', 'linked-edge', null, null],
    };
    const trainee: Cultivator = { ...runtimeCultivator, sect: borrowedSect, skills: [] };
    const opponent: Cultivator = { ...trainee, id: `${cultivator.id}-wooden`, name: '凌霄试剑木人', sect: undefined, skills: [] };
    const battle = simulateBattleV5(trainee, opponent);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_experience', run: async (tx) => {
      const sect = await SectService.recordExperience(cultivator.id!, tx);
      return {
        result: { sect, battle },
        changes: [{ domain: 'sect' as const, eventType: 'sect.experienced', patch: { sect } }],
      };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/lingxiao/join', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_join', run: async (tx) => {
      const sect = await SectService.join(cultivator.id!, tx);
      return { result: { sect }, changes: [
        { domain: 'sect' as const, eventType: 'sect.joined', patch: { sect }, invalidates: ['profile' as const] },
        { domain: 'loadout' as const, eventType: 'sect.created_skills_unequipped' },
      ] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/methods/:methodId/train', requireActiveCultivator(), validateJson(SectMethodTrainRequestSchema), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const body = getValidatedJson<{ targetLevel: number }>(c);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_method_train', run: async (tx) => {
      const result = await SectService.trainMethod({ cultivatorId: cultivator.id!, methodId: c.req.param('methodId'), targetLevel: body.targetLevel }, tx);
      return { result, changes: [
        { domain: 'sect' as const, eventType: 'sect.method_trained', patch: { sect: result.sect } },
        { domain: 'currency' as const, eventType: 'sect.method_cost_paid' },
      ] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/paths/swift-sword/select', requireActiveCultivator(), async (c) => mutateSect(c, 'sect_path_select', (id, tx) => SectService.selectSwiftPath(id, tx), 'sect.path_selected'));

router.put('/meridian-loadouts/:slot', requireActiveCultivator(), validateJson(SectMeridianLoadoutRequestSchema), async (c) => {
  const body = getValidatedJson<{ nodeIds: string[] }>(c);
  return mutateSect(c, 'sect_meridian_update', (id, tx) => SectService.setMeridianLoadout(id, Number(c.req.param('slot')), body.nodeIds, tx), 'sect.meridian_updated');
});
router.post('/meridian-loadouts/:slot/activate', requireActiveCultivator(), async (c) => mutateSect(c, 'sect_meridian_activate', (id, tx) => SectService.activateMeridianLoadout(id, Number(c.req.param('slot')), tx), 'sect.meridian_activated'));
router.put('/ability-loadout', requireActiveCultivator(), validateJson(SectAbilityLoadoutRequestSchema), async (c) => {
  const body = getValidatedJson<{ abilityIds: Array<string | null> }>(c);
  return mutateSect(c, 'sect_ability_loadout', (id, tx) => SectService.setAbilityLoadout(id, body.abilityIds, tx), 'sect.ability_loadout_updated', true);
});
router.put('/tactic', requireActiveCultivator(), validateJson(SectTacticRequestSchema), async (c) => {
  const body = getValidatedJson<{ tacticId: SectTacticId }>(c);
  return mutateSect(c, 'sect_tactic', (id, tx) => SectService.setTactic(id, body.tacticId, tx), 'sect.tactic_updated');
});

router.post('/commissions/spar', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const runtimeCultivator = await getPlayerRuntimeCultivatorById(user.id, cultivator.id, getExecutor());
    if (!runtimeCultivator) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    const opponent: Cultivator = { ...runtimeCultivator, id: `${cultivator.id}-spar`, name: '试剑木人' };
    const battle = simulateBattleV5(runtimeCultivator, opponent);
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_commission_spar', allowEmpty: true, run: async (tx) => {
      const completed = await SectCommissionService.recordEvent(cultivator.id!, 'spar', tx);
      return { result: { completed, battle }, changes: completed ? [{ domain: 'sect' as const, eventType: 'sect.commission_completed' }] : [] };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

router.post('/commissions/claim', requireActiveCultivator(), async (c) => {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source: 'sect_commission_claim', run: async (tx) => {
      const result = await SectCommissionService.claim(cultivator.id!, cultivator.realm as RealmType, tx);
      return {
        result,
        changes: [{ domain: 'sect' as const, eventType: 'sect.commission_claimed', patch: { sect: result.sect } }],
      };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
});

async function mutateSect(c: Context<AppEnv>, source: string, run: (cultivatorId: string, tx: DbTransaction) => Promise<CultivatorSectState>, eventType: string, loadout = false) {
  const user = c.get('user'); const cultivator = c.get('cultivator');
  if (!user || !cultivator?.id) return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  try {
    const committed = await commitPlayerStateMutation({ userId: user.id, cultivatorId: cultivator.id, source, run: async (tx) => {
      const sect = await run(cultivator.id, tx);
      return {
        result: { sect },
        changes: [{ domain: 'sect' as const, eventType, patch: { sect } }, ...(loadout ? [{ domain: 'loadout' as const, eventType: 'sect.ability_loadout_changed' }] : [])],
      };
    } });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) { return failure(c, error); }
}

export default router;
