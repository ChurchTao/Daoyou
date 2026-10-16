import { HttpException, Inject, Injectable } from '@nestjs/common';
import { startBreakthroughBattle } from '@server/combat/application/CombatV6BreakthroughService.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import { SystemCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService.js';
import { claimTaskRewardCommand } from '@server/tasks/application/TaskApplicationService.js';
import { TaskService } from '@server/tasks/application/TaskService.js';

@Injectable()
export class TasksService {
  private readonly reconciliation: SystemCommandExecutor;
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {
    this.reconciliation = new SystemCommandExecutor(database);
  }

  private async reconcile(actor: ActiveCultivatorRef) {
    await this.reconciliation.execute({
      source: 'tasks.reconcile',
      actor: { userId: actor.userId, cultivatorId: actor.cultivatorId },
      allowEmpty: true,
      command: async (tx) => {
        await lockCultivatorForStateMutation(tx, actor.cultivatorId);
        return {
          result: null,
          resourceChanges: await TaskService.synchronizeResourceChanges(
            actor.cultivatorId,
            tx,
          ),
        };
      },
    });
  }

  async list(actor: ActiveCultivatorRef, status?: 'active' | 'completed') {
    await this.reconcile(actor);
    return readResourceWithMeta(
      { kind: 'cultivator', id: actor.cultivatorId },
      'player.tasks',
      (tx) => TaskService.readCultivatorTasks(actor.cultivatorId, status, tx),
      this.database,
    );
  }

  async detail(actor: ActiveCultivatorRef, id: string) {
    await this.reconcile(actor);
    const task = await TaskService.getCultivatorTask(actor.cultivatorId, id);
    if (!task) throw new HttpException({ error: '任务不存在' }, 404);
    return { success: true, data: { task } };
  }

  async challenge(actor: ActiveCultivatorRef, id: string) {
    return {
      success: true,
      data: await startBreakthroughBattle(
        { userId: actor.userId, cultivatorId: actor.cultivatorId },
        id,
      ),
    };
  }

  async claim(actor: ActiveCultivatorRef, taskId: string) {
    return toPlayerStateMutationResponse(
      await claimTaskRewardCommand({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        taskId,
      }),
    );
  }
}
