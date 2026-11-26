import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { Consumable } from '@daoyou/game-domain/character';
import type { AlchemyMode } from '@daoyou/game-domain/consumables';
import { hasBreakthroughFocusEffect } from '@daoyou/game-rules/consumables/breakthrough';
import type { ResourceOperationSettlement } from '@daoyou/game-domain/resources';
import type { AiService } from '@nestjs/ai';
import { prepareFormulaCraft } from '@server/alchemy/application/AlchemyFormulaService.js';
import { createAlchemyService } from '@server/alchemy/application/alchemyServiceV2.js';
import { assertAlchemyMaterialVersions } from '@server/alchemy/application/inventory/AlchemyInventory.js';
import {
  qiCurrencyPatch,
  type QiSettlementBaseline,
} from '@server/cultivator/application/QiResourceChanges.js';
import { QiService } from '@server/cultivator/application/QiService.js';
import { readCultivatorName } from '@server/cultivator/facts.js';
import { assertInventoryIdle } from '@server/inventory/operations.js';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher.js';
import { findPlayerMutationRequest } from '@server/lib/repositories/playerStateRepository.js';
import {
  playerCommandExecutor,
  type CommittedCommand,
} from '@server/player/application/state/CommandExecutors.js';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload.js';
import { StoryService } from '@server/story/application/StoryService.js';
import { eq } from 'drizzle-orm';

export type CraftCommandInput = {
  requestId: string;
  materialIds: string[];
  materialVersions: Record<string, string>;
  craftType: 'alchemy';
  alchemyMode?: AlchemyMode;
  formulaId?: string;
  analysisId?: string;
  materialQuantities?: Record<string, number>;
  userPrompt?: string;
};

export async function executeCraftCommand(
  ai: AiService,
  args: {
    userId: string;
    cultivatorId: string;
    input: CraftCommandInput;
  },
): Promise<CommittedCommand<unknown>> {
  const { input } = args;
  const source = `alchemy_${input.alchemyMode ?? 'improvised'}`;
  const idempotency = {
    key: input.requestId,
    fingerprint: JSON.stringify(input),
  };
  if (
    await findPlayerMutationRequest(args.cultivatorId, source, input.requestId)
  ) {
    return playerCommandExecutor.executeWithLock({
      userId: args.userId, cultivatorId: args.cultivatorId, source, idempotency,
      command: async () => { throw new Error('炼丹执行凭据已失效'); },
    });
  }
  await assertInventoryIdle(args.cultivatorId);
  const { name: cultivatorName } = await readCultivatorName(args.cultivatorId);
  if (input.materialIds.length === 0) {
    throw new CraftCommandError('参数缺失，请选择材料');
  }
  const normalizedUserPrompt = input.userPrompt
    ? normalizeFreeformLlmInput(input.userPrompt)
    : undefined;
  if (input.craftType === 'alchemy') {
    const mode = input.alchemyMode ?? 'improvised';
    if (mode === 'improvised' && !normalizedUserPrompt) {
      throw new CraftCommandError('请注入神念，描述丹药功效。');
    }
    if (mode === 'formula' && !input.formulaId) {
      throw new CraftCommandError('请先选定丹方。');
    }
    if (mode === 'formula' && !input.analysisId) {
      throw new CraftCommandError('请先推演药路。');
    }
    const prepared =
      mode === 'improvised'
        ? await createAlchemyService(ai).prepareAlchemyCraft(
            args.cultivatorId,
            input.materialIds,
            {
              materialQuantities: input.materialQuantities,
              userPrompt: normalizedUserPrompt,
            },
          )
        : await prepareFormulaCraft(
            args.cultivatorId,
            input.formulaId!,
            input.materialIds,
            input.materialQuantities,
            input.analysisId,
            input.materialVersions,
            input.requestId,
          );
    let afterCommit: (() => Promise<void>) | undefined;
    const domainEventIds: string[] = [];
    const actionInstanceId = input.requestId;
    const committed = await playerCommandExecutor.executeWithLock({
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      source: `alchemy_${mode}`,
      requestId: actionInstanceId,
      idempotency,
      lock: {
        context: `alchemy-${mode}`,
        timeoutMs: 60_000,
      },
      command: async (tx) => {
        await assertInventoryIdle(args.cultivatorId);
        await assertAlchemyMaterialVersions(
          args.cultivatorId,
          input.materialIds,
          input.materialVersions,
          tx,
        );
        const qiReservation = await QiService.reserveQi({
          cultivatorId: args.cultivatorId,
          action: mode === 'formula' ? 'alchemy_formula' : 'alchemy_improvised',
          actionInstanceId,
          cost: prepared.qiCost,
          metadata: {
            craftType: 'alchemy',
            alchemyMode: mode,
            materialCount: input.materialIds.length,
            formulaId: input.formulaId,
            qiCost: prepared.qiCost,
          },
          tx,
        });
        const preparedCommit = await prepared.commit(tx);
        afterCommit = preparedCommit.afterCommit;
        const potionResult = preparedCommit.result as {
          craftedConsumables?: Consumable[];
          consumables?: Consumable[];
          consumable?: Consumable;
        };
        const consumables = potionResult.craftedConsumables ??
          potionResult.consumables ??
          (potionResult.consumable ? [potionResult.consumable] : []);
        const foundationCrafted = consumables.some(({ spec }) =>
          spec.kind === 'pill' &&
          spec.alchemyMeta.breakthroughTargetRealm === '筑基' &&
          hasBreakthroughFocusEffect(spec.operations)
        );
        const story = foundationCrafted
          ? await StoryService.noteFact(args.cultivatorId, 'foundation_pill_crafted', tx)
          : null;
        await QiService.commitReservation({
          actionInstanceId,
          metadata: { committedAt: new Date().toISOString() },
          tx,
        });
        domainEventIds.push(
          await createDomainEvent(
            {
              type: 'alchemy.craft.completed',
              aggregate: {
                type: 'cultivator',
                id: args.cultivatorId,
              },
              data: {
                cultivatorId: args.cultivatorId,
                actionInstanceId,
                mode,
              },
              deduplicationKey: `${args.cultivatorId}:alchemy:${actionInstanceId}`,
            },
            tx,
          ).then((event) => event.id),
        );
        const rumorEventId = await createAlchemyItemCreatedEvent(
          {
            userId: args.userId,
            cultivatorId: args.cultivatorId,
            cultivatorName,
            actionInstanceId,
            consumables,
          },
          tx,
        );
        if (rumorEventId) domainEventIds.push(rumorEventId);
        const [balance] = await tx
          .select({ spiritStones: cultivators.spirit_stones })
          .from(cultivators)
          .where(eq(cultivators.id, args.cultivatorId));
        if (!balance) throw new Error('修真者不存在');
        return {
          result: preparedCommit.result,
          resourceChanges: settleAlchemyCraft({
            qi: qiReservation,
            spiritStones: balance.spiritStones,
            inventoryChanges: preparedCommit.inventoryChanges,
          }).concat(story?.changes ?? []),
        };
      },
    });
    await runAfterCommit(afterCommit, args.cultivatorId, `alchemy_${mode}`);
    for (const domainEventId of domainEventIds) {
      publishTransactionalMessageBestEffort(domainEventId, {
        source: `alchemy_${mode}`,
        cultivatorId: args.cultivatorId,
      });
    }
    return committed;
  }

  throw new CraftCommandError('旧造物生产已停用');
}

