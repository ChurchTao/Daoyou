import { AlibabaLanguageModelOptions, createAlibaba } from '@ai-sdk/alibaba';
import { createDeepSeek, DeepSeekLanguageModelOptions } from '@ai-sdk/deepseek';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { getCurrentContext } from '@server/lib/http/context';
import { recordLlmCallMetric } from '@server/lib/llm/metricsStore';
import { stableCompactStringify } from '@server/utils/llmPayload';
import { generateText, LanguageModel, streamText, ToolSet } from 'ai';
import { jsonrepair } from 'jsonrepair';
import z from 'zod';

export type LlmSceneId =
  | 'alchemy-improvised-copy'
  | 'alchemy-recipe-plan'
  | 'battle-report'
  | 'breakthrough-story'
  | 'character-generation'
  | 'divine-fortune'
  | 'dungeon-round'
  | 'dungeon-settlement'
  | 'enemy-narrative'
  | 'fate-naming'
  | 'lifespan-exhausted'
  | 'material-generation'
  | 'material-semantic-enrichment'
  | 'product-naming'
  | 'yield-story';

export interface LlmCallMetrics {
  sceneId: LlmSceneId | 'unknown';
  provider: string;
  model: string;
  systemChars: number;
  userChars: number;
  schemaChars: number;
  retryCount: number;
  usage: Record<string, number>;
  status: 'success' | 'failure';
}

type StructuredLlmOptions<T> = {
  schema: z.ZodType<T>;
  schemaName?: string;
  schemaDescription?: string;
  llmSchema?: z.ZodType<unknown>;
  llmConstraint?: string;
  sceneId?: LlmSceneId;
};

type LlmTextOptions = {
  sceneId?: LlmSceneId;
};

type ResolvedModelHandle = {
  model: LanguageModel;
  providerName: string;
  modelName: string;
};

function resolveProviderName(override?: LlmOverrideConfig): string {
  return (
    getEffectiveProvider(override) ??
    process.env.PROVIDER_CHOOSE ??
    'openai-compatible'
  );
}

function buildStructuredConstraintText<T>(
  options: StructuredLlmOptions<T>,
): string {
  if (options.llmConstraint?.trim()) {
    return options.llmConstraint.trim();
  }

  const schema = options.llmSchema ?? options.schema;
  return stableCompactStringify(schema.toJSONSchema());
}

export function buildStructuredSystemPrompt<T>(
  system: string,
  options: StructuredLlmOptions<T>,
): {
  systemPrompt: string;
  schemaChars: number;
} {
  const constraintText = buildStructuredConstraintText(options);
  return {
    systemPrompt: `${system}

[输出 JSON 格式要求]
你必须遵循以下 JSON Schema 进行输出：
${constraintText}`,
    schemaChars: constraintText.length,
  };
}

