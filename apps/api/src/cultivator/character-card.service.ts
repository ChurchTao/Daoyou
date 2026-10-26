import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import {
  CharacterCardSelectionSchema,
  type CharacterCard,
  type CharacterCardEquipment,
  type CharacterCardSelection,
  type CharacterCardSettings,
  type CharacterCardSettingsView,
} from '@daoyou/contracts/player/card';
import { getSectOrganizationDefinition } from '@daoyou/game-content/sect-organization/definitions';
import { beastTradePreview } from '@daoyou/game-domain/beasts';
import { InventoryEquipmentSchema } from '@daoyou/game-rules/inventory/equipment';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient, DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivatorBeasts,
  cultivators,
  inventoryItems,
  sectMemberships,
  sponsorshipMeritProfiles,
} from '@server/lib/drizzle/schema.js';
import { beastFromRow } from '@server/lib/repositories/combatV6BeastRepository.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { and, eq, inArray } from 'drizzle-orm';

function selectionOf(settings: unknown): CharacterCardSelection {
  const value = settings as { profileCard?: unknown } | null;
  return CharacterCardSelectionSchema.parse(
    value?.profileCard ?? {
      equipmentIds: [],
      beastIds: [],
      revision: 0,
    },
  );
}

@Injectable()
export class CharacterCardService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  private async read(cultivatorId: string, q: DbExecutor, ownerId?: string) {
    const [row] = await q
      .select({
        id: cultivators.id,
        name: cultivators.name,
        title: cultivators.title,
        gender: cultivators.gender,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        background: cultivators.background,
        gameSettings: cultivators.gameSettings,
      })
      .from(cultivators)
      .where(
        and(
          eq(cultivators.id, cultivatorId),
          eq(cultivators.status, 'active'),
          ownerId ? eq(cultivators.userId, ownerId) : undefined,
        ),
      )
      .limit(1);
    if (!row)
      throw new HttpException({ error: '角色已离开此间，无法查看名片' }, 404);
    return row;
  }

  private async equipment(
    cultivatorId: string,
    q: DbExecutor,
    ids: string[],
  ): Promise<CharacterCardEquipment[]> {
    if (!ids.length) return [];
    const rows = await q
      .select({
        id: inventoryItems.id,
        definitionId: inventoryItems.definitionId,
        instanceData: inventoryItems.instanceData,
        quantity: inventoryItems.quantity,
      })
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, cultivatorId),
          eq(inventoryItems.definitionId, 'equipment.v6'),
          inArray(inventoryItems.id, ids),
        ),
      )
      .orderBy(inventoryItems.createdAt, inventoryItems.id);
    return rows.map((row) => ({
      ...row,
      name: InventoryEquipmentSchema.parse(row.instanceData).name,
    }));
  }

  private async beasts(cultivatorId: string, q: DbExecutor, ids: string[]) {
    if (!ids.length) return [];
    const rows = await q
      .select()
      .from(cultivatorBeasts)
      .where(
        and(
          eq(cultivatorBeasts.cultivatorId, cultivatorId),
          inArray(cultivatorBeasts.id, ids),
        ),
      )
      .orderBy(cultivatorBeasts.createdAt, cultivatorBeasts.id);
    return rows.map((row) => ({
      id: row.id,
      ...beastTradePreview(beastFromRow(row)),
    }));
  }

  private async build(
    row: Awaited<ReturnType<CharacterCardService['read']>>,
    q: DbExecutor,
  ): Promise<CharacterCard> {
    const selected = selectionOf(row.gameSettings);
    const equipment = await this.equipment(row.id, q, selected.equipmentIds);
    const beasts = await this.beasts(row.id, q, selected.beastIds);
    const [membership] = await q
      .select({ sectId: sectMemberships.sectId })
      .from(sectMemberships)
      .where(
        and(
          eq(sectMemberships.cultivatorId, row.id),
          eq(sectMemberships.status, 'active'),
        ),
      )
      .limit(1);
    const [merit] = await q
      .select({ tier: sponsorshipMeritProfiles.highestTier })
      .from(sponsorshipMeritProfiles)
      .where(
        and(
          eq(sponsorshipMeritProfiles.cultivatorId, row.id),
          eq(sponsorshipMeritProfiles.isPublic, true),
        ),
      )
      .limit(1);
    return {
      id: row.id,
      name: row.name,
      title: row.title,
      gender: row.gender,
      realm: row.realm as RealmType,
      realmStage: row.realmStage as RealmStage,
      sectName: membership
        ? getSectOrganizationDefinition(membership.sectId).name
        : null,
      background: row.background,
      sponsorshipTier: merit?.tier ?? null,
      equipment: selected.equipmentIds.flatMap((id) =>
        equipment.filter((item) => item.id === id),
      ),
      beasts: selected.beastIds.flatMap((id) =>
        beasts.filter((beast) => beast.id === id),
      ),
    };
  }

  async card(id: string) {
    const data = await this.database.transaction(
      async (tx) => this.build(await this.read(id, tx), tx),
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    return { success: true as const, data };
  }

  async settings(actor: ActiveCultivatorRef) {
    const data = await this.database.transaction(
      async (tx): Promise<CharacterCardSettingsView> => {
        const row = await this.read(actor.cultivatorId, tx, actor.userId);
        const card = await this.build(row, tx);
        const selected = selectionOf(row.gameSettings);
        return {
          settings: {
            ...selected,
            title: row.title,
            equipmentIds: card.equipment.map((item) => item.id),
            beastIds: card.beasts.map((beast) => beast.id),
          },
          card,
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
    return { success: true as const, data };
  }

  async save(actor: ActiveCultivatorRef, input: CharacterCardSettings) {
    return toPlayerStateMutationResponse(
      await playerCommandExecutor.execute({
        userId: actor.userId,
        cultivatorId: actor.cultivatorId,
        coordination: { mode: 'database-only' },
        source: 'profile_card',
        command: async (tx) => {
          const row = await this.read(actor.cultivatorId, tx, actor.userId);
          if (selectionOf(row.gameSettings).revision !== input.revision)
            throw new HttpException(
              { error: '名片已更新，请重新载入后再保存' },
              409,
            );
          const equipment = await this.equipment(
            row.id,
            tx,
            input.equipmentIds,
          );
          const beasts = await this.beasts(row.id, tx, input.beastIds);
          if (
            equipment.length !== input.equipmentIds.length ||
            beasts.length !== input.beastIds.length
          )
            throw new HttpException(
              { error: '只能展示自己当前持有的道装与灵兽，请重新选择' },
              400,
            );
          const profileCard: CharacterCardSelection = {
            equipmentIds: input.equipmentIds,
            beastIds: input.beastIds,
            revision: input.revision + 1,
          };
          await tx
            .update(cultivators)
            .set({
              title: input.title,
              gameSettings: {
                ...(row.gameSettings as Record<string, unknown>),
                profileCard,
              },
            })
            .where(
              and(
                eq(cultivators.id, row.id),
                eq(cultivators.userId, actor.userId),
                eq(cultivators.status, 'active'),
              ),
            );
          return {
            result: { ...profileCard, title: input.title },
            resourceChanges: [
              {
                resourceTopic: 'player.profile',
                eventType: 'profile.card.changed',
                operation: 'merge',
                payload: { cultivator: { title: input.title } },
              },
            ],
          };
        },
      }),
    );
  }
}
