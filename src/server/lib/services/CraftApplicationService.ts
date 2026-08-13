import type { DbTransaction } from '@server/lib/drizzle/db';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { publishTransactionalMessageBestEffort } from '@server/lib/mq/transactionalMessagePublisher';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock';
import { getPlayerLoadoutByCultivatorId } from '@server/lib/services/cultivator/CultivatorLoadoutReader';
import { normalizeFreeformLlmInput } from '@server/utils/llmPayload';
import type { QiAction } from '@shared/config/qiSystem';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { type CreationCraftType } from '@shared/engine/creation-v2/config/CreationCraftPolicy';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import type { ResourceOperationSettlement } from '@shared/engine/resource/types';
import {
  QUALITY_ORDER,
  type ElementType,
  type EquipmentSlot,
  type Quality,
} from '@shared/types/constants';
import type { AlchemyMode } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import type { ItemShowcaseSnapshotMap } from '@shared/types/world-chat';
import { randomUUID } from 'node:crypto';
import { prepareFormulaCraft } from './AlchemyFormulaService';
import { prepareAlchemyCraft } from './alchemyServiceV2';
import {
  playerCommandExecutor,
  type CommittedCommand,
} from './CommandExecutors';
import {
  abandonPending,
  prepareCreation,
  prepareCreationConfirmation,
} from './creationServiceV2';
import { readCultivatorName } from './cultivator/CultivatorFactsReader';
import { readPlayerProgress } from './PlayerResourceReaderService';
import {
  qiCurrencyChange,
  type QiSettlementBaseline,
} from './QiResourceChanges';
import { QiService } from './QiService';

type CraftTargetPolicy = {
  team: 'enemy' | 'ally' | 'self' | 'any';
  scope: 'single' | 'aoe' | 'random';
  maxTargets?: number;
};

export type CraftCommandInput = {
  materialIds: string[];
  craftType: CreationCraftType | 'alchemy';
  alchemyMode?: AlchemyMode;
  formulaId?: string;
  analysisId?: string;
  materialQuantities?: Record<string, number>;
  userPrompt?: string;
  requestedSlot?: EquipmentSlot;
  requestedTargetPolicy?: CraftTargetPolicy;
};

type BroadcastableCreationResult = {
  id: string;
  productType: CreationProductType;
  name: string;
  description: string | null;
  element: string | null;
  quality: string | null;
  slot: string | null;
  score: number;
  productModel: Record<string, unknown>;
  needs_replace?: boolean;
};

