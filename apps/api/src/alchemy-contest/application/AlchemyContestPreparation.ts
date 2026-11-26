import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import type {
  AdminAlchemyContest,
  ContestPreparationResult,
} from '@daoyou/contracts/alchemy/contest';
import {
  ContestMaterialDraftSchema,
  ContestMaterialSchema,
  ContestPaperSchema,
  ContestPropertiesSchema,
  ContestQuestionDraftSchema,
  type ContestMaterial,
  type ContestPaper,
} from '@daoyou/game-domain/alchemy/contest';
import {
  ItemLibraryItemIdSchema,
  ItemLibraryMaterialPayloadSchema,
} from '@daoyou/game-domain/items/catalog';
import { contestWeek } from '@daoyou/game-rules/alchemy/contest';
import { authorContestQuestion } from '@daoyou/game-rules/alchemy/contest/authoring';
import {
  HIGH_GRADE_MATERIAL_QUALITIES,
  libraryMaterialGrant,
} from '@daoyou/game-rules/rewards/materials';
import { AiService } from '@nestjs/ai';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  ITEM_LIBRARY_SYSTEM_USER_ID,
  sampleMaterialLibraryEntries,
} from '@server/admin/application/MaterialLibraryService.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { isBackgroundLlmEnabled } from '@server/lib/config/environment.js';
import type { DbClient, DbTransaction } from '@server/lib/drizzle/db.js';
import {
  itemLibrary,
  alchemyContestRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { withRedisLock } from '@server/lib/redis/lock.js';
import { computeItemLibrarySampleKey } from '@server/lib/utils/itemLibrarySampleKey.js';
import { aiDeadlineSignal } from '@server/llm/call-options.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

const CachedAlchemySchema = z.object({
  version: z.literal(1),
  fingerprint: z.string(),
  properties: ContestPropertiesSchema,
});
const NamedPaperSchema = z.object({
  pillName: z
    .string()
    .trim()
    .regex(/^[\p{Script=Han}]{2,11}丹$/u),
});
const LibraryFactsSchema = ItemLibraryMaterialPayloadSchema.omit({
  details: true,
});
type LibraryFacts = z.infer<typeof LibraryFactsSchema>;
type MaterialRow = typeof itemLibrary.$inferSelect;
const fallbackLeadMs = 24 * 3_600_000;
const contestTypes = ['herb', 'tcdb', 'aux', 'monster', 'ore'];
const profilesInput = z.object({
  id: z.string(),
  properties: ContestPropertiesSchema,
});

function factsFingerprint(facts: LibraryFacts) {
  return createHash('sha256')
    .update(stableCompactStringify(facts))
    .digest('hex');
}

function libraryFacts(material: ContestMaterial): LibraryFacts {
  return LibraryFactsSchema.parse(material);
}

@Injectable()
export class AlchemyContestPreparation {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(AiService) private readonly ai: AiService,
  ) {}

  private async generate<T extends z.ZodType>(
    label: string,
    input: unknown,
    schema: T,
  ): Promise<z.infer<T>> {
    const { system, user } = renderPrompt(label, {
      input: stableCompactStringify(input),
    });
    const response = await this.ai.generateObject({
      model: 'alibaba.fast',
      label,
      schemaName: label.replaceAll('-', '_'),
      abortSignal: aiDeadlineSignal(30_000),
      instructions: system,
      prompt: user,
      schema,
    });
    return schema.parse(response.object);
  }

  private async readLibraryMaterials(excludedNames: Set<string>) {
    const sampled = await this.db
      .select()
      .from(itemLibrary)
      .where(
        and(
          eq(itemLibrary.type, 'material'),
          eq(itemLibrary.status, 'published'),
          inArray(itemLibrary.category, contestTypes),
          inArray(itemLibrary.quality, QUALITY_VALUES.slice(0, 5)),
          isNotNull(itemLibrary.element),
          isNotNull(itemLibrary.description),
        ),
      )
      .orderBy(sql`random()`)
      .limit(80);
    const selected = [];
    for (const row of sampled) {
      const payload = ItemLibraryMaterialPayloadSchema.parse(row.payload);
      const facts = LibraryFactsSchema.parse(payload);
      if (
        !facts.element ||
        !facts.description?.trim() ||
        excludedNames.has(facts.name) ||
        !ItemLibraryItemIdSchema.safeParse(row.itemId).success ||
        !ContestMaterialDraftSchema.omit({ properties: true }).safeParse(facts)
          .success
      )
        continue;
      excludedNames.add(facts.name);
      const fingerprint = factsFingerprint(facts);
      const cached = CachedAlchemySchema.safeParse(payload.details?.alchemy);
      selected.push({
        row,
        facts,
        fingerprint,
        properties:
          cached.success && cached.data.fingerprint === fingerprint
            ? cached.data.properties
            : undefined,
      });
      if (selected.length === 8) break;
    }
    if (selected.length !== 8) throw new Error('材料库可用于大会的材料不足');
    const missing = selected.filter(({ properties }) => !properties);
    if (missing.length) {
      const analyzed = await this.generate(
        'alchemy-contest-library',
        missing.map(({ row, facts }) => ({
          id: row.itemId,
          ...facts,
        })),
        z.object({ materials: z.array(profilesInput).length(missing.length) }),
      );
      const properties = new Map(
        analyzed.materials.map((material) => [
          material.id,
          material.properties,
        ]),
      );
      if (
        properties.size !== missing.length ||
        missing.some(({ row }) => !properties.has(row.itemId))
      )
        throw new Error('药性分析缺失或重复');
      await this.db.transaction(async (tx) => {
        for (const material of missing.toSorted((a, b) =>
          a.row.id.localeCompare(b.row.id),
        )) {
          material.properties = properties.get(material.row.itemId);
          await this.saveProfile(
            tx,
            material.row,
            material.fingerprint,
            material.properties!,
          );
        }
      });
    }
    return selected.map(({ row, facts, properties }) =>
      ContestMaterialSchema.parse({
        ...facts,
        id: row.itemId,
        properties,
      }),
    );
  }

  private async saveProfile(
    tx: DbTransaction,
    row: MaterialRow,
    fingerprint: string,
    properties: ContestMaterial['properties'],
  ) {
    const [current] = await tx
      .select()
      .from(itemLibrary)
      .where(
        and(
          eq(itemLibrary.id, row.id),
          eq(itemLibrary.status, 'published'),
          eq(itemLibrary.type, 'material'),
        ),
      )
      .for('update');
    if (!current) throw new Error('参赛材料已撤回');
    const payload = ItemLibraryMaterialPayloadSchema.parse(current.payload);
    if (factsFingerprint(LibraryFactsSchema.parse(payload)) !== fingerprint)
      throw new Error('参赛材料在药性分析期间发生变化');
    const cached = CachedAlchemySchema.safeParse(payload.details?.alchemy);
    if (cached.success && cached.data.fingerprint === fingerprint) {
      properties.splice(0, properties.length, ...cached.data.properties);
      return;
    }
    await tx
      .update(itemLibrary)
      .set({
        payload: {
          ...payload,
          details: {
            ...payload.details,
            alchemy: { version: 1, fingerprint, properties },
          },
        },
        updatedBy: ITEM_LIBRARY_SYSTEM_USER_ID,
      })
      .where(eq(itemLibrary.id, row.id));
  }

  private async candidate(recent: string[]): Promise<ContestPaper | null> {
    const draft = await this.generate(
      'alchemy-contest-question',
      { recent, properties: ContestQuestionDraftSchema.shape.primary.options },
      ContestQuestionDraftSchema,
    );
    const authored = await this.generate(
      'alchemy-contest-materials',
      { primary: draft.primary, secondary: draft.secondary },
      z.object({ materials: z.array(ContestMaterialDraftSchema).length(8) }),
    );
    const originals = authored.materials.map((material) =>
      ContestMaterialSchema.parse({
        ...material,
        id: ItemLibraryItemIdSchema.parse(
          `material-alchemy-contest-${randomUUID()}`,
        ),
      }),
    );
    const names = new Set(originals.map(({ name }) => name));
    if (names.size !== 8) return null;
    for (let draw = 0; draw < 2; draw++) {
      const materials = [
        ...originals,
        ...(await this.readLibraryMaterials(new Set(names))),
      ];
      const question = authorContestQuestion(draft, materials);
      if (!question) continue;
      const { pillName } = await this.generate(
        'alchemy-contest-naming',
        {
          title: question.title,
          brief: question.brief,
          primary: question.primary,
          secondary: question.secondary,
        },
        NamedPaperSchema,
      );
      return ContestPaperSchema.parse({
        rulesVersion: 1,
        question: { ...question, pillName },
        materials,
      });
    }
    return null;
  }

  private async persistNewMaterials(tx: DbTransaction, paper: ContestPaper) {
    for (const material of paper.materials.slice(0, 8)) {
      const facts = libraryFacts(material);
      await tx
        .insert(itemLibrary)
        .values({
          itemId: ItemLibraryItemIdSchema.parse(material.id),
          type: 'material',
          status: 'published',
          name: facts.name,
          description: facts.description,
          quality: facts.rank,
          element: facts.element,
          category: facts.type,
          sampleKey: computeItemLibrarySampleKey(material.id),
          payload: {
            ...facts,
            details: {
              alchemy: {
                version: 1,
                fingerprint: factsFingerprint(facts),
                properties: material.properties,
              },
            },
          },
          editorConfig: { source: 'alchemy_contest' },
          createdBy: ITEM_LIBRARY_SYSTEM_USER_ID,
          updatedBy: ITEM_LIBRARY_SYSTEM_USER_ID,
        })
        .onConflictDoNothing({ target: itemLibrary.itemId });
    }
  }

  private async rewardPool() {
    const found = await sampleMaterialLibraryEntries(
      HIGH_GRADE_MATERIAL_QUALITIES.map((quality) => ({
        materialType: 'herb',
        quality,
        count: 8,
      })),
      this.db,
    );
    const materials = HIGH_GRADE_MATERIAL_QUALITIES.flatMap((quality) => {
      const entries = found.get(`herb:${quality}`);
      if (!entries?.length) throw new Error(`材料库暂无${quality}草药`);
      return entries.map(libraryMaterialGrant);
    });
    return {
      version: 1 as const,
      materials,
    };
  }

  async adminStatus(): Promise<AdminAlchemyContest> {
    const now = Date.now();
    const clocks = [contestWeek(now), contestWeek(now, 1)];
    const generationEnabled = isBackgroundLlmEnabled();
    const [records, backups] = await Promise.all([
      this.db
        .select()
        .from(rounds)
        .where(
          inArray(
            rounds.week,
            clocks.map(({ week }) => week),
          ),
        ),
      this.db
        .select({ week: rounds.week })
        .from(rounds)
        .where(and(lt(rounds.week, clocks[1].week), isNotNull(rounds.reserve)))
        .orderBy(asc(rounds.week))
        .limit(1),
    ]);
    return {
      generationEnabled,
      rounds: clocks.map((clock) => {
        const record = records.find(({ week }) => week === clock.week);
        const canUseReserve =
          !record && backups.some(({ week }) => week < clock.week);
        const preparationClosed =
          now >= clock.closesAt || (Boolean(record) && now >= clock.opensAt);
        return {
          week: clock.week,
          opensAt: new Date(clock.opensAt).toISOString(),
          closesAt: new Date(clock.closesAt).toISOString(),
          announcedAt: record?.announcedAt?.toISOString() ?? null,
          settledAt: record?.settledAt?.toISOString() ?? null,
          paper: record ? ContestPaperSchema.parse(record.paper) : null,
          reserve: record?.reserve
            ? ContestPaperSchema.parse(record.reserve)
            : null,
          preparationClosed,
          canPrepare:
            !preparationClosed &&
            !record?.reserve &&
            (generationEnabled || canUseReserve),
          canUseReserve,
        };
      }),
    };
  }

  async prepare(
    manualWeek?: string,
  ): Promise<{ status: ContestPreparationResult }> {
    const now = Date.now();
    const current = contestWeek(now);
    const next = contestWeek(now, 1);
    const [currentPaper] = await this.db
      .select({ week: rounds.week })
      .from(rounds)
      .where(eq(rounds.week, current.week));
    const clock = manualWeek
      ? [current, next].find(({ week }) => week === manualWeek)
      : currentPaper
        ? next
        : current;
    if (!clock) throw new BadRequestException('只能补跑本期或下期的赛前准备。');
    return withRedisLock(
      {
        key: `alchemy-contest:prepare:${clock.week}`,
        context: 'alchemy-contest-prepare',
        timeoutMs: 240_000,
        retries: 0,
      },
      async (lease) => {
        const [prepared] = await this.db
          .select()
          .from(rounds)
          .where(eq(rounds.week, clock.week));
        if (
          Date.now() >= clock.closesAt ||
          (prepared && Date.now() >= clock.opensAt)
        )
          return { status: 'registration-opened' };
        if (prepared?.reserve) return { status: 'already-prepared' };
        let candidate: ContestPaper | null = null;
        const enabled = isBackgroundLlmEnabled();
        const noCandidate = enabled
          ? 'generation-failed'
          : 'generation-disabled';
        if (enabled) {
          const previous = await this.db
            .select({ paper: rounds.paper })
            .from(rounds)
            .where(lt(rounds.week, clock.week))
            .orderBy(desc(rounds.week))
            .limit(4);
          try {
            candidate = await this.candidate(
              [
                ...(prepared ? [prepared.paper] : []),
                ...previous.map(({ paper }) => paper),
              ].map(
                ({ question }) =>
                  `${question.title} ${question.primary}/${question.secondary ?? ''}`,
              ),
            );
          } catch (error) {
            console.warn(
              '[alchemy-contest] candidate generation failed',
              error instanceof Error ? error.name : 'unknown',
            );
          }
        }
        lease.assertHeld();
        if (
          Date.now() >= clock.closesAt ||
          (prepared && Date.now() >= clock.opensAt)
        )
          return { status: 'registration-opened' };
        if (prepared) {
          if (!candidate) return { status: noCandidate };
          await this.db
            .update(rounds)
            .set({ reserve: candidate })
            .where(eq(rounds.week, clock.week));
          return { status: 'reserve-prepared' };
        }
        if (!candidate && !manualWeek && now < clock.opensAt - fallbackLeadMs) {
          return { status: noCandidate };
        }
        const generated = candidate;
        // Avoid drawing a prize pool when there is no usable paper.
        if (!generated) {
          const [prior] = await this.db
            .select({ week: rounds.week })
            .from(rounds)
            .where(and(lt(rounds.week, clock.week), isNotNull(rounds.reserve)))
            .limit(1);
          if (!prior) return { status: noCandidate };
        }
        const pool = await this.rewardPool();
        return this.db.transaction(async (tx) => {
          let paper = generated;
          if (!paper) {
            const [fallback] = await tx
              .select()
              .from(rounds)
              .where(
                and(lt(rounds.week, clock.week), isNotNull(rounds.reserve)),
              )
              .orderBy(desc(rounds.week))
              .limit(1)
              .for('update');
            if (!fallback?.reserve) return { status: noCandidate };
            // An unpublished reserve from before the ID change can still be promoted.
            paper = ContestPaperSchema.parse({
              ...fallback.reserve,
              materials: fallback.reserve.materials.map((material, index) =>
                index < 8 && material.id.startsWith('material.alchemy-contest.')
                  ? {
                      ...material,
                      id: material.id.replace(
                        'material.alchemy-contest.',
                        'material-alchemy-contest-',
                      ),
                    }
                  : material,
              ),
            });
            await tx
              .update(rounds)
              .set({ reserve: null })
              .where(eq(rounds.week, fallback.week));
          }
          lease.assertHeld();
          if (Date.now() >= clock.closesAt)
            throw new Error('本期已结束，无法准备题卷');
          await tx.insert(rounds).values({
            week: clock.week,
            closesAt: new Date(clock.closesAt),
            paper,
            rewardPool: pool,
          });
          await this.persistNewMaterials(tx, paper);
          return { status: generated ? 'prepared' : 'reserve-used' };
        });
      },
    );
  }
}
