import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import {
  getOrInitCultivationProgress,
  stripExpCapForStorage,
} from '@daoyou/game-rules/cultivation';
import { allowsLocalDevTools } from '@daoyou/contracts/dev-tools-access';
import type { DevCultivatorPatch } from '@daoyou/contracts/dev-tools';
import {
  compileCurrentSectCombatV6,
  SECT_PROGRESSION,
} from '@daoyou/game-rules/sects';
import { getRealmStageLevel as combatCharacterLevel } from '@daoyou/game-domain/progression';
import type { CultivatorCondition } from '@daoyou/game-domain/condition';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { CultivationProgress } from '@daoyou/game-domain/character';
import {
  getSpiritGardenPlantView,
  settleSpiritGarden,
} from '@daoyou/game-rules/spirit-field';
import { projectLegacySpiritGarden } from '@daoyou/game-rules/legacy/spirit-field-plots';
import { and, eq } from 'drizzle-orm';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  preHeavenFates,
  sectCombatStates,
  sectMemberships,
  sectMethodProgress,
  spiritualRoots,
} from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import {
  getOrCreateSpiritField,
  updateSpiritField,
} from '@server/lib/repositories/SpiritFieldRepository.js';
import {
  lockActiveMembership,
  readSectCombatProgress,
} from '@server/lib/repositories/sectCombatRepository.js';
import { ConditionService } from '@server/cultivator/application/ConditionService.js';
import {
  buildFateEffectEntry,
  getNegativeFateEffects,
  getPositiveFateEffects,
} from '@server/reshape/application/FateFragmentRegistry.js';
import { assertInventoryIdle, InventoryError } from '@server/inventory/operations.js';
import { ResourceEventCommitter } from '@server/player/application/state/ResourceEventCommitter.js';
import { readCombatV6ConditionAuthority } from '@server/combat/application/CombatV6ConditionAuthority.js';
import {
  mapPreHeavenFatesForRuntime,
  mapSpiritualRoots,
  replacePreHeavenFates,
  replaceSpiritualRoots,
} from '@server/cultivator/application/readers/CultivatorProfileRepository.js';

