import type { DbTransaction } from '@server/lib/drizzle/db';
import { invalidateActiveCultivatorRef } from '@server/lib/hono/middleware';
import {
  redisLockKeys,
  withRedisLock,
} from '@server/lib/redis/lock';
import {
  deleteTempData,
  getTempCharacter,
  getTempFates,
} from '@server/lib/repositories/redisCultivatorRepository';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { Cultivator } from '@shared/types/cultivator';
import { MailService } from './MailService';
import { TaskService } from './TaskService';
import { playerCommandExecutor } from './CommandExecutors';
import {
  createCultivator,
  hasActiveCultivator,
} from '@server/lib/services/cultivator/CultivatorProfileRepository';

export async function executeCultivatorCreationCommand(
  userId: string,
  cultivator: Cultivator,
  tx: DbTransaction,
): Promise<{
  cultivatorId: string;
  result: null;
  resourceChanges: ResourceChangeDescriptor[];
}> {
  const created = await createCultivator(userId, cultivator, tx);
  if (!created.id) {
    throw new Error('创建角色后缺少角色标识');
  }

  await TaskService.syncCultivatorTasks(created.id, tx);
  await MailService.sendNewRewardMail(
    created.id,
    '仙缘初结·新手礼包',
    '恭喜道友踏入仙途！大道争锋，财侣法地缺一不可。这有些许灵石，聊表心意，助道友仙路顺遂。',
    [{ type: 'spirit_stones', name: '灵石', quantity: 20000 }],
    'reward',
    tx,
  );

  return {
    cultivatorId: created.id,
    result: null,
    resourceChanges: [
      {
        resourceTopic: 'player.session',
        eventType: 'cultivator.created',
        operation: 'replace',
        payload: {
          activeCultivator: {
            id: created.id,
            status: 'active',
            sectId: null,
          },
        },
      },
    ],
  };
}

export class CultivatorCreationCommandError extends Error {}

export function createCultivatorFromTemp(args: {
  userId: string;
  tempCultivatorId: string;
  selectedFateIndices: number[];
}) {
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorCreation(args.userId),
      context: 'save-character',
      timeoutMs: 30_000,
      retries: 0,
    },
    async () => {
      if (await hasActiveCultivator(args.userId)) {
        throw new CultivatorCreationCommandError(
          '您已经拥有一位道身，无法创建新的道身',
        );
      }
      const [cultivator, fates] = await Promise.all([
        getTempCharacter(args.tempCultivatorId),
        getTempFates(args.tempCultivatorId),
      ]);
      if (!cultivator) {
        throw new CultivatorCreationCommandError(
          '角色数据已过期，请重新生成',
        );
      }
      if (!fates) {
        throw new CultivatorCreationCommandError(
          '气运数据丢失，请重新生成',
        );
      }
      const selected = args.selectedFateIndices
        .filter((index) => index >= 0 && index < fates.length)
        .map((index) => fates[index]);
      if (selected.length !== 3) {
        throw new CultivatorCreationCommandError('气运选择有误');
      }
      cultivator.pre_heaven_fates = selected;
      const committed = await playerCommandExecutor.executeInitial({
        userId: args.userId,
        source: 'cultivator_created',
        command: (tx) =>
          executeCultivatorCreationCommand(args.userId, cultivator, tx),
      });
      await invalidateActiveCultivatorRef(args.userId);
      await deleteTempData(args.tempCultivatorId);
      return committed;
    },
  );
}
