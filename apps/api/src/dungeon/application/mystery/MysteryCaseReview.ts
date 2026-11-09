import type { MysteryCaseFile } from '@daoyou/game-domain/dungeon/mystery';
import type { AiService } from '@nestjs/ai';
import { renderPrompt } from '@server/lib/prompts/index.js';
import { aiDeadlineSignal } from '@server/llm/call-options.js';
import { stableCompactStringify } from '@server/utils/llmPayload.js';
import { z } from 'zod';
import {
  MYSTERY_GENERATION_THINKING,
  MYSTERY_STAGE_TIMEOUT_MS,
} from './mysteryGenerationSettings.js';

/** 大纲阶段确定、后续所有正文都必须遵守的事实设定。 */
/** 大纲阶段定下的事实设定，字段随案型不同。 */
export type MysteryCanon = Record<string, string>;

/** 三轮审校共用的故事设定与受保护字段，仅在服务端传递。 */
export interface MysteryReviewContext {
  canon: MysteryCanon;
  locked: readonly string[];
}

/** 程序固定的归属、来源和触发关系，不从模型正文推断。 */
export function mysteryCaseFacts(c: MysteryCaseFile, statement?: string) {
  return {
    startRoomId: c.startRoomId,
    spatialRule:
      'roomId 是程序固定的实际位置；出示线索是传达已知信息，不会搬动物件或人物。',
    dialogueRule:
      '秘密按 requires 解锁。反应不按数组顺序触发：人物在场、玩家持有 evidenceId 且该反应尚未触发即可，不要求先听过陈述或触发其他反应。exposesLie 标记本次是否戳穿谎言，不是其他反应的前置条件。',
    rooms: c.rooms.map(({ id, exits, requires }) => ({ id, exits, requires })),
    objects: c.objects.map(({ id, roomId }) => ({ id, roomId })),
    clues: c.clues.map(({ id, foundAt, supports }) => ({
      id,
      foundAt,
      supports,
    })),
    items: c.items.map(({ id, initial, foundAt }) => ({
      id,
      initial,
      foundAt,
    })),
    npcs: c.npcs.map(({ id, role, roomId, secrets, reactions }) => ({
      id,
      role,
      roomId,
      statement: secrets.some((s) => s.clueId === 'clue_claim')
        ? statement
        : undefined,
      secrets: secrets.map(({ clueId, requires }) => ({ clueId, requires })),
      reactions: reactions.map(({ id, evidenceId, exposesLie, effects }) => ({
        id,
        field: `reactions.${id}`,
        evidenceId,
        exposesLie,
        effects,
      })),
    })),
    interactions: c.interactions.map(
      ({ id, itemId, targetId, requires, effects }) => ({
        id,
        itemId,
        targetId,
        requires,
        effects,
      }),
    ),
    guards: (c.guards ?? []).map(({ id, roomId, bypass }) => ({
      id,
      roomId,
      bypass,
    })),
    mechanisms: (c.mechanisms ?? []).map(
      ({ id, objectId, final, hints, onSolve }) => ({
        id,
        objectId,
        final,
        hints,
        onSolve,
      }),
    ),
    events: (c.events ?? []).map(({ id, warnAt, at, unless, effects }) => ({
      id,
      warnAt,
      at,
      unless,
      effects,
    })),
    answers: c.questions.map(({ id, answer }) => ({ id, answer })),
  };
}

const INTERNAL_ID = /[a-z]+_[a-z0-9_]+/;

/**
 * 有名称表时先解析内部引用，未知引用拒绝写入；再清理格式并按上限截断。
 * 未提供名称表的自由对话沿用原有清理方式。
 */
