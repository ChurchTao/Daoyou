import {
  BAIXIAO_ADMIN_PAGE_SIZE,
  type BaixiaoAdminListQuery,
  type BaixiaoAdminQuestionPage,
  type BaixiaoAdminView,
  type BaixiaoImportResult,
  type BaixiaoPracticeQuestion,
  type BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import { type BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/meet';
import {
  BaixiaoCategorySchema,
  BaixiaoDifficultySchema,
  BaixiaoQuestionSchema,
} from '@daoyou/game-domain/baixiao/question';
import { materialFactsOf } from '@daoyou/game-domain/inventory';
import { ItemLibraryMaterialPayloadSchema } from '@daoyou/game-domain/items/catalog';
import {
  BAIXIAO_MANUAL_QUALITIES,
  baixiaoQuotaStatus,
  baixiaoSampleLimits,
  baixiaoWeek,
  countBaixiaoQuotas,
  createBaixiaoPaper,
} from '@daoyou/game-rules/baixiao/meet';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  baixiaoSearchPrompt,
  itemLibrary,
  baixiaoQuestions as questions,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { baixiaoPhase } from './baixiao-view.js';

const roundColumns = {
  week: rounds.week,
  settledAt: rounds.settledAt,
  announcedAt: rounds.announcedAt,
  materials: rounds.materials,
};

@Injectable()
export class BaixiaoQuestionBank {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbClient) {}

  private async candidates(drawAnchor: () => number) {
    const anchors = new Map<string, number>();
    const requests = baixiaoSampleLimits().map(
      ({ category, difficulty, kind, count }) => {
        const group = `${category}:${difficulty}`;
        const anchor = anchors.get(group) ?? drawAnchor();
        anchors.set(group, anchor);
        return sql`(${category}::text, ${difficulty}::text, ${kind}::text, ${count}::integer, ${anchor}::double precision)`;
      },
    );
    const match = sql`
      ${questions.status} = 'published'
      AND ${questions.question}->>'category' = request.category
      AND ${questions.question}->>'difficulty' = request.difficulty
      AND ${questions.question}->>'kind' = request.kind
    `;
    // Both ranges can stop at the index limit. The second range handles wrapping at 1.
    const result = await this.db.execute<{
      id: string;
      knowledgeKey: string;
      category: BaixiaoQuestionData['category'];
      difficulty: BaixiaoQuestionData['difficulty'];
      kind: BaixiaoQuestionData['kind'];
      options: string[];
    }>(sql`
      SELECT picked.id, picked.knowledge_key AS "knowledgeKey", request.category,
             request.difficulty, request.kind, picked.options
      FROM (VALUES ${sql.join(requests, sql`, `)})
        AS request(category, difficulty, kind, pick_limit, anchor)
      CROSS JOIN LATERAL (
        SELECT candidates.*
        FROM (
          (
            SELECT ${questions.id}, ${questions.knowledgeKey}, ${questions.sampleKey},
                   ${questions.question}->'options' AS options, 0 AS wrapped
            FROM ${questions}
            WHERE ${match} AND ${questions.sampleKey} >= request.anchor
            ORDER BY ${questions.sampleKey}, ${questions.id}
            LIMIT request.pick_limit
          )
          UNION ALL
          (
            SELECT ${questions.id}, ${questions.knowledgeKey}, ${questions.sampleKey},
                   ${questions.question}->'options' AS options, 1 AS wrapped
            FROM ${questions}
            WHERE ${match} AND ${questions.sampleKey} < request.anchor
            ORDER BY ${questions.sampleKey}, ${questions.id}
            LIMIT request.pick_limit
          )
        ) AS candidates
        ORDER BY candidates.wrapped, candidates.sample_key, candidates.id
        LIMIT request.pick_limit
      ) AS picked
      ORDER BY picked.wrapped, picked.sample_key, picked.id
    `);
    return result.rows;
  }

  async isReady() {
    const candidates = await this.candidates(() => 0);
    return baixiaoQuotaStatus(candidates).every(
      ({ available, count }) => available >= count,
    );
  }

  async drawPaper() {
    const candidates = await this.candidates(Math.random);
    const paper = createBaixiaoPaper(candidates, randomInt, {
      preservePoolOrder: true,
    });
    if (!paper) throw new ConflictException('启用题库暂未达到组卷要求。');
    return paper;
  }

  async practice(): Promise<BaixiaoPracticeQuestion[]> {
    const paper = await this.drawPaper();
    const rows = await this.db
      .select({ id: questions.id, question: questions.question })
      .from(questions)
      .where(
        inArray(
          questions.id,
          paper.map(({ questionId }) => questionId),
        ),
      );
    const bank = new Map(
      rows.map(({ id, question }) => [
        id,
        BaixiaoQuestionSchema.parse(question),
      ]),
    );
    return paper.map(({ questionId, order }) => {
      const question = bank.get(questionId);
      if (!question)
        throw new InternalServerErrorException('试玩题目无法读取。');
      const { prompt, kind, category, difficulty, options, correct } = question;
      return {
        id: questionId,
        prompt,
        kind,
        category,
        difficulty,
        options: order.map((position) => options[position]),
        correct: order.indexOf(correct),
      };
    });
  }

  private async materials() {
    const groups = await Promise.all(
      BAIXIAO_MANUAL_QUALITIES.map(async (quality) => {
        const found = await this.db
          .select({ payload: itemLibrary.payload })
          .from(itemLibrary)
          .where(
            and(
              eq(itemLibrary.type, 'material'),
              eq(itemLibrary.status, 'published'),
              eq(itemLibrary.category, 'gongfa_manual'),
              eq(itemLibrary.quality, quality),
            ),
          )
          .orderBy(sql`random()`)
          .limit(32);
        return found
          .flatMap(({ payload }) => {
            const parsed = ItemLibraryMaterialPayloadSchema.safeParse(payload);
            if (!parsed.success) return [];
            const instanceData = materialFactsOf(parsed.data);
            return instanceData.type === 'gongfa_manual' &&
              instanceData.rank === quality
              ? [{ definitionId: 'material.v1', quantity: 1, instanceData }]
              : [];
          })
          .slice(0, 8);
      }),
    );
    return groups;
  }

  async prepare(clock: ReturnType<typeof baixiaoWeek>) {
    const [round] = await this.db
      .select(roundColumns)
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    if (round) return round;
    if (Date.now() >= clock.closesAt || !(await this.isReady()))
      return undefined;
    const groups = await this.materials();
    if (groups.some((group) => !group.length) || Date.now() >= clock.closesAt)
      return undefined;
    const [prepared] = await this.db
      .insert(rounds)
      .values({
        week: clock.week,
        closesAt: new Date(clock.closesAt),
        materials: groups.flat(),
      })
      .onConflictDoNothing()
      .returning(roundColumns);
    if (prepared) return prepared;
    const [concurrent] = await this.db
      .select(roundColumns)
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    return concurrent;
  }

  async status(): Promise<BaixiaoAdminView> {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    const category = sql<
      BaixiaoQuestionData['category']
    >`${questions.question}->>'category'`;
    const difficulty = sql<
      BaixiaoQuestionData['difficulty']
    >`${questions.question}->>'difficulty'`;
    const kind = sql<
      BaixiaoQuestionData['kind']
    >`${questions.question}->>'kind'`;
    const [[round], totals] = await Promise.all([
      this.db
        .select(roundColumns)
        .from(rounds)
        .where(eq(rounds.week, clock.week)),
      this.db
        .select({
          category,
          difficulty,
          kind,
          status: questions.status,
          count: count(),
        })
        .from(questions)
        .groupBy(category, difficulty, kind, questions.status),
    ]);
    const enabled = totals.filter((row) => row.status === 'published');
    const quotas = countBaixiaoQuotas(enabled).map(
      ({ category, difficulty, count, available }) => ({
        category,
        difficulty,
        count,
        available,
      }),
    );
    const ready = quotas.every(({ count, available }) => available >= count);
    const distribution = BaixiaoCategorySchema.options.flatMap((category) =>
      BaixiaoDifficultySchema.options.map((difficulty) => ({
        category,
        difficulty,
        count: enabled
          .filter(
            (group) =>
              group.category === category && group.difficulty === difficulty,
          )
          .reduce((total, group) => total + group.count, 0),
      })),
    );
    return {
      week: clock.week,
      phase: baixiaoPhase(clock, now, round, ready),
      published: distribution.reduce((total, group) => total + group.count, 0),
      retired: totals
        .filter((row) => row.status === 'retired')
        .reduce((total, group) => total + group.count, 0),
      materials: round?.materials.length ?? (await this.materials()).flat().length,
      distribution,
      quotas,
    };
  }

  async list(query: BaixiaoAdminListQuery): Promise<BaixiaoAdminQuestionPage> {
    const tokens =
      query.query
        ?.normalize('NFKC')
        .toLowerCase()
        .split(/\s+/u)
        .map((token) => token.replace(/\p{P}/gu, ''))
        .filter(Boolean) ?? [];
    const prompt = baixiaoSearchPrompt(questions.question);
    const where = and(
      query.category
        ? sql`${questions.question}->>'category' = ${query.category}`
        : undefined,
      query.difficulty
        ? sql`${questions.question}->>'difficulty' = ${query.difficulty}`
        : undefined,
      query.status ? eq(questions.status, query.status) : undefined,
      ...tokens.map(
        (token) =>
          sql`${prompt} LIKE ${`%${token.replace(/[\\%_]/g, '\\$&')}%`}`,
      ),
    );
    return this.db.transaction(
      async (tx) => {
        const total = await tx.$count(questions, where);
        const page = Math.min(
          query.page,
          Math.max(1, Math.ceil(total / BAIXIAO_ADMIN_PAGE_SIZE)),
        );
        const rows = await tx
          .select({
            id: questions.id,
            question: questions.question,
            status: questions.status,
          })
          .from(questions)
          .where(where)
          .orderBy(
            desc(questions.createdAt),
            questions.knowledgeKey,
            questions.id,
          )
          .limit(BAIXIAO_ADMIN_PAGE_SIZE)
          .offset((page - 1) * BAIXIAO_ADMIN_PAGE_SIZE);
        return {
          total,
          page,
          bank: rows.map(({ id, question, status }) => ({
            id,
            ...BaixiaoQuestionSchema.parse(question),
            status,
          })),
        };
      },
      { isolationLevel: 'repeatable read', accessMode: 'read only' },
    );
  }

  async importQuestions(
    questionsToImport: BaixiaoQuestionData[],
  ): Promise<BaixiaoImportResult> {
    if (
      new Set(questionsToImport.map(({ knowledgeKey }) => knowledgeKey))
        .size !== questionsToImport.length
    ) {
      throw new BadRequestException('同一批导入中存在重复的知识点。');
    }
    const inserted = await this.db
      .insert(questions)
      .values(
        questionsToImport.map((question) => ({
          knowledgeKey: question.knowledgeKey,
          question,
          status: 'published' as const,
        })),
      )
      .onConflictDoNothing({
        target: questions.knowledgeKey,
        where: sql`${questions.status} = 'published'`,
      })
      .returning({ id: questions.id });
    return {
      inserted: inserted.length,
      skipped: questionsToImport.length - inserted.length,
    };
  }

  async setStatus(ids: string[], status: BaixiaoQuestionStatus) {
    try {
      await this.db
        .update(questions)
        .set({ status })
        .where(inArray(questions.id, ids));
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
        throw new ConflictException('同一知识点已有启用题，请先停用旧题。');
      }
      throw error;
    }
  }
}
