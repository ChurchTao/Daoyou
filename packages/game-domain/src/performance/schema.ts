import { z } from 'zod';

export const PERFORMANCE_TONES = [
  'mist',
  'steel',
  'ember',
  'stillness',
] as const;

export type PerformanceTone = (typeof PERFORMANCE_TONES)[number];

const flagSchema = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9]+(?:[-.:][a-z0-9]+)*$/);

const whenSchema = z.union([
  z
    .object({
      path: z.string().trim().min(1).max(40),
      equals: z.string().max(80),
    })
    .strict(),
  z
    .object({
      flag: flagSchema,
      absent: z.boolean().optional(),
    })
    .strict(),
]);

const sceneCueSchema = z
  .object({
    type: z.literal('scene'),
    src: z.string().trim().min(1).max(240).optional(),
    alt: z.string().trim().min(1).max(200).optional(),
    focus: z.string().trim().min(1).max(40).optional(),
    tone: z.enum(PERFORMANCE_TONES).optional(),
    when: whenSchema.optional(),
  })
  .strict();

const titleCueSchema = z
  .object({
    type: z.literal('title'),
    kicker: z.string().trim().min(1).max(40).optional(),
    text: z.string().trim().min(1).max(40),
    when: whenSchema.optional(),
  })
  .strict();

const narrationCueSchema = z
  .object({
    type: z.literal('narration'),
    text: z.string().trim().min(1).max(400),
    when: whenSchema.optional(),
  })
  .strict();

const lineCueSchema = z
  .object({
    type: z.literal('line'),
    speaker: z.string().trim().min(1).max(40),
    text: z.string().trim().min(1).max(400),
    when: whenSchema.optional(),
  })
  .strict();

// 心里话：只属于看的人自己。
const asideCueSchema = z
  .object({
    type: z.literal('aside'),
    text: z.string().trim().min(1).max(400),
    when: whenSchema.optional(),
  })
  .strict();

// 纸中纸：告示、书信、残卷、牌子上的字。
const letterCueSchema = z
  .object({
    type: z.literal('letter'),
    title: z.string().trim().min(1).max(40).optional(),
    text: z.string().trim().min(1).max(400),
    when: whenSchema.optional(),
  })
  .strict();

// 回照：把前面读过的原句重新摆出来。
const recallCueSchema = z
  .object({
    type: z.literal('recall'),
    lines: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
    when: whenSchema.optional(),
  })
  .strict();

const replyCueSchema = z.discriminatedUnion('type', [
  narrationCueSchema,
  lineCueSchema,
  asideCueSchema,
]);

const choiceOptionSchema = z
  .object({
    label: z.string().trim().min(1).max(24),
    jump: z.string().trim().min(1).max(40).optional(),
    outcome: z.string().trim().min(1).max(40).optional(),
    // 选了这一项之后才出现的几句，说完回到选项后面接着演。
    then: z.array(replyCueSchema).min(1).max(8).optional(),
    // 选了这一项就记下的标记。
    set: flagSchema.optional(),
  })
  .strict()
  .superRefine((option, context) => {
    const targets =
      Number(Boolean(option.jump)) +
      Number(Boolean(option.outcome)) +
      Number(Boolean(option.then));
    if (targets > 1) {
      context.addIssue({
        code: 'custom',
        message: '选项只能指向跳转、结果或后续几句之一',
      });
    }
  });

const choiceCueSchema = z
  .object({
    type: z.literal('choice'),
    options: z.array(choiceOptionSchema).min(1).max(4),
    when: whenSchema.optional(),
  })
  .strict();

const markCueSchema = z
  .object({
    type: z.literal('mark'),
    id: z.string().trim().min(1).max(40),
  })
  .strict();

const gotoCueSchema = z
  .object({
    type: z.literal('goto'),
    mark: z.string().trim().min(1).max(40),
    when: whenSchema.optional(),
  })
  .strict();

const endCueSchema = z
  .object({
    type: z.literal('end'),
    outcome: z.string().trim().min(1).max(40),
    when: whenSchema.optional(),
  })
  .strict();

export const PerformanceCueSchema = z.discriminatedUnion('type', [
  sceneCueSchema,
  titleCueSchema,
  narrationCueSchema,
  lineCueSchema,
  asideCueSchema,
  letterCueSchema,
  recallCueSchema,
  choiceCueSchema,
  markCueSchema,
  gotoCueSchema,
  endCueSchema,
]);

export const PerformanceScriptSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(40),
    requires: z.array(z.string().trim().min(1).max(40)).max(8),
    cast: z.record(
      z.string().trim().min(1).max(40),
      z
        .object({
          name: z.string().trim().min(1).max(24),
          portrait: z.string().trim().min(1).max(240).optional(),
        })
        .strict(),
    ),
    cues: z.array(PerformanceCueSchema).min(1).max(160),
  })
  .strict();

export type PerformanceCue = z.infer<typeof PerformanceCueSchema>;
export type PerformanceScript = z.infer<typeof PerformanceScriptSchema>;
export type PerformanceContext = Record<string, string>;

export type PerformanceTextCue = Extract<
  PerformanceCue,
  { type: 'title' | 'narration' | 'line' | 'aside' | 'letter' | 'recall' }
>;

