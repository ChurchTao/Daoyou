import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, Output, streamText, ToolSet } from 'ai';
import z from 'zod';

const DISABLE_MARKDOWN_SYSTEM_INJECTION = `
你必须只输出一个合法的 JSON 对象（Content-Type: application/json）。
不要输出任何 Markdown（包括 \`\`\`）、不要输出解释、不要输出多余文字。
输出必须能被 JSON.parse 直接解析。`;
const DISABLE_MARKDOWN_USER_INJECTION = `再次强调：禁止输出 Markdown、解释文本或多余字段。只输出 JSON。`;

const injectSystem = (system: string) =>
  `${system}${DISABLE_MARKDOWN_SYSTEM_INJECTION}`;
const injectUser = (user: string) =>
  `${user}${DISABLE_MARKDOWN_USER_INJECTION}`;

/**
 * 获取 DeepSeek Provider
 * @returns DeepSeek Provider
 */
function getDeepSeekProvider() {
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
  return createDeepSeek({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * 获取 DeepSeek Model
 * @returns DeepSeek Model
 */
export function getModel(fast: boolean = false) {
  const provider = getDeepSeekProvider();
  if (process.env.PROVIDER_CHOOSE === 'ark') {
    const model = fast
      ? process.env.ARK_MODEL_FAST_USE
      : process.env.ARK_MODEL_USE;
    return provider(model!);
  }
  if (process.env.PROVIDER_CHOOSE === 'kimi') {
    const model = fast
      ? process.env.KIMI_MODEL_FAST_USE
      : process.env.KIMI_MODEL_USE;
    return provider(model!);
  } else {
    const model = fast ? process.env.FAST_MODEL : process.env.OPENAI_MODEL;
    return provider(model!);
  }
}

/**
 * 通用直接生成Text
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
      deepseek: {
        thinking: {
          type: 'disabled',
        },
      },
    },
  });
  console.debug('通用AI生成Text：totalUsage', res.totalUsage);
  return res;
}

/**
 * 通用Stream生成Text
 */
export function stream_text(
  prompt: string,
  userInput: string,
  fast: boolean = false,
  thinking: boolean = false,
) {
  const model = getModel(fast);
  const stream = streamText({
    model,
    system: prompt,
    prompt: userInput,
    onFinish: (res) => {
      console.debug('通用AI生成Text Stream：totalUsage', res.totalUsage);
    },
    providerOptions: {
      deepseek: {
        thinking: {
          type: thinking ? 'auto' : 'disabled',
        },
      },
    },
  });
  return stream;
}

/**
 * 通用生成 Structured Data
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
  const model = getModel(fast);
  const res = await generateText({
    model,
    system: injectSystem(prompt),
    prompt: injectUser(userInput),
    output: Output.object({
      schema: options.schema,
      name: options.schemaName,
      description: options.schemaDescription,
    }),
    maxRetries: 3,
    providerOptions: {
      deepseek: {
        thinking: {
          type: thinking ? 'auto' : 'disabled',
        },
      },
    },
  });
  return {
    ...res,
    object: res.output,
  };
}

/**
 * 通用生成 Structured Data Array
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
  const model = getModel(fast);
  const res = await generateText({
    model,
    system: injectSystem(prompt),
    prompt: injectUser(userInput),
    output: Output.array({
      element: options.schema,
      name: options.schemaName,
      description: options.schemaDescription,
    }),
    maxRetries: 3,
    providerOptions: {
      deepseek: {
        thinking: {
          type: thinking ? 'auto' : 'disabled',
        },
      },
    },
  });
  return {
    ...res,
    object: res.output,
  };
}

/**
 * tool 生成器
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
      deepseek: {
        thinking: {
          type: thinking ? 'auto' : 'disabled',
        },
      },
    },
  });
  console.debug('AI生成Text by tool：totalUsage', res.totalUsage);
  return res;
}