export async function patchDevCultivator(
  owner: string,
  input: DevCultivatorPatch,
) {
  if (!allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV))
    throw new InventoryError('仅允许纯本地环境使用');
  return withRedisLock(
    {
      key: redisLockKeys.cultivatorMutation(owner),
      context: 'dev-cultivator',
      timeoutMs: 30000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(cultivators)
          .where(eq(cultivators.id, owner))
          .for('update');
        if (!before || before.status !== 'active')
          throw new InventoryError('活跃角色不存在');
        await assertInventoryIdle(owner);
        if (input.spiritualRoots !== undefined) {
          await replaceSpiritualRoots(
            before.userId,
            owner,
            input.spiritualRoots.map((root) => ({
              ...root,
              strength: root.baseStrength + root.marrowWashBonus,
            })),
            tx,
          );
        }
        if (input.preHeavenFates !== undefined) {
          const definitions = [
            ...getPositiveFateEffects(),
            ...getNegativeFateEffects(),
          ];
          const fates = input.preHeavenFates.map((fate) => {
            const effects = fate.effectIds.map((id) => {
              const definition = definitions.find((effect) => effect.id === id);
              if (!definition) throw new InventoryError(`未知命格效果：${id}`);
              // Fixed mid-roll values make local UI fixtures reproducible.
              return buildFateEffectEntry(definition, fate.quality, () => 0.5);
            });
            return {
              name: fate.name,
              quality: fate.quality,
              description:
                fate.description ??
                effects.map((effect) => effect.description).join(''),
              effects,
            };
          });
          await replacePreHeavenFates(before.userId, owner, fates, tx);
        }
        if (input.spiritField) {
          const field = await getOrCreateSpiritField(owner, tx);
          const index = input.spiritField.finishGrowth;
          const now = Date.now();
          const garden = settleSpiritGarden(
            field.garden ?? projectLegacySpiritGarden(field.plots, field.id),
            now,
          );
          const plant = garden.plots[index]?.plant;
          if (!plant) throw new InventoryError('该田块没有灵植');
          const view = getSpiritGardenPlantView(
            plant,
            (input.realm ?? before.realm) as RealmType,
          );
          const milestone =
            input.spiritField.milestone ??
            (!plant.firstYieldGranted
              ? 'mature'
              : !plant.branch
                ? 'branch'
                : !plant.evolved && view.evolutionAttemptsRemaining > 0
                  ? 'evolve'
                  : 'yield');
          if (milestone !== 'mature' && !plant.firstYieldGranted)
            throw new InventoryError('请先回灵田支付天地灵气完成成株引灵');
          if (milestone === 'mature' && plant.firstYieldGranted)
            throw new InventoryError('灵植已经完成成株引灵');
          if (milestone === 'branch' && plant.branch)
            throw new InventoryError('灵植已经完成定向');
          if (milestone === 'evolve') {
            if (!plant.branch)
              throw new InventoryError('请先回灵田支付天地灵气完成定向');
            if (plant.evolved) throw new InventoryError('灵植已经完成蜕变');
            if (view.evolutionAttemptsRemaining === 0)
              throw new InventoryError('灵植的蜕变尝试次数已经用尽');
          }
          if (view.storageFull)
            throw new InventoryError('待领收成已满，请先领取');
          if (view.exhausted) throw new InventoryError('灵植已经采尽');
          let advanceMs =
            milestone === 'mature'
              ? Math.max(0, view.matureMs - plant.activeGrowthMs)
              : milestone === 'branch'
                ? view.branchRemainingMs
                : milestone === 'evolve'
                  ? Math.max(
                      view.evolveRemainingMs,
                      view.evolveCooldownRemainingMs,
                    )
                  : view.nextYieldMs;
          if (advanceMs <= 0)
            throw new InventoryError(
              milestone === 'mature'
                ? '灵植已可成株，请回灵田支付天地灵气'
                : milestone === 'yield'
                  ? '当前无法推进下一轮收成，请先核对灵植状态'
                  : '灵植已达到该节点，请回灵田完成付费操作',
            );
          let preparedGarden = settleSpiritGarden(
            {
              ...garden,
              plots: garden.plots.map((plot) =>
                plot.index === index ? plot : { ...plot, plant: null },
              ),
              collection: [],
            },
            now + advanceMs,
          );
          let prepared = preparedGarden.plots[index]!.plant!;
          const previousQuantity = plant.pending.reduce(
            (sum, product) => sum + product.quantity,
            0,
          );
          while (
            milestone === 'yield' &&
            prepared.pending.reduce((sum, product) => sum + product.quantity, 0) ===
              previousQuantity
          ) {
            const nextView = getSpiritGardenPlantView(
              prepared,
              (input.realm ?? before.realm) as RealmType,
            );
            if (nextView.storageFull)
              throw new InventoryError('待领收成已满，请先领取');
            if (nextView.exhausted)
              throw new InventoryError('剩余生产时间不足以完成新一轮收成');
            if (nextView.nextYieldMs <= 0)
              throw new InventoryError('当前无法推进下一轮收成，请先核对灵植状态');
            advanceMs += nextView.nextYieldMs;
            preparedGarden = settleSpiritGarden(preparedGarden, now + advanceMs);
            prepared = preparedGarden.plots[index]!.plant!;
          }
          const preparedView = getSpiritGardenPlantView(
            prepared,
            (input.realm ?? before.realm) as RealmType,
          );
          const remainingMs =
            milestone === 'branch'
              ? preparedView.branchRemainingMs
              : milestone === 'evolve'
                ? Math.max(
                    preparedView.evolveRemainingMs,
                    preparedView.evolveCooldownRemainingMs,
                  )
                : 0;
          if (remainingMs > 0)
            throw new InventoryError(
              preparedView.storageFull
                ? '待领收成已满，请先领取后再推进成长'
                : '剩余生产时间不足以达到指定成长节点',
            );
          // Rebase the simulated timeline as a whole, retaining incident order.
          const plots = garden.plots.map((plot) =>
            plot.index === index
              ? {
                  ...plot,
                  plant: {
                    ...prepared,
                    settledAt: now,
                    incidents: prepared.incidents.map((incident) => ({
                      ...incident,
                      occurredAt: incident.occurredAt - advanceMs,
                    })),
                  },
                }
              : plot,
          );
          await updateSpiritField(tx, field.id, {
            garden: { ...garden, plots },
          });
        }
        let sect;
        if (input.sect) {
          const [membership] = await tx
            .select()
            .from(sectMemberships)
            .where(
              and(
                eq(sectMemberships.cultivatorId, owner),
                eq(sectMemberships.status, 'active'),
              ),
            )
            .for('update');
          if (!membership) throw new InventoryError('角色尚未加入宗门');
          if (
            (input.sect.contribution ?? membership.contribution) >
            (input.sect.lifetimeContribution ?? membership.lifetimeContribution)
          )
            throw new InventoryError('累计贡献不能小于可用贡献');
          [sect] = await tx
            .update(sectMemberships)
            .set({ ...input.sect, updatedAt: new Date() })
            .where(eq(sectMemberships.id, membership.id))
            .returning({
              membershipId: sectMemberships.id,
              sectId: sectMemberships.sectId,
              discipleRank: sectMemberships.discipleRank,
              contribution: sectMemberships.contribution,
              lifetimeContribution: sectMemberships.lifetimeContribution,
            });
        }
        await tx
          .update(cultivators)
          .set({
            ...(input.realm === undefined ? {} : { realm: input.realm }),
            ...(input.realmStage === undefined
              ? {}
              : { realm_stage: input.realmStage }),
            ...input.attributes,
            ...(input.unallocatedAttributePoints === undefined
              ? {}
              : {
                  unallocatedAttributePoints: input.unallocatedAttributePoints,
                }),
            ...(input.spiritStones === undefined
              ? {}
              : { spirit_stones: input.spiritStones }),
            ...(input.reputation === undefined
              ? {}
              : { reputation: input.reputation }),
            updatedAt: new Date(),
          })
          .where(eq(cultivators.id, owner));
        if (input.sectCombat) {
          const membership = await lockActiveMembership(owner, tx);
          const progress =
            membership &&
            (await readSectCombatProgress(membership.membershipId, tx));
          if (!progress) throw new InventoryError('请先正式启用宗门流派');
          for (const id of Object.keys(input.sectCombat.methods ?? {})) {
            if (!Object.hasOwn(progress.sect.methods, id))
              throw new InventoryError(`当前宗门没有心法：${id}`);
          }
          const candidate = {
            ...progress.sect,
            methods: { ...progress.sect.methods, ...input.sectCombat.methods },
            meridianDepth: (input.sectCombat.meridianDepth ??
              progress.sect
                .meridianDepth) as typeof progress.sect.meridianDepth,
          };
          const characterLevel = combatCharacterLevel(
            (input.realm ?? before.realm) as RealmType,
            (input.realmStage ?? before.realm_stage) as RealmStage,
          );
          if (
            candidate.meridianDepth > 0 &&
            characterLevel <
              SECT_PROGRESSION.meridian.characterLevels[
                candidate.meridianDepth - 1
              ]
          )
            throw new InventoryError('经脉深度超过当前人物等级门槛');
          for (const loadout of candidate.meridianLoadouts) {
            const compiled = compileCurrentSectCombatV6({
              progress: { ...candidate, activePathId: loadout.pathId },
              characterLevel,
            });
            if (!compiled.ok)
              throw new InventoryError(
                compiled.diagnostics.map((item) => item.message).join('；'),
              );
          }
          for (const [methodId, level] of Object.entries(
            input.sectCombat.methods ?? {},
          )) {
            await tx
              .update(sectMethodProgress)
              .set({ level })
              .where(
                and(
                  eq(sectMethodProgress.membershipId, progress.membershipId),
                  eq(sectMethodProgress.methodId, methodId),
                ),
              );
          }
          await tx
            .update(sectCombatStates)
            .set({
              meridianDepth: candidate.meridianDepth,
              revision: progress.revision + 1,
              updatedAt: new Date(),
            })
            .where(eq(sectCombatStates.membershipId, progress.membershipId));
        }
        if (input.resources) {
          const { maxHp, maxMp } = await readCombatV6ConditionAuthority(
            owner,
            tx,
          );
          const condition = ConditionService.applyCombatV6Resources(
            before.condition as CultivatorCondition,
            {
              hp: Math.min(input.resources.hp, maxHp),
              mp: Math.min(input.resources.mp, maxMp),
              maxHp,
              maxMp,
            },
          );
          await tx
            .update(cultivators)
            .set({ condition })
            .where(eq(cultivators.id, owner));
        }
        if (input.cultivation) {
          const progress = getOrInitCultivationProgress(
            before.cultivation_progress as CultivationProgress,
            (input.realm ?? before.realm) as RealmType,
            (input.realmStage ?? before.realm_stage) as RealmStage,
          );
          if (input.cultivation.experience !== undefined)
            progress.cultivation_exp = input.cultivation.experience;
          if (input.cultivation.insight !== undefined)
            progress.comprehension_insight = input.cultivation.insight;
          await tx
            .update(cultivators)
            .set({ cultivation_progress: stripExpCapForStorage(progress) })
            .where(eq(cultivators.id, owner));
        }
        if (input.breakthroughPreparation) {
          const prep = input.breakthroughPreparation;
          const [current] = await tx
            .select({ condition: cultivators.condition })
            .from(cultivators)
            .where(eq(cultivators.id, owner));
          const condition = structuredClone(
            current.condition,
          ) as CultivatorCondition;
          const now = new Date().toISOString();
          for (const [field, key] of [
            ['clearMind', 'clear_mind'],
            ['protectMeridians', 'protect_meridians'],
          ] as const) {
            const enabled = prep[field];
            if (enabled === undefined) continue;
            condition.statuses = condition.statuses.filter(
              (status) =>
                !(status.key === key && status.payload?.devTools === true),
            );
            if (enabled)
              condition.statuses.push({
                key,
                stacks: 1,
                source: 'system',
                duration: { kind: 'until_removed' },
                payload: { devTools: true },
                createdAt: now,
                updatedAt: now,
              });
          }
          await tx
            .update(cultivators)
            .set({ condition })
            .where(eq(cultivators.id, owner));
        }
        const state = await new ResourceEventCommitter().commit(tx, {
          actor: { userId: before.userId, cultivatorId: owner },
          source: 'dev-cultivator',
          scopeDefaults: { cultivatorId: owner },
          changes: [
            ...(
              [
                'player.profile',
                'player.currency',
                'player.progress',
                'player.condition',
                'player.sect-combat',
              ] as const
            ).map((resourceTopic) => ({
              resourceTopic,
              operation: 'invalidate' as const,
              eventType: 'dev.cultivator.changed',
            })),
            ...(sect
              ? [
                  ...(['sect.membership', 'sect.tasks'] as const).map(
                    (resourceTopic) => ({
                      resourceTopic,
                      operation: 'invalidate' as const,
                      eventType: 'dev.sect.changed',
                    }),
                  ),
                  {
                    scope: { kind: 'sect' as const, id: sect.sectId },
                    resourceTopic: 'sect.members' as const,
                    operation: 'invalidate' as const,
                    eventType: 'dev.sect.changed',
                  },
                ]
              : []),
          ],
        });
        lease.assertHeld();
        const [after] = await tx
          .select({
            id: cultivators.id,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
            vitality: cultivators.vitality,
            strength: cultivators.strength,
            spirit: cultivators.spirit,
            endurance: cultivators.endurance,
            speed: cultivators.speed,
            willpower: cultivators.willpower,
            spiritStones: cultivators.spirit_stones,
            reputation: cultivators.reputation,
            unallocatedAttributePoints: cultivators.unallocatedAttributePoints,
          })
          .from(cultivators)
          .where(eq(cultivators.id, owner));
        const roots =
          input.spiritualRoots === undefined
            ? undefined
            : mapSpiritualRoots(
                await tx
                  .select()
                  .from(spiritualRoots)
                  .where(eq(spiritualRoots.cultivatorId, owner)),
              );
        const fates =
          input.preHeavenFates === undefined
            ? undefined
            : mapPreHeavenFatesForRuntime(
                await tx
                  .select()
                  .from(preHeavenFates)
                  .where(eq(preHeavenFates.cultivatorId, owner)),
              );
        return {
          data: {
            ...after,
            ...(sect ? { sect } : {}),
            ...(roots === undefined ? {} : { spiritualRoots: roots }),
            ...(fates === undefined ? {} : { preHeavenFates: fates }),
          },
          state,
        };
      }),
  );
}
