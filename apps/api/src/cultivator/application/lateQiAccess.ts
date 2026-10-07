import { hasReachedLateQiRefining } from '@daoyou/game-rules/progression/realm-access';
import { HttpException } from '@nestjs/common';
import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { readCultivatorRealm } from './readers/CultivatorFactsReader.js';

export async function assertLateQiRefining(
  cultivatorId: string,
  deniedMessage: string,
  executor?: DbExecutor,
): Promise<void> {
  let realm: Awaited<ReturnType<typeof readCultivatorRealm>>;
  try {
    realm = await readCultivatorRealm(cultivatorId, executor);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('角色不存在')) {
      throw new HttpException({ error: '角色不存在' }, 404);
    }
    throw error;
  }
  if (!hasReachedLateQiRefining(realm.realm, realm.realmStage)) {
    throw new HttpException({ error: deniedMessage }, 403);
  }
}
