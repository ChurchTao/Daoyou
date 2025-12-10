import { createDeepSeek } from '@ai-sdk/deepseek';
import { generateText, streamText } from 'ai';

function getDeepSeekProvider() {
  return createDeepSeek({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}

/**
 * 通用直接生成Text
 */
export async function text(prompt: string, userInput: string) {
  const provider = getDeepSeekProvider();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const res = await generateText({
    model: provider(model),
    system: prompt,
    prompt: userInput,
  });
  console.debug('通用AI生成Text：totalUsage', res.totalUsage);
  return res;
}

/**
 * 通用Stream生成Text
 */
export function stream_text(prompt: string, userInput: string) {
  const provider = getDeepSeekProvider();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const stream = streamText({
    model: provider(model),
    system: prompt,
    prompt: userInput,
    onFinish: (res) => {
      console.debug('通用AI生成Text Stream：totalUsage', res.totalUsage);
    },
  });
  return stream;
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
