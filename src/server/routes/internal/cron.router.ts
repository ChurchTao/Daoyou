import {
  runAuctionExpireJob,
  runBetBattleExpireJob,
  runRankRewardsJob,
} from '@server/lib/jobs/internalCron';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';

function getCronAuthorizationError(
  request: Request,
): { error: string; status: 401 | 500 } | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      return {
        error: 'CRON_SECRET is required in production',
        status: 500,
      };
    }

    return null;
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return {
      error: 'Unauthorized',
      status: 401,
    };
  }

  return null;
}

async function handleCronRequest(
  request: Request,
  runJob: () => Promise<unknown>,
): Promise<Response> {
  const authError = getCronAuthorizationError(request);
  if (authError) {
    return Response.json(
      { success: false, error: authError.error },
      { status: authError.status },
    );
  }

  try {
    return Response.json(await runJob());
  } catch {
    return Response.json(
      { success: false, error: 'Cron job execution failed' },
      { status: 500 },
    );
  }
}

const router = new Hono<AppEnv>();

router.get('/auction-expire', (c) =>
  handleCronRequest(c.req.raw, runAuctionExpireJob),
);

router.get('/bet-battle-expire', (c) =>
  handleCronRequest(c.req.raw, runBetBattleExpireJob),
);

router.get('/rank-rewards', (c) =>
  handleCronRequest(c.req.raw, runRankRewardsJob),
);

export default router;
