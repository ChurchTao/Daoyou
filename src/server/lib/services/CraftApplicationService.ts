import type { DbTransaction } from '@server/lib/drizzle/db';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { AlchemyMode } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import { randomUUID } from 'node:crypto';
import { assertAlchemyMaterialVersions } from './alchemy/AlchemyInventory';
import { prepareFormulaCraft } from './AlchemyFormulaService';
import { prepareAlchemyCraft } from './alchemyServiceV2';
import {
  playerCommandExecutor,
  type CommittedCommand,
} from './CommandExecutors';
import { readCultivatorName } from './cultivator/CultivatorFactsReader';
import { assertInventoryIdle } from './InventoryService';
import {
  qiCurrencyChange,
  type QiSettlementBaseline,
} from './QiResourceChanges';
import { QiService } from './QiService';

export type CraftCommandInput = {
  materialIds: string[];
  materialVersions: Record<string, string>;
  craftType: 'alchemy';
  alchemyMode?: AlchemyMode;
  formulaId?: string;
  analysisId?: string;
  materialQuantities?: Record<string, number>;
  userPrompt?: string;
};

export async function executeCraftCommand(args: {
  userId: string;
  cultivatorId: string;
  input: CraftCommandInput;
}): Promise<CommittedCommand<unknown>> {
  const { input } = args;
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
        ? await prepareAlchemyCraft(args.cultivatorId, input.materialIds, {
            materialQuantities: input.materialQuantities,
            userPrompt: normalizedUserPrompt,
          })
        : await prepareFormulaCraft(
            args.cultivatorId,
            input.formulaId!,
            input.materialIds,
            input.materialQuantities,
            input.analysisId,
          );
    let afterCommit: (() => Promise<void>) | undefined;
    const domainEventIds: string[] = [];
    const actionInstanceId = randomUUID();
    const committed = await playerCommandExecutor.executeWithLock({
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      source: `alchemy_${mode}`,
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
            consumables:
              (
                preparedCommit.result as {
                  craftedConsumables?: Consumable[];
                  consumables?: Consumable[];
                  consumable?: Consumable;
                }
              ).craftedConsumables ??
              (
                preparedCommit.result as {
                  consumables?: Consumable[];
                  consumable?: Consumable;
                }
              ).consumables ??
              [
                (preparedCommit.result as { consumable?: Consumable })
                  .consumable,
              ].filter((item): item is Consumable => Boolean(item)),
          },
          tx,
        );
        if (rumorEventId) domainEventIds.push(rumorEventId);
        return {
          result: preparedCommit.result,
          resourceChanges: settleAlchemyCraft({
            qi: qiReservation,
            inventoryChanges: preparedCommit.inventoryChanges,
          }),
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
  inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
}): ResourceChangeDescriptor[] {
  const changes: ResourceChangeDescriptor[] = [
    qiCurrencyChange('currency.changed', args.qi),
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