export class CraftCommandError extends Error {
  readonly status = 400;
}

export function settleAlchemyCraft(args: {
  qi: QiSettlementBaseline;
  spiritStones: number;
  inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    {
      resourceTopic: 'player.currency',
      eventType: 'currency.changed',
      operation: 'merge',
      payload: { ...qiCurrencyPatch(args.qi), spiritStones: args.spiritStones },
    },
    {
      resourceTopic: 'inventory.bag',
      eventType: 'inventory.alchemy.changed',
      operation: 'invalidate',
    },
  ];
  for (const change of args.inventoryChanges) {
    changes.push(
      change.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.alchemy.changed',
            operation: 'upsert-items',
            payload: { idKey: 'id', items: [change.item] },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.alchemy.changed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [change.id] },
          } as ResourceChangeDescriptor),
    );
  }
  return changes;
}

async function runAfterCommit(
  afterCommit: (() => Promise<void>) | undefined,
  cultivatorId: string,
  source: string,
): Promise<void> {
  if (!afterCommit) return;
  try {
    await afterCommit();
  } catch (error) {
    console.error('造物后置副作用失败:', { cultivatorId, source, error });
  }
}

function isKnownQuality(quality: string | null): quality is Quality {
  return typeof quality === 'string' && quality in QUALITY_ORDER;
}

async function createAlchemyItemCreatedEvent(
  args: {
    userId: string;
    cultivatorId: string;
    cultivatorName: string;
    actionInstanceId: string;
    consumables?: Consumable[];
    consumable?: Consumable;
  },
  tx: DbTransaction,
): Promise<string | undefined> {
  const consumables = args.consumables?.length
    ? args.consumables
    : args.consumable
      ? [args.consumable]
      : [];
  const primary = consumables[0];
  const quality = primary?.quality ?? null;
  if (!primary?.id || !isKnownQuality(quality)) {
    return undefined;
  }
  const event = await createDomainEvent(
    {
      type: 'craft.item.created',
      aggregate: { type: 'consumable', id: primary.id },
      data: {
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        cultivatorName: args.cultivatorName,
        itemType: 'consumable',
        itemId: primary.id,
        itemName: primary.name,
        quality,
        // Keep the historical object-shaped snapshot for existing consumers;
        // the complete batch is carried in the additive `outputs` field.
        snapshot: {
          id: primary.id,
          name: primary.name,
          type: primary.type,
          quality: primary.quality,
          quantity: primary.quantity,
          description: primary.description,
          spec: primary.spec,
        },
        outputs: consumables.map((consumable) => ({
          id: consumable.id,
          name: consumable.name,
          type: consumable.type,
          quality: consumable.quality,
          quantity: consumable.quantity,
          description: consumable.description,
          spec: consumable.spec,
        })),
      },
      deduplicationKey: `${args.cultivatorId}:craft-item:${args.actionInstanceId}`,
    },
    tx,
  );
  return event.id;
}
