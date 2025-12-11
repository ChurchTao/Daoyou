import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateObject, generateText, streamText, ToolSet } from 'ai';
import z from 'zod';

/**
 * 获取 DeepSeek Provider
 * @returns DeepSeek Provider
 */
function getDeepSeekProvider() {
  return createDeepSeek({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * 获取 DeepSeek Model
 * @returns DeepSeek Model
 */
function getModel(fast: boolean = false) {
  const provider = getDeepSeekProvider();
  const model = fast ? process.env.FAST_MODEL : process.env.OPENAI_MODEL;
  return provider(model || 'Qwen/Qwen3-8B');
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
) {
  const model = getModel(fast);
  const stream = streamText({
    model,
    system: prompt,
    prompt: userInput,
    onFinish: (res) => {
      console.debug('通用AI生成Text Stream：totalUsage', res.totalUsage);
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
) {
  const model = getModel(fast);
  const res = await generateObject({
    model,
    system: prompt,
    prompt: userInput,
    schema: options.schema,
    schemaName: options.schemaName,
    schemaDescription: options.schemaDescription,
  });
  return res;
}

/**
 * tool 生成器
 */
export async function tool(prompt: string, userInput: string, tools: ToolSet) {
  const model = getModel();
  const res = await generateText({
    model,
    system: prompt,
    prompt: userInput,
    tools,
  });
  console.debug('AI生成Text by tool：totalUsage', res.totalUsage);
  return res;
}

/**
 * 解析 AI 返回的 JSON（处理可能的格式问题）
 * @param jsonString AI 返回的 JSON 字符串
 * @returns 解析后的对象
 */
export function parseAIResponse(jsonString: string): Record<string, unknown> {
  try {
    // 尝试直接解析
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    // 如果失败，尝试提取 JSON 部分（AI 可能返回了额外的文字）
    const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      } catch (e) {
        console.error('提取 JSON 后仍无法解析:', e);
        throw new Error('无法解析 AI 返回的 JSON 格式');
      }
    }
    throw new Error('无法解析 AI 响应：未找到有效的 JSON 内容');
  }
}