export function cleanMysteryText(
  text: string,
  limit: number,
  references?: Readonly<Record<string, string>>,
) {
  const resolved = references
    ? text.replace(new RegExp(INTERNAL_ID.source, 'g'), (id) => {
        const name = Object.hasOwn(references, id) ? references[id] : undefined;
        if (!name || INTERNAL_ID.test(name))
          throw new Error(`剧本文本引用了未知或无效名称：${id}`);
        return name;
      })
    : text;
  const value = resolved
    .replace(/\*\*/g, '')
    .replace(
      new RegExp(`[（(][^（）()]*${INTERNAL_ID.source}[^（）()]*[）)]`, 'g'),
      '',
    )
    .replace(new RegExp(INTERNAL_ID.source, 'g'), '')
    // 偶尔混入的英文单词。
    .replace(/ ?[A-Za-z]{2,} ?/g, '')
    // 去掉英文后留下的空括号。
    .replace(/[（(]\s*[）)]/g, '')
    .trim();
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

interface TextField {
  path: string;
  limit: number;
  get(): string;
  set(value: string): void;
}

/** 案卷中所有可审校的正文字段，路径即审校输出里的 `field`。 */
function textFields(c: MysteryCaseFile): TextField[] {
  const fields: TextField[] = [];
  const add = <T extends object, K extends keyof T>(
    path: string,
    target: T,
    key: K,
    limit: number,
  ) =>
    fields.push({
      path,
      limit,
      get: () => String(target[key] ?? ''),
      set: (value) => {
        target[key] = value as T[K];
      },
    });
  add('brief.identity', c.brief, 'identity', 120);
  add('brief.goal', c.brief, 'goal', 120);
  add('brief.opening', c.brief, 'opening', 400);
  for (const r of c.brief.relations)
    add(`brief.relations.${r.npcId}`, r, 'text', 80);
  for (const r of c.rooms) {
    add(`rooms.${r.id}.description`, r, 'description', 240);
    add(`rooms.${r.id}.brief`, r, 'brief', 60);
    if (r.lockedText) add(`rooms.${r.id}.lockedText`, r, 'lockedText', 80);
  }
  for (const o of c.objects) add(`objects.${o.id}.detail`, o, 'detail', 220);
  for (const x of c.clues) add(`clues.${x.id}.text`, x, 'text', 160);
  for (const x of c.items) add(`items.${x.id}.text`, x, 'text', 120);
  for (const n of c.npcs) {
    add(`npcs.${n.id}.greeting`, n, 'greeting', 200);
    add(`npcs.${n.id}.idleLine`, n, 'idleLine', 120);
    add(`npcs.${n.id}.deflectLine`, n, 'deflectLine', 120);
    for (const s of n.secrets)
      add(`secrets.${n.id}:${s.clueId}`, s, 'line', 220);
    for (const r of n.reactions) add(`reactions.${r.id}`, r, 'line', 220);
  }
  for (const i of c.interactions) add(`interactions.${i.id}`, i, 'text', 220);
  for (const q of c.questions) {
    add(`questions.${q.id}.explanation`, q, 'explanation', 200);
    for (const o of q.options ?? [])
      add(`options.${q.id}.${o.id}`, o, 'label', 30);
  }
  for (const e of c.events ?? []) {
    add(`events.${e.id}.warning`, e, 'warning', 160);
    add(`events.${e.id}.text`, e, 'text', 200);
  }
  for (const g of c.guards ?? []) {
    add(`guards.${g.id}.description`, g, 'description', 200);
    add(`guards.${g.id}.bypassText`, g, 'bypassText', 200);
  }
  return fields;
}

function names(c: MysteryCaseFile, includeTitles = true) {
  return Object.fromEntries(
    [
      ...c.rooms,
      ...c.objects,
      ...c.clues,
      ...c.items,
      ...c.npcs,
      ...(c.guards ?? []),
      ...(c.mechanisms ?? []),
      ...(c.mechanisms ?? []).flatMap((m) =>
        m.parts.map((p) => ({ id: p.id, name: p.label })),
      ),
      ...c.questions.flatMap((q) =>
        (q.options ?? []).map((o) => ({ id: o.id, name: o.label })),
      ),
    ].map((x) => [
      x.id,
      includeTitles && 'title' in x ? `${x.name}（${x.title}）` : x.name,
    ]),
  );
}

export interface MysteryReviewIssue {
  field: string;
  problem: string;
  severity: 'major' | 'minor';
}

/**
 * 一致性审校：对照事实设定找出正文之间的矛盾，并只改写有问题的字段。
 * `locked` 中的字段由程序统一渲染（如凶手原话），不交给模型改写。
 */
export async function reviewMysteryCase(
  ai: AiService,
  caseFile: MysteryCaseFile,
  canon: MysteryCanon | undefined,
  options: { locked?: readonly string[]; apply?: boolean } = {},
): Promise<{ caseFile: MysteryCaseFile; issues: MysteryReviewIssue[] }> {
  const result = structuredClone(caseFile);
  const allFields = textFields(result);
  const fields = allFields.filter((f) => !options.locked?.includes(f.path));
  const paths = fields.map((f) => f.path) as [string, ...string[]];
  const schema = z.object({
    issues: z
      .array(
        z.object({
          field: z.enum(paths),
          problem: z
            .string()
            .describe('先核对再下结论：一句话说明矛盾，40 字以内'),
          severity: z
            .enum(['major', 'minor'])
            .describe(
              'major：身份、关系、物证内容或推理链矛盾，会让玩家推理出错；minor：措辞或细节不统一',
            ),
          confirmed: z
            .boolean()
            .describe(
              '核对后确属矛盾或泄露为 true；谎言本身、可接受的扩写或无矛盾为 false',
            ),
          fixed: z
            .string()
            .describe('该字段改好后的完整文字；confirmed 为 false 时照抄原文'),
        }),
      )
      .max(12),
  });
  const prompt = renderPrompt('dungeon-case-review', {
    userContextJson: stableCompactStringify({
      canon: {
        ...canon,
        programFacts: mysteryCaseFacts(
          result,
          result.clues.find((x) => x.id === 'clue_claim')?.text,
        ),
        readOnlyFields: Object.fromEntries(
          allFields
            .filter((f) => options.locked?.includes(f.path))
            .map((f) => [f.path, f.get()]),
        ),
      },
      truth: caseFile.truth,
      names: names(caseFile),
      fields: Object.fromEntries(fields.map((f) => [f.path, f.get()])),
    }),
  });
  const { object: output } = await ai.generateObject({
    model: 'alibaba.advanced',
    instructions: prompt.system,
    prompt: prompt.user,
    schema,
    schemaName: 'DungeonMysteryReview',
    label: 'dungeon-case-review',
    abortSignal: aiDeadlineSignal(MYSTERY_STAGE_TIMEOUT_MS),
    providerOptions: {
      alibaba: {
        enableThinking: MYSTERY_GENERATION_THINKING.review,
        thinkingBudget: 4096,
      },
      deepseek: {
        thinking: {
          type: MYSTERY_GENERATION_THINKING.review ? 'enabled' : 'disabled',
        },
      },
    },
  });
  const byPath = new Map(fields.map((f) => [f.path, f]));
  const references = names(result, false);
  const issues: MysteryReviewIssue[] = [];
  for (const issue of output.issues) {
    const field = byPath.get(issue.field);
    if (
      !issue.confirmed ||
      !field ||
      issues.some((i) => i.field === issue.field)
    )
      continue;
    issues.push({
      field: issue.field,
      problem: issue.problem,
      severity: issue.severity,
    });
    if (options.apply !== false) {
      try {
        const fixed = cleanMysteryText(issue.fixed, field.limit, references);
        if (fixed) field.set(fixed);
      } catch (error) {
        console.warn('[DungeonMystery] 审校修正文含无效引用，保留原文:', {
          field: issue.field,
          error,
        });
      }
    }
  }
  return { caseFile: result, issues };
}
