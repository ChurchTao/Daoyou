import type {
  InscriptionRequest,
  InscriptionResult,
  InscriptionView,
} from '@shared/contracts/inscriptions';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import {
  prepareInscriptionDraw,
  prepareInscriptionEquipment,
  prepareInscriptionStrengthen,
  rollInscriptionDraw,
  type InscriptionCost,
} from '@shared/inscriptions/rules';
import {
  addItems,
  type InventoryItem,
  type ItemGrant,
} from '@shared/inventory';
import { inventoryStackIdentity } from '@shared/inventory/stack-key';
import { projectNaturalQiState } from '@shared/lib/qi';
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { db, type DbExecutor } from '../drizzle/db';
import { cultivators, inventoryItems } from '../drizzle/schema';
import type { ActiveCultivatorRef } from '../hono/types';
import { playerCommandExecutor } from './CommandExecutors';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from './InventoryService';
import { QiService } from './QiService';

async function characterOf(actor: ActiveCultivatorRef, tx: DbExecutor) {
  const [character] = await tx
    .select()
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    );
  if (!character) throw new InventoryError('角色不可用');
  return character;
}

export async function readInscriptions(
  actor: ActiveCultivatorRef,
): Promise<InscriptionView> {
  return db.transaction(
    async (tx) => {
      const character = await characterOf(actor, tx);
      let blockedReason: string | null = null;
      try {
        await assertInventoryIdle(actor.cultivatorId, tx);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = error.message;
      }
      return {
        ownerId: character.id,
        spiritStones: character.spirit_stones,
        qi: projectNaturalQiState({
          qi: character.qi,
          qiLastRefreshedAt: character.qiLastRefreshedAt,
          now: new Date(),
        }).current,
        blockedReason,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function mutateInscriptions(
  actor: ActiveCultivatorRef,
  input: InscriptionRequest,
) {
  const committed =
    await playerCommandExecutor.executeWithLock<InscriptionResult>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'inscription',
      idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
      command: async (tx) => {
        await assertInventoryIdle(actor.cultivatorId, tx);
        const character = await characterOf(actor, tx);
        const before = (
          await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.cultivatorId, actor.cultivatorId),
                inArray(inventoryItems.location, ['bag', 'equipped']),
              ),
            )
        ).map(inventoryItemOf);
        let after: InventoryItem[];
        let grants: ItemGrant[] = [];
        let cost: InscriptionCost;
        let equipmentId: string | undefined;
        let equipped = false;
        let draw: ReturnType<typeof prepareInscriptionDraw> | undefined;
        if (input.action === 'draw') {
          draw = prepareInscriptionDraw(before, input.materials);
          if (draw.preview.totalTenths !== input.expectedTenths)
            throw new InventoryError('材料份数已变化，请重新核对');
          after = draw.afterMaterials;
          cost = draw.preview.cost;
        } else if (input.action === 'strengthen') {
          const plan = prepareInscriptionStrengthen(before, input.inscriptions);
          after = plan.afterMaterials;
          cost = plan.cost;
          grants = [plan.grant];
        } else {
          const plan = prepareInscriptionEquipment(
            before,
            input.equipment,
            input.socket,
            input.inscription,
            input.action,
            input.action === 'engrave' && input.replace,
          );
          ({ after, cost, equipmentId, equipped } = plan);
        }
        if (
          cost.qi !== input.expectedCost.qi ||
          cost.spiritStones !== input.expectedCost.spiritStones
        )
          throw new InventoryError('费用已变化，请重新核对');
        if (character.spirit_stones < cost.spiritStones)
          throw new InventoryError('灵石不足');
        const actionInstanceId = randomUUID();
        if (cost.qi)
          await QiService.reserveQi({
            cultivatorId: actor.cultivatorId,
            action: 'inscription_draw',
            actionInstanceId,
            cost: cost.qi,
            tx,
          });
        if (cost.spiritStones) {
          const paid = await tx
            .update(cultivators)
            .set({
              spirit_stones: sql`${cultivators.spirit_stones} - ${cost.spiritStones}`,
            })
            .where(
              and(
                eq(cultivators.id, actor.cultivatorId),
                gte(cultivators.spirit_stones, cost.spiritStones),
              ),
            )
            .returning({ id: cultivators.id });
          if (!paid.length) throw new InventoryError('灵石不足');
        }
        // 所有材料、资源、最坏容量均已校验；随机结果与扣费在同一幂等事务保存。
        if (draw)
          grants = rollInscriptionDraw(
            draw.preview,
            () => randomInt(0x100000000) / 0x100000000,
          );
        for (const grant of grants)
          after = addItems(
            after,
            grant,
            'bag',
            false,
            randomUUID,
            inventoryStackIdentity(grant.definitionId, null),
          );
        await saveInventoryPlan(actor.cultivatorId, before, after, tx);
        if (cost.qi)
          await QiService.commitReservation({ actionInstanceId, tx });
        const resourceChanges: ResourceChangeDescriptor[] = [
          {
            resourceTopic: 'inventory.bag',
            operation: 'invalidate',
            eventType: 'inscription.bag.changed',
          },
        ];
        if (cost.qi || cost.spiritStones)
          resourceChanges.push({
            resourceTopic: 'player.currency',
            operation: 'invalidate',
            eventType: 'inscription.currency.changed',
          });
        // 既有提交器负责重投影并重标定当前气血，不因上限增加自动补满。
        if (equipped)
          resourceChanges.push({
            resourceTopic: 'player.profile',
            operation: 'invalidate',
            eventType: 'inscription.equipment.changed',
          });
        return {
          result: {
            requestId: input.requestId,
            action: input.action,
            cost,
            grants,
            equipmentId,
          },
          resourceChanges,
        };
      },
    });
  return { data: committed.result, state: committed.state };
}
