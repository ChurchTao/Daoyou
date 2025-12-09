import { generateCharacter } from '@/utils/aiClient';
import {
  getDivineFortunePrompt,
  getRandomFallbackFortune,
  type DivineFortune,
} from '@/utils/divineFortune';
import { NextResponse } from 'next/server';

/**
 * GET /api/divine-fortune
 * 获取今日天机（使用 AIGC 生成）
 */
export async function GET() {
  try {
    const [systemPrompt, userPrompt] = getDivineFortunePrompt();

    // 调用 AI 生成天机格言
    const aiResponse = await generateCharacter(systemPrompt, userPrompt);

    // 解析 JSON 响应
    let fortune: DivineFortune;
    try {
      fortune = JSON.parse(aiResponse) as DivineFortune;

      // 验证格式
      if (!fortune.fortune || !fortune.hint) {
        throw new Error('Invalid fortune format');
      }
    } catch (parseError) {
      console.warn('Failed to parse AI response, using fallback:', parseError);
      fortune = getRandomFallbackFortune();
    }

    return NextResponse.json({
      success: true,
      data: fortune,
    });
  } catch (error) {
    console.error('天机推演 API 错误:', error);

    // 降级策略：返回备用格言
    const fallbackFortune = getRandomFallbackFortune();

    return NextResponse.json({
      success: true,
      data: fallbackFortune,
      fallback: true, // 标记为备用方案
    });
  }
}