function summarizeUsage(usage: unknown): Record<string, number> {
  if (!usage || typeof usage !== 'object') {
    return {};
  }

  return Object.entries(usage as Record<string, unknown>).reduce<
    Record<string, number>
  >((acc, [key, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

function accumulateUsage(
  total: Record<string, number>,
  usage: unknown,
): Record<string, number> {
  const summarized = summarizeUsage(usage);
  for (const [key, value] of Object.entries(summarized)) {
    total[key] = (total[key] ?? 0) + value;
  }
  return total;
}

function logLlmCallMetrics(metrics: LlmCallMetrics): void {
  console.info('[LLM_METRICS]', JSON.stringify(metrics));
  recordLlmCallMetric(metrics);
}

function baseMetrics(args: {
  sceneId?: LlmSceneId;
  provider: string;
  model: string;
  systemChars: number;
  userChars: number;
  schemaChars?: number;
  retryCount?: number;
  usage?: unknown;
  status: 'success' | 'failure';
}): LlmCallMetrics {
  return {
    sceneId: args.sceneId ?? 'unknown',
    provider: args.provider,
    model: args.model,
    systemChars: args.systemChars,
    userChars: args.userChars,
    schemaChars: args.schemaChars ?? 0,
    retryCount: args.retryCount ?? 0,
    usage: summarizeUsage(args.usage),
    status: args.status,
  };
}

function injectSystemWithSchema<T>(
  system: string,
  options: StructuredLlmOptions<T>,
): {
  systemPrompt: string;
  schemaChars: number;
} {
  return buildStructuredSystemPrompt(system, options);
}

function getArkRandomModel() {
  const models = process.env.ARK_MODEL_USE!.split(',');
  return models[Math.floor(Math.random() * models.length)];
}

/**
 * 从请求上下文读取用户自定义 LLM 配置
 */
export type UserLlmConfig = {
  provider: string;
  apiKey: string;
  baseUrl: string | null;
  model: string;
  fastModel: string;
};

function getUserLlmConfig(): UserLlmConfig | undefined {
  try {
    const ctx = getCurrentContext();
    return ctx.get('llmConfig');
  } catch {
    return undefined;
  }
}

export type LlmOverrideConfig = {
  provider: string;
  apiKey: string;
  baseUrl?: string | null;
  model: string;
  fastModel: string;
};

function getEffectiveProvider(
  override?: LlmOverrideConfig,
): string | undefined {
  return (override ?? getUserLlmConfig())?.provider;
}

function kimiTemperature(override?: LlmOverrideConfig): number | undefined {
  return getEffectiveProvider(override) === 'kimi' ? 0.6 : undefined;
}

/**
 * 获取 Provider
 */
function getProvider(override?: LlmOverrideConfig) {
  const userConfig = override ?? getUserLlmConfig();

  if (userConfig) {
    if (userConfig.provider === 'openrouter') {
      return createOpenRouter({ apiKey: userConfig.apiKey });
    }
    return createDeepSeek({
      apiKey: userConfig.apiKey,
      baseURL: userConfig.baseUrl ?? undefined,
    });
  }

  if (process.env.PROVIDER_CHOOSE === 'ark') {
    return createDeepSeek({
      baseURL: process.env.ARK_BASE_URL,
      apiKey: process.env.ARK_API_KEY,
    });
  }
  if (process.env.PROVIDER_CHOOSE === 'kimi') {
    return createDeepSeek({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL,
    });
  }
  if (process.env.PROVIDER_CHOOSE === 'openrouter') {
    return createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  if (process.env.PROVIDER_CHOOSE === 'deepseek') {
    return createDeepSeek({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL,
    });
  }
  return createDeepSeek({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * 获取 Model 实例
 */
function resolveModelHandle(
  fast: boolean = false,
  override?: LlmOverrideConfig,
): ResolvedModelHandle {
  const userConfig = override ?? getUserLlmConfig();
  const providerName = resolveProviderName(override);

  if (userConfig) {
    const modelName = fast ? userConfig.fastModel : userConfig.model;
    if (userConfig.provider === 'alibaba') {
      const alibabaProvider = createAlibaba({
        apiKey: userConfig.apiKey,
        baseURL: userConfig.baseUrl ?? undefined,
      });
      return {
        model: alibabaProvider.languageModel(modelName),
        providerName,
        modelName,
      };
    }
    const provider = getProvider(override);
    return {
      model: provider(modelName),
      providerName,
      modelName,
    };
  }

  const provider = getProvider(override);
  if (process.env.PROVIDER_CHOOSE === 'ark') {
    const modelName = fast
      ? process.env.ARK_MODEL_FAST_USE!
      : getArkRandomModel();
    return {
      model: provider(modelName),
      providerName,
      modelName,
    };
  } else if (process.env.PROVIDER_CHOOSE === 'kimi') {
    const modelName = fast
      ? process.env.KIMI_MODEL_FAST_USE
      : process.env.KIMI_MODEL_USE;
    return {
      model: provider(modelName!),
      providerName,
      modelName: modelName!,
    };
  } else if (process.env.PROVIDER_CHOOSE === 'alibaba') {
    const modelName = fast
      ? process.env.ALIBABA_MODEL_FAST_USE
      : process.env.ALIBABA_MODEL_USE;
    const alibabaProvider = createAlibaba({
      apiKey: process.env.ALIBABA_API_KEY,
      baseURL: process.env.ALIBABA_BASE_URL,
    });
    return {
      model: alibabaProvider.languageModel(modelName!),
      providerName,
      modelName: modelName!,
    };
  } else if (process.env.PROVIDER_CHOOSE === 'openrouter') {
    const modelName = fast
      ? process.env.OPENROUTER_MODEL_FAST_USE
      : process.env.OPENROUTER_MODEL_USE;
    return {
      model: provider(modelName!),
      providerName,
      modelName: modelName!,
    };
  } else if (process.env.PROVIDER_CHOOSE === 'deepseek') {
    const modelName = fast
      ? process.env.DEEPSEEK_MODEL_FAST_USE
      : process.env.DEEPSEEK_MODEL_USE;
    return {
      model: provider(modelName!),
      providerName,
      modelName: modelName!,
    };
  } else {
    const modelName = fast
      ? process.env.FAST_MODEL!
      : process.env.OPENAI_MODEL!;
    return {
      model: provider(modelName),
      providerName,
      modelName,
    };
  }
}

export function getModel(fast: boolean = false, override?: LlmOverrideConfig) {
  return resolveModelHandle(fast, override).model;
}

/**
 * 通用直接生成 Text
 */
export async function text(
  prompt: string,
  userInput: string,
  fast: boolean = false,
  override?: LlmOverrideConfig,
  options: LlmTextOptions = {},
) {
  const { model, providerName, modelName } = resolveModelHandle(fast, override);
  const temperature = kimiTemperature(override);
  try {
    const res = await generateText({
      model,
      system: prompt,
      prompt: userInput,
      ...(temperature !== undefined && { temperature }),
      providerOptions: {
        deepseek: {
          thinking: { type: 'disabled' },
        } satisfies DeepSeekLanguageModelOptions,
        alibaba: {
          enableThinking: false,
          thinkingBudget: 2048,
        } satisfies AlibabaLanguageModelOptions,
      },
    });
    logLlmCallMetrics(
      baseMetrics({
        sceneId: options.sceneId,
        provider: providerName,
        model: modelName,
        systemChars: prompt.length,
        userChars: userInput.length,
        usage: res.usage,
        status: 'success',
      }),
    );
    return res;
  } catch (error) {
    logLlmCallMetrics(
      baseMetrics({
        sceneId: options.sceneId,
        provider: providerName,
        model: modelName,
        systemChars: prompt.length,
        userChars: userInput.length,
        status: 'failure',
      }),
    );
    throw error;
  }
}

/**
 * 通用 Stream 生成 Text
 */
export function stream_text(
  prompt: string,
  userInput: string,
  fast: boolean = false,
  thinking: boolean = false,
  options: LlmTextOptions = {},
) {
  const { model, providerName, modelName } = resolveModelHandle(fast);
  const temperature = kimiTemperature();
  try {
    return streamText({
      model,
      system: prompt,
      prompt: userInput,
      ...(temperature !== undefined && { temperature }),
      onFinish: (res) => {
        logLlmCallMetrics(
          baseMetrics({
            sceneId: options.sceneId,
            provider: providerName,
            model: modelName,
            systemChars: prompt.length,
            userChars: userInput.length,
            usage: res.usage,
            status: 'success',
          }),
        );
      },
      providerOptions: {
        deepseek: {
          thinking: { type: thinking ? 'enabled' : 'disabled' },
        } satisfies DeepSeekLanguageModelOptions,
        alibaba: {
          enableThinking: thinking,
          thinkingBudget: 2048,
        } satisfies AlibabaLanguageModelOptions,
      },
    });
  } catch (error) {
    logLlmCallMetrics(
      baseMetrics({
        sceneId: options.sceneId,
        provider: providerName,
        model: modelName,
        systemChars: prompt.length,
        userChars: userInput.length,
        status: 'failure',
      }),
    );
    throw error;
  }
}

/**
 * 核心逻辑：生成结构化数据并进行手动校验与重试
 */
async function generateStructuredData<T>(
  prompt: string,
  userInput: string,
  options: StructuredLlmOptions<T>,
  fast: boolean = false,
  thinking: boolean = false,
) {
  const maxRetries = 3;
  let lastError: z.ZodError<T> | undefined = undefined;
  let lastUsage: Record<string, number> = {};
  const { systemPrompt, schemaChars } = injectSystemWithSchema(prompt, options);
  let lastProviderName = resolveProviderName();
  let lastModelName = '';

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 每次重试降低温度：1.0 -> 0.7 -> 0.4 (更加稳定)
    const kimiTemp = kimiTemperature();
    const temperature =
      kimiTemp !== undefined
        ? Math.max(0, kimiTemp - attempt * 0.2)
        : Math.max(0, 1 - attempt * 0.3);
    const { model, providerName, modelName } = resolveModelHandle(fast);
    lastProviderName = providerName;
    lastModelName = modelName;
    let res;
    try {
      res = await generateText({
        model,
        temperature,
        system: systemPrompt,
        prompt: userInput,
        // output: Output.json(),
        providerOptions: {
          deepseek: {
            thinking: { type: thinking ? 'enabled' : 'disabled' },
          } satisfies DeepSeekLanguageModelOptions,
          alibaba: {
            enableThinking: thinking,
            thinkingBudget: 2048,
          } satisfies AlibabaLanguageModelOptions,
        },
      });
    } catch (error) {
      logLlmCallMetrics(
        baseMetrics({
          sceneId: options.sceneId,
          provider: providerName,
          model: modelName,
          systemChars: prompt.length,
          userChars: userInput.length,
          schemaChars,
          retryCount: attempt,
          usage: lastUsage,
          status: 'failure',
        }),
      );
      throw error;
    }
    lastUsage = accumulateUsage(lastUsage, res.usage);
    let json;
    try {
      json = JSON.parse(res.output);
    } catch (error) {
      console.warn(`AI生成的JSON解析失败，尝试修复：${error}`);
      const repaired = jsonrepair(res.output);
      json = JSON.parse(repaired);
    }
    const parsed = options.schema.safeParse(json);
    if (parsed.success) {
      if (attempt > 0) {
        console.info(`结构化数据在第 ${attempt + 1} 次尝试成功。`);
      }
      logLlmCallMetrics(
        baseMetrics({
          sceneId: options.sceneId,
          provider: providerName,
          model: modelName,
          systemChars: prompt.length,
          userChars: userInput.length,
          schemaChars,
          retryCount: attempt,
          usage: lastUsage,
          status: 'success',
        }),
      );
      return {
        ...res,
        object: parsed.data,
      };
    }

    console.warn(
      `第 ${attempt + 1} 次尝试结构化校验失败:`,
      z.treeifyError(parsed.error),
    );
    lastError = parsed.error;
  }

  logLlmCallMetrics(
    baseMetrics({
      sceneId: options.sceneId,
      provider: lastProviderName,
      model: lastModelName,
      systemChars: prompt.length,
      userChars: userInput.length,
      schemaChars,
      retryCount: maxRetries - 1,
      usage: lastUsage,
      status: 'failure',
    }),
  );

  throw new Error(
    `无法生成符合要求的结构化数据。尝试：${maxRetries}次。最后错误：${lastError?.message || '未知错误'}`,
  );
}

/**
 * 生成单一结构化对象
 */
export async function object<T>(
  prompt: string,
  userInput: string,
  options: StructuredLlmOptions<T>,
  fast: boolean = false,
  thinking: boolean = false,
) {
  return generateStructuredData(prompt, userInput, options, fast, thinking);
}

/**
 * 生成结构化对象数组
 */
export async function objectArray<T>(
  prompt: string,
  userInput: string,
  options: StructuredLlmOptions<T>,
  fast: boolean = false,
  thinking: boolean = false,
) {
  // 注意：options.schema 预期是一个数组类型的 Zod Schema (z.array(...))
  return generateStructuredData(prompt, userInput, options, fast, thinking);
}

/**
 * Tool 调用生成器
 */
export async function tool(
  prompt: string,
  userInput: string,
  tools: ToolSet,
  thinking: boolean = false,
  options: LlmTextOptions = {},
) {
  const { model, providerName, modelName } = resolveModelHandle();
  const temperature = kimiTemperature();
  try {
    const res = await generateText({
      model,
      system: prompt,
      prompt: userInput,
      tools,
      ...(temperature !== undefined && { temperature }),
      providerOptions: {
        deepseek: {
          thinking: { type: thinking ? 'enabled' : 'disabled' },
        } satisfies DeepSeekLanguageModelOptions,
        alibaba: {
          enableThinking: thinking,
          thinkingBudget: 2048,
        } satisfies AlibabaLanguageModelOptions,
      },
    });
    logLlmCallMetrics(
      baseMetrics({
        sceneId: options.sceneId,
        provider: providerName,
        model: modelName,
        systemChars: prompt.length,
        userChars: userInput.length,
        usage: res.usage,
        status: 'success',
      }),
    );
    return res;
  } catch (error) {
    logLlmCallMetrics(
      baseMetrics({
        sceneId: options.sceneId,
        provider: providerName,
        model: modelName,
        systemChars: prompt.length,
        userChars: userInput.length,
        status: 'failure',
      }),
    );
    throw error;
  }
}