export function isPerformanceTextCue(
  cue: PerformanceCue,
): cue is PerformanceTextCue {
  return (
    cue.type === 'title' ||
    cue.type === 'narration' ||
    cue.type === 'line' ||
    cue.type === 'aside' ||
    cue.type === 'letter' ||
    cue.type === 'recall'
  );
}

/** 一句正文在页面上要显示的字。回照的几句各占一行。 */
export function performanceCueText(cue: PerformanceTextCue): string {
  return cue.type === 'recall' ? cue.lines.join('\n') : cue.text;
}

/** 这场演出里能记下的全部标记。 */
export function performanceFlags(script: PerformanceScript): string[] {
  return script.cues.flatMap((cue) =>
    cue.type === 'choice'
      ? cue.options.flatMap((option) => (option.set ? [option.set] : []))
      : [],
  );
}

const tokenPattern = /\{([A-Za-z0-9_]+)\}/g;

function wordsOf(cue: PerformanceCue): string[] {
  if (cue.type === 'recall') return cue.lines;
  if (cue.type === 'letter') return [cue.title ?? '', cue.text];
  if (cue.type === 'choice') return cue.options.map((option) => option.label);
  if (isPerformanceTextCue(cue)) return [cue.text];
  return [];
}

// 把选项后面跟着的几句摊平成标记与跳转，演的时候只认一条直线。
function unfoldChoices(cues: PerformanceCue[]): PerformanceCue[] {
  const flat: PerformanceCue[] = [];
  cues.forEach((cue, index) => {
    if (
      cue.type !== 'choice' ||
      !cue.options.some((option) => option.then)
    ) {
      flat.push(cue);
      return;
    }
    const after = `~${index}:after`;
    const branches: PerformanceCue[] = [];
    const options = cue.options.map((option, at) => {
      const { then, ...rest } = option;
      if (!then) return rest.jump || rest.outcome ? rest : { ...rest, jump: after };
      const mark = `~${index}:${at}`;
      branches.push(
        { type: 'mark', id: mark },
        ...then,
        { type: 'goto', mark: after },
      );
      return { ...rest, jump: mark };
    });
    flat.push(
      { ...cue, options },
      { type: 'goto', mark: after },
      ...branches,
      { type: 'mark', id: after },
    );
  });
  return flat;
}

export function parsePerformanceScript(input: unknown): PerformanceScript {
  const parsed = PerformanceScriptSchema.parse(input);
  const script = { ...parsed, cues: unfoldChoices(parsed.cues) };
  const marks = new Set<string>();
  let sceneOpened = false;
  let ending = false;

  const validateTokens = (text: string) => {
    for (const match of text.matchAll(tokenPattern)) {
      const token = match[1];
      if (!token || !script.requires.includes(token)) {
        throw new Error(`演出填词未声明：${token ?? ''}`);
      }
    }
  };
  for (const actor of Object.values(script.cast)) validateTokens(actor.name);

  for (const cue of script.cues) {
    if (cue.type === 'mark') {
      if (marks.has(cue.id)) {
        throw new Error(`演出标记重复：${cue.id}`);
      }
      marks.add(cue.id);
    }
    if (cue.type === 'scene') sceneOpened = true;
    if (cue.type === 'line' && !script.cast[cue.speaker]) {
      throw new Error(`演出说话人未登记：${cue.speaker}`);
    }
    if (
      (isPerformanceTextCue(cue) ||
        cue.type === 'choice' ||
        cue.type === 'end') &&
      !sceneOpened
    ) {
      throw new Error('演出在场景之前就有正文');
    }
    for (const text of wordsOf(cue)) validateTokens(text);
    if (cue.type === 'end') ending = true;
  }

  for (const cue of script.cues) {
    if (cue.type === 'goto' && !marks.has(cue.mark)) {
      throw new Error(`演出跳转没有标记：${cue.mark}`);
    }
    if (cue.type !== 'choice') continue;
    for (const option of cue.options) {
      if (option.jump && !marks.has(option.jump)) {
        throw new Error(`演出跳转没有标记：${option.jump}`);
      }
    }
  }

  if (!sceneOpened) throw new Error('演出缺少场景');
  if (!ending) throw new Error('演出缺少结尾');
  return script;
}

export function fillPerformanceScript(
  script: PerformanceScript,
  context: PerformanceContext,
): PerformanceScript {
  for (const key of script.requires) {
    if (!context[key]?.trim()) {
      throw new Error(`演出缺少填词：${key}`);
    }
  }

  const fill = (text: string) =>
    text.replace(
      tokenPattern,
      (whole, token: string) => context[token] ?? whole,
    );

  return {
    ...script,
    cast: Object.fromEntries(
      Object.entries(script.cast).map(([key, actor]) => [
        key,
        { ...actor, name: fill(actor.name) },
      ]),
    ),
    cues: script.cues.map((cue): PerformanceCue => {
      if (cue.type === 'recall') {
        return { ...cue, lines: cue.lines.map(fill) };
      }
      if (cue.type === 'letter') {
        return {
          ...cue,
          text: fill(cue.text),
          ...(cue.title ? { title: fill(cue.title) } : {}),
        };
      }
      if (cue.type === 'choice') {
        return {
          ...cue,
          options: cue.options.map((option) => ({
            ...option,
            label: fill(option.label),
          })),
        };
      }
      if (isPerformanceTextCue(cue)) return { ...cue, text: fill(cue.text) };
      return cue;
    }),
  };
}