export async function executeCraftCommand(args: {
  userId: string;
  cultivatorId: string;
  input: CraftCommandInput;
}): Promise<CommittedCommand<unknown>> {
  const { input } = args;
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
        const qiReservation = await QiService.reserveQi({
          cultivatorId: args.cultivatorId,
          action: craftQiAction('alchemy', mode),
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
            consumables: (preparedCommit.result as { craftedConsumables?: Consumable[]; consumables?: Consumable[]; consumable?: Consumable })
              .craftedConsumables ?? (preparedCommit.result as { consumables?: Consumable[]; consumable?: Consumable })
              .consumables ?? [
                (preparedCommit.result as { consumable?: Consumable }).consumable,
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

  const creationCraftType = input.craftType;
  const prepared = await prepareCreation(
    args.cultivatorId,
    input.materialIds,
    creationCraftType,
    {
      materialQuantities: input.materialQuantities,
      userPrompt: normalizedUserPrompt,
      requestedSlot: input.requestedSlot,
      requestedTargetPolicy: input.requestedTargetPolicy,
    },
  );
  let afterCommit: (() => Promise<void>) | undefined;
  let domainEventId: string | undefined;
  const actionInstanceId = randomUUID();
  const committed = await playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: `creation_${creationCraftType}`,
    lock: {
      context: `creation-${creationCraftType}`,
      timeoutMs: 60_000,
    },
    command: async (tx) => {
      const qiReservation = await QiService.reserveQi({
        cultivatorId: args.cultivatorId,
        action: craftQiAction(creationCraftType),
        actionInstanceId,
        metadata: {
          craftType: creationCraftType,
          materialCount: input.materialIds.length,
          requestedSlot: input.requestedSlot,
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
      domainEventId = await createCreationItemCreatedEvent(
        {
          userId: args.userId,
          cultivatorId: args.cultivatorId,
          cultivatorName,
          actionInstanceId,
          item: preparedCommit.result as BroadcastableCreationResult,
        },
        tx,
      );
      return {
        result: preparedCommit.result,
        resourceChanges: await settleCreationCraft({
          cultivatorId: args.cultivatorId,
          tx,
          craftType: creationCraftType,
          qi: qiReservation,
          needsReplace: Boolean(preparedCommit.result.needs_replace),
          inventoryChanges: preparedCommit.inventoryChanges,
        }),
      };
    },
  });
  await runAfterCommit(
    afterCommit,
    args.cultivatorId,
    `creation_${creationCraftType}`,
  );
  publishTransactionalMessageBestEffort(domainEventId, {
    source: `creation_${creationCraftType}`,
    cultivatorId: args.cultivatorId,
  });
  return committed;
}

export async function executeCreationConfirmationCommand(args: {
  userId: string;
  cultivatorId: string;
  craftType: CreationCraftType;
  replaceId?: string | null;
  abandon?: boolean;
}): Promise<
  | { kind: 'abandoned'; message: string }
  | {
      kind: 'committed';
      committed: CommittedCommand<{
        message: string;
        item: unknown;
      }>;
    }
> {
  const { name: cultivatorName } = await readCultivatorName(args.cultivatorId);
  if (args.abandon) {
    await withRedisLock(
      {
        key: redisLockKeys.cultivatorMutation(args.cultivatorId),
        context: 'creation-abandon',
        timeoutMs: 10_000,
        retries: 0,
      },
      async (lease) => {
        lease.assertHeld();
        await abandonPending(args.cultivatorId, args.craftType);
        lease.assertHeld();
      },
    );
    return { kind: 'abandoned', message: '已放弃新生成的感悟' };
  }
  const prepared = await prepareCreationConfirmation(
    args.cultivatorId,
    args.craftType,
    args.replaceId ?? null,
  );
  let afterCommit: (() => Promise<void>) | undefined;
  let domainEventId: string | undefined;
  const actionInstanceId = randomUUID();
  const committed = await playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'creation_confirm',
    lock: { context: 'creation-confirm', timeoutMs: 10_000 },
    command: async (tx) => {
      const preparedCommit = await prepared.commit(tx);
      afterCommit = preparedCommit.afterCommit;
      domainEventId = await createCreationItemCreatedEvent(
        {
          userId: args.userId,
          cultivatorId: args.cultivatorId,
          cultivatorName,
          actionInstanceId,
          item: preparedCommit.result as BroadcastableCreationResult,
        },
        tx,
      );
      return {
        result: {
          message: '领悟成功，已纳入道基',
          item: preparedCommit.result,
        },
        resourceChanges: await settleCreationConfirmation({
          craftType: args.craftType,
          cultivatorId: args.cultivatorId,
          tx,
          inventoryChanges: preparedCommit.inventoryChanges,
        }),
      };
    },
  });
  await runAfterCommit(afterCommit, args.cultivatorId, 'creation_confirm');
  publishTransactionalMessageBestEffort(domainEventId, {
    source: 'creation_confirm',
    cultivatorId: args.cultivatorId,
  });
  return { kind: 'committed', committed };
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

export async function settleCreationCraft(args: {
  cultivatorId: string;
  tx: DbTransaction;
  craftType: CreationCraftType;
  qi: QiSettlementBaseline;
  needsReplace?: boolean;
  inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
}): Promise<ResourceChangeDescriptor[]> {
  const changes: ResourceChangeDescriptor[] = [
    qiCurrencyChange('currency.changed', args.qi),
  ];
  for (const change of args.inventoryChanges) {
    changes.push(
      change.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.creation.changed',
            operation: 'upsert-items',
            payload: { idKey: 'id', items: [change.item] },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.creation.changed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [change.id] },
          } as ResourceChangeDescriptor),
    );
  }
  if (args.craftType === 'create_skill' || args.craftType === 'create_gongfa') {
    const progress = await readPlayerProgress(args.cultivatorId, args.tx);
    changes.push({
      resourceTopic: 'player.progress',
      eventType: 'progress.changed',
      operation: 'replace',
      payload: progress,
    });
  }
  if (
    !args.needsReplace &&
    (args.craftType === 'create_skill' || args.craftType === 'create_gongfa')
  ) {
    const loadout = await getPlayerLoadoutByCultivatorId(
      args.cultivatorId,
      args.tx,
    );
    changes.push({
      resourceTopic: 'player.loadout',
      eventType: 'loadout.changed',
      operation: 'replace',
      payload: loadout,
    });
  }
  return changes;
}

