import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient, DbExecutor } from '@server/lib/drizzle/db.js';
import {
  readCultivatorName,
  readCultivatorRealm,
} from './application/readers/CultivatorFactsReader.js';
import { getPlayerPreHeavenFates } from './application/readers/CultivatorProfileRepository.js';

/** Public character facts for application use cases outside this feature. */
@Injectable()
export class CultivatorQueriesService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  name(cultivatorId: string, executor: DbExecutor = this.database) {
    return readCultivatorName(cultivatorId, executor);
  }

  realm(cultivatorId: string, executor: DbExecutor = this.database) {
    return readCultivatorRealm(cultivatorId, executor);
  }

  async preHeavenFates(
    userId: string,
    cultivatorId: string,
    executor: DbExecutor = this.database,
  ) {
    return (
      (await getPlayerPreHeavenFates(userId, cultivatorId, executor)) ?? []
    );
  }
}
