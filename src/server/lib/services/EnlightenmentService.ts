import {
  getOrInitCultivationProgress,
  stripExpCapForStorage,
} from '@server/utils/cultivationUtils';
import type {
  EnlightenmentRequest,
  EnlightenmentResult,
  EnlightenmentView,
} from '@shared/contracts/enlightenment';
import { addItems } from '@shared/inventory';
import { inventoryStackIdentity } from '@shared/inventory/stack-key';
import { evaluateFateContext } from '@shared/lib/fates';
import { projectNaturalQiState } from '@shared/lib/qi';
import {
  prepareEnlightenment,
  rollEnlightenment,
} from '@shared/manuals/enlightenment';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type { CultivationProgress } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { randomInt, randomUUID } from 'node:crypto';
import { db, type DbExecutor } from '../drizzle/db';
import { cultivators, inventoryItems } from '../drizzle/schema';
import type { ActiveCultivatorRef } from '../hono/types';
import { playerCommandExecutor } from './CommandExecutors';
import { getCultivatorPreHeavenFates } from './cultivator/CultivatorProfileRepository';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from './InventoryService';
import { QiService } from './QiService';

async function readFacts(actor: ActiveCultivatorRef, tx: DbExecutor) {
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
  const fates = await getCultivatorPreHeavenFates(actor.cultivatorId, tx);
  const realm = character.realm as RealmType;
  const progress = getOrInitCultivationProgress(
    character.cultivation_progress as CultivationProgress,
    realm,
    character.realm_stage as RealmStage,
  );
  const insightMultiplier =
    evaluateFateContext(fates).enlightenmentInsightMultiplier;
  return { character, realm, progress, insightMultiplier };
}

export async function readEnlightenment(
  actor: ActiveCultivatorRef,
): Promise<EnlightenmentView> {
  return db.transaction(
    async (tx) => {
      const { character, realm, progress, insightMultiplier } = await readFacts(
        actor,
        tx,
      );
      let blockedReason: string | null = null;
      try {
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
      } catch (error) {
        if (!(error instanceof InventoryError)) throw error;
        blockedReason = error.message;
      }
      return {
        ownerId: character.id,
        realm,
        gender: character.gender ?? '男',
        qi: projectNaturalQiState({
          qi: character.qi,
          qiLastRefreshedAt: character.qiLastRefreshedAt,
          now: new Date(),
        }).current,
        insight: progress.comprehension_insight,
        insightMultiplier,
        blockedReason,
      };
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  );
}

export async function enlightenManual(
  actor: ActiveCultivatorRef,
  input: EnlightenmentRequest,
) {
  const committed =
    await playerCommandExecutor.executeWithLock<EnlightenmentResult>({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      source: 'manual_enlightenment',
      idempotency: {
        key: input.requestId,
        fingerprint: JSON.stringify({
          expected: input.expected,
          materials: [...input.materials].sort((a, b) =>
            a.id.localeCompare(b.id),
          ),
        }),
      },
      command: async (tx) => {
        await assertInventoryIdle(actor.cultivatorId, undefined, tx);
        const { realm, progress, insightMultiplier } = await readFacts(
          actor,
          tx,
        );
        const before = (
          await tx
            .select()
            .from(inventoryItems)
            .where(
              and(
                eq(inventoryItems.cultivatorId, actor.cultivatorId),
                eq(inventoryItems.location, 'bag'),
              ),
            )
        ).map(inventoryItemOf);
        const { preview, afterMaterials } = prepareEnlightenment(
          before,
          input.materials,
          realm,
          insightMultiplier,
        );
        if (
          realm !== input.expected.realm ||
          insightMultiplier !== input.expected.insightMultiplier ||
          preview.cost.qi !== input.expected.qi ||
          preview.cost.insight !== input.expected.insight
        )
          throw new InventoryError('境界或参悟费用已变化，请重新核对');
        if (progress.comprehension_insight < preview.cost.insight)
          throw new InventoryError('道心感悟不足');
        const actionInstanceId = randomUUID();
        await QiService.reserveQi({
          cultivatorId: actor.cultivatorId,
          action: 'manual_enlightenment',
          actionInstanceId,
          cost: preview.cost.qi,
          tx,
        });
        const jadeDefinitionId = rollEnlightenment(
          preview,
          () => randomInt(0x100000000) / 0x100000000,
        );
        const after = jadeDefinitionId
          ? addItems(
              afterMaterials,
              { definitionId: jadeDefinitionId, quantity: 1 },
              'bag',
              false,
              randomUUID,
              inventoryStackIdentity(jadeDefinitionId, null),
            )
          : afterMaterials;
        progress.comprehension_insight -= preview.cost.insight;
        await tx
          .update(cultivators)
          .set({ cultivation_progress: stripExpCapForStorage(progress) })
          .where(eq(cultivators.id, actor.cultivatorId));
        await saveInventoryPlan(actor.cultivatorId, before, after, tx);
        await QiService.commitReservation({ actionInstanceId, tx });
        return {
          result: {
            requestId: input.requestId,
            jadeDefinitionId,
            cost: preview.cost,
          },
          resourceChanges: [
            {
              resourceTopic: 'inventory.bag',
              operation: 'invalidate',
              eventType: 'manual_enlightenment.bag.changed',
            },
            {
              resourceTopic: 'player.progress',
              operation: 'invalidate',
              eventType: 'manual_enlightenment.insight.changed',
            },
            {
              resourceTopic: 'player.currency',
              operation: 'invalidate',
              eventType: 'manual_enlightenment.qi.changed',
            },
          ],
        };
      },
    });
  return { data: committed.result, state: committed.state };
}