export async function settleCreationConfirmation(args: {
  craftType: CreationCraftType;
  cultivatorId: string;
  tx: DbTransaction;
  inventoryChanges: ResourceOperationSettlement['inventoryChanges'];
}): Promise<ResourceChangeDescriptor[]> {
  const loadout = await getPlayerLoadoutByCultivatorId(
    args.cultivatorId,
    args.tx,
  );
  return [
    {
      resourceTopic: 'player.loadout',
      eventType: 'loadout.changed',
      operation: 'replace',
      payload: loadout,
    },
    ...args.inventoryChanges.map((change) =>
      change.operation === 'upsert'
        ? ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.creation.confirmed',
            operation: 'upsert-items',
            payload: { idKey: 'id', items: [change.item] },
          } as ResourceChangeDescriptor)
        : ({
            resourceTopic: `inventory.${change.kind}`,
            eventType: 'inventory.creation.confirmed',
            operation: 'remove-items',
            payload: { idKey: 'id', ids: [change.id] },
          } as ResourceChangeDescriptor),
    ),
  ];
}

function craftQiAction(
  craftType: CreationCraftType | 'alchemy',
  alchemyMode?: AlchemyMode,
): QiAction {
  if (craftType === 'alchemy') {
    return alchemyMode === 'formula' ? 'alchemy_formula' : 'alchemy_improvised';
  }
  if (craftType === 'refine') return 'creation_artifact';
  if (craftType === 'create_gongfa') return 'creation_gongfa';
  return 'creation_skill';
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

function buildCreationShowcaseSnapshot(
  item: BroadcastableCreationResult,
): ItemShowcaseSnapshotMap[CreationProductType] {
  if (item.productType === 'artifact') {
    return {
      id: item.id,
      name: item.name,
      slot: item.slot as ItemShowcaseSnapshotMap['artifact']['slot'],
      element: item.element as ItemShowcaseSnapshotMap['artifact']['element'],
      quality: item.quality as ItemShowcaseSnapshotMap['artifact']['quality'],
      description: item.description ?? undefined,
      productModel: item.productModel,
    };
  }
  if (item.productType === 'skill') {
    return {
      id: item.id,
      name: item.name,
      productType: 'skill',
      element: item.element as ElementType | null,
      quality: item.quality as Quality | null,
      description: item.description,
      score: item.score,
      productModel: item.productModel,
    };
  }
  return {
    id: item.id,
    name: item.name,
    productType: 'gongfa',
    element: item.element as ElementType | null,
    quality: item.quality as Quality | null,
    description: item.description,
    score: item.score,
    productModel: item.productModel,
  };
}

async function createCreationItemCreatedEvent(
  args: {
    userId: string;
    cultivatorId: string;
    cultivatorName: string;
    actionInstanceId: string;
    item: BroadcastableCreationResult;
  },
  tx: DbTransaction,
): Promise<string | undefined> {
  if (
    !args.item.id ||
    args.item.needs_replace ||
    !isKnownQuality(args.item.quality)
  ) {
    return undefined;
  }
  const event = await createDomainEvent(
    {
      type: 'craft.item.created',
      aggregate: { type: 'creation-product', id: args.item.id },
      data: {
        userId: args.userId,
        cultivatorId: args.cultivatorId,
        cultivatorName: args.cultivatorName,
        itemType: args.item.productType,
        itemId: args.item.id,
        itemName: args.item.name,
        quality: args.item.quality,
        snapshot: buildCreationShowcaseSnapshot(args.item) as unknown as Record<
          string,
          unknown
        >,
      },
      deduplicationKey: `${args.cultivatorId}:craft-item:${args.actionInstanceId}`,
    },
    tx,
  );
  return event.id;
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
