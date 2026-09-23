import { z } from 'zod';

export const PERFORMANCE_TONES = ['mist', 'steel', 'ember', 'stillness'] as const;

export type PerformanceTone = (typeof PERFORMANCE_TONES)[number];

const whenSchema = z
  .object({
    path: z.string().trim().min(1).max(40),
    equals: z.string().max(80),
  })
  .strict();

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

const choiceOptionSchema = z
  .object({
    label: z.string().trim().min(1).max(24),
    jump: z.string().trim().min(1).max(40).optional(),
    outcome: z.string().trim().min(1).max(40).optional(),
  })
  .strict()
  .superRefine((option, context) => {
    const targets = Number(Boolean(option.jump)) + Number(Boolean(option.outcome));
    if (targets !== 1) {
      context.addIssue({
        code: 'custom',
        message: '选项必须且只能指向跳转或结果之一',
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
  choiceCueSchema,
  markCueSchema,
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
    cues: z.array(PerformanceCueSchema).min(1).max(80),
  })
  .strict();

export type PerformanceCue = z.infer<typeof PerformanceCueSchema>;
export type PerformanceScript = z.infer<typeof PerformanceScriptSchema>;
export type PerformanceContext = Record<string, string>;

const tokenPattern = /\{([A-Za-z0-9_]+)\}/g;

function textOf(cue: PerformanceCue): string | null {
  if (cue.type === 'narration' || cue.type === 'line' || cue.type === 'title') {
    return cue.text;
  }
  return null;
}

export function parsePerformanceScript(input: unknown): PerformanceScript {
  const script = PerformanceScriptSchema.parse(input);
  const marks = new Set<string>();
  let sceneReady = false;
  let ending = false;

  for (const cue of script.cues) {
    if (cue.type === 'mark') {
      if (marks.has(cue.id)) {
        throw new Error(`演出标记重复：${cue.id}`);
      }
      marks.add(cue.id);
    }
    if (cue.type === 'scene' && cue.src) sceneReady = true;
    if (cue.type === 'line' && !script.cast[cue.speaker]) {
      throw new Error(`演出说话人未登记：${cue.speaker}`);
    }
    if (
      (cue.type === 'narration' ||
        cue.type === 'line' ||
        cue.type === 'title' ||
        cue.type === 'choice' ||
        cue.type === 'end') &&
      !sceneReady
    ) {
      throw new Error('演出在第一张画面之前就有正文');
    }
    const text = textOf(cue);
    if (text) {
      for (const match of text.matchAll(tokenPattern)) {
        const token = match[1];
        if (!token || !script.requires.includes(token)) {
          throw new Error(`演出填词未声明：${token ?? ''}`);
        }
      }
    }
    if (cue.type === 'end') ending = true;
  }

  for (const cue of script.cues) {
    if (cue.type !== 'choice') continue;
    for (const option of cue.options) {
      if (option.jump && !marks.has(option.jump)) {
        throw new Error(`演出跳转没有标记：${option.jump}`);
      }
    }
  }

  if (!sceneReady) throw new Error('演出缺少画面');
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
    text.replace(tokenPattern, (whole, token: string) => context[token] ?? whole);

  return {
    ...script,
    cues: script.cues.map((cue) => {
      if (cue.type === 'narration' || cue.type === 'title') {
        return { ...cue, text: fill(cue.text) };
      }
      if (cue.type === 'line') return { ...cue, text: fill(cue.text) };
      return cue;
    }),
  };
}
