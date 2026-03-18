import { AlibabaLanguageModelOptions, createAlibaba } from '@ai-sdk/alibaba';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, streamText, ToolSet } from 'ai';
import { jsonrepair } from 'jsonrepair';
import z from 'zod';

/**
 * 注入 Schema 到 System Prompt
 */
const injectSystemWithSchema = (system: string, schema: z.ZodType<unknown>) => {
  const jsonSchema = schema.toJSONSchema();
  return `${system}

[输出 JSON 格式要求]
你必须遵循以下 JSON Schema 进行输出：
${JSON.stringify(jsonSchema, null, 2)}`;
};

/**
 * 获取 DeepSeek Provider
 */
function getDeepSeekProvider() {
  if (process.env.PROVIDER_CHOOSE === 'ark') {
    return createDeepSeek({
      baseURL: process.env.ARK_BASE_URL,
      apiKey: process.env.ARK_API_KEY,
      // fetch: async (url, init) => {
      //   console.log('==== LLM REQUEST ====');
      //   console.log('URL:', url);
      //   console.log('HEADERS:', init?.headers);
      //   console.log('BODY:', init?.body);

      //   const res = await fetch(url, init);

      //   const clone = res.clone();
      //   console.log('==== LLM RESPONSE ====');
      //   console.log(await clone.text());
      //   return res;
      // },
    });
  }
  if (process.env.PROVIDER_CHOOSE === 'kimi') {
    return createDeepSeek({
      apiKey: process.env.KIMI_API_KEY,
      baseURL: process.env.KIMI_BASE_URL,
    });
  }
  return createDeepSeek({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

const getArkRandomModel = () => {
  const models = process.env.ARK_MODEL_USE!.split(',');
  return models[Math.floor(Math.random() * models.length)];
};

/**
 * 获取 Model 实例
 */
export function getModel(fast: boolean = false) {
  const provider = getDeepSeekProvider();
  if (process.env.PROVIDER_CHOOSE === 'ark') {
    const model = fast ? process.env.ARK_MODEL_FAST_USE : getArkRandomModel();
    return provider(model!);
  } else if (process.env.PROVIDER_CHOOSE === 'kimi') {
    const model = fast
      ? process.env.KIMI_MODEL_FAST_USE
      : process.env.KIMI_MODEL_USE;
    return provider(model!);
  } else if (process.env.PROVIDER_CHOOSE === 'alibaba') {
    const model = fast
      ? process.env.ALIBABA_MODEL_FAST_USE
      : process.env.ALIBABA_MODEL_USE;
    const alibabaProvider = createAlibaba({
      apiKey: process.env.ALIBABA_API_KEY,
      baseURL: process.env.ALIBABA_BASE_URL,
    });
    return alibabaProvider.languageModel(model!);
  } else {
    const model = fast ? process.env.FAST_MODEL : process.env.OPENAI_MODEL;
    return provider(model!);
  }
}

/**
 * 通用直接生成 Text
 */
export async function text(
  prompt: string,
  userInput: string,
  fast: boolean = false,
) {
  const model = getModel(fast);
  const res = await generateText({
    model,
    system: prompt,
    prompt: userInput,
    providerOptions: {
      deepseek: { thinking: { type: 'disabled' } },
      alibaba: {
        enableThinking: false,
        thinkingBudget: 2048,
      } satisfies AlibabaLanguageModelOptions,
    },
  });
  return res;
}

/**
 * 通用 Stream 生成 Text
 */
export function stream_text(
  prompt: string,
  userInput: string,
  fast: boolean = false,
  thinking: boolean = false,
) {
  const model = getModel(fast);
  return streamText({
    model,
    system: prompt,
    prompt: userInput,
    onFinish: (res) => {
      console.debug('AI生成Text Stream：usage', res.usage);
    },
    providerOptions: {
      deepseek: { thinking: { type: thinking ? 'auto' : 'disabled' } },
      alibaba: {
        enableThinking: thinking,
        thinkingBudget: 2048,
      } satisfies AlibabaLanguageModelOptions,
    },
  });
}

/**
 * 核心逻辑：生成结构化数据并进行手动校验与重试
 */
async function generateStructuredData<T>(
  prompt: string,
  userInput: string,
  options: {
    schema: z.ZodType<T>;
    schemaName?: string;
    schemaDescription?: string;
  },
  fast: boolean = false,
  thinking: boolean = false,
) {
  const maxRetries = 3;
  let lastError: z.ZodError<T> | undefined = undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // 每次重试降低温度：1.0 -> 0.7 -> 0.4 (更加稳定)
    const temperature = Math.max(0, 1 - attempt * 0.3);
    const model = getModel(fast);
    const res = await generateText({
      model,
      temperature,
      system: injectSystemWithSchema(prompt, options.schema),
      prompt: userInput,
      // output: Output.json(),
      providerOptions: {
        deepseek: { thinking: { type: thinking ? 'auto' : 'disabled' } },
        alibaba: {
          enableThinking: thinking,
          thinkingBudget: 2048,
        } satisfies AlibabaLanguageModelOptions,
      },
    });
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
  options: {
    schemaName?: string;
    schemaDescription?: string;
    schema: z.ZodType<T>;
  },
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
  options: {
    schemaName?: string;
    schemaDescription?: string;
    schema: z.ZodType<T>;
  },
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
) {
  const model = getModel();
  const res = await generateText({
    model,
    system: prompt,
    prompt: userInput,
    tools,
    providerOptions: {
      deepseek: { thinking: { type: thinking ? 'auto' : 'disabled' } },
      alibaba: {
        enableThinking: thinking,
        thinkingBudget: 2048,
      } satisfies AlibabaLanguageModelOptions,
    },
  });
  console.debug('AI工具调用完成：usage', res.usage);
  return res;
}
