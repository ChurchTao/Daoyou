import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { GeneratedMaterial } from '@/engine/material/creation/types';
import { resourceEngine } from '@/engine/resource/ResourceEngine';
import { YieldCalculator } from '@/engine/yield/YieldCalculator';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { redis } from '@/lib/redis';
import { updateLastYieldAt } from '@/lib/repositories/cultivatorRepository';
import { RealmType } from '@/types/constants';
import { stream_text } from '@/utils/aiClient';
import { NextResponse } from 'next/server';

/**
 * POST /api/cultivator/yield
 * 领取在外历练收益（灵石+修为+感悟值+材料）
 */
export const POST = withActiveCultivator(
  async (_req, { cultivator: activeCultivator }) => {
    const userId = activeCultivator.userId;
    const cultivatorId = activeCultivator.id;

    // Prevent concurrent claims with Redis lock
    const lockKey = `yield:lock:${cultivatorId}`;
    const acquired = await redis.set(lockKey, 'locked', { nx: true, ex: 100 }); // 10s lock

    if (!acquired) {
      return NextResponse.json(
        { success: false, error: '道友请勿心急，机缘正在结算中...' },
        { status: 429 },
      );
    }

    try {
      // 1. 计算奖励
      const realm = activeCultivator.realm as RealmType;
      const lastYieldAt = activeCultivator.last_yield_at
        ? new Date(activeCultivator.last_yield_at)
        : new Date(activeCultivator.createdAt || Date.now());
      const now = new Date();
      const diffMs = now.getTime() - lastYieldAt.getTime();
      const hoursElapsed = Math.min(diffMs / (1000 * 60 * 60), 24); // Cap at 24 hours

      if (hoursElapsed < 1) {
        await redis.del(lockKey);
        return NextResponse.json(
          { success: false, error: '历练时日尚短（不足一小时），难有机缘。' },
          { status: 400 },
        );
      }

      // 2. 使用 YieldCalculator 计算奖励
      const operations = YieldCalculator.calculateYield(realm, hoursElapsed);

      // 3. 生成材料
      const materialCount =
        YieldCalculator.calculateMaterialCount(hoursElapsed);
      let gainedMaterials: GeneratedMaterial[] = [];

      if (materialCount > 0) {
        gainedMaterials = await MaterialGenerator.generateRandom(materialCount);

        for (const m of gainedMaterials) {
          operations.push({
            type: 'material',
            value: m.quantity,
            name: m.name,
            data: m,
          });
        }
      }

      // 4. 使用 ResourceEngine 发放奖励，并在 action 中更新 last_yield_at
      const resourceResult = await resourceEngine.gain(
        userId,
        cultivatorId,
        operations,
        async () => {
          // action: 更新 last_yield_at 时间
          await updateLastYieldAt(userId, cultivatorId);
        },
        false, // 非干运行
      );

      if (!resourceResult.success) {
        await redis.del(lockKey);
        return NextResponse.json(
          {
            success: false,
            error: resourceResult.errors?.join(', ') || '发放奖励失败',
          },
          { status: 500 },
        );
      }

      // 5. 计算结果（用于前端显示和AI提示词）
      const spiritStonesGain =
        operations.find((op) => op.type === 'spirit_stones')?.value || 0;
      const expGain =
        operations.find((op) => op.type === 'cultivation_exp')?.value || 0;
      const insightGain =
        operations.find((op) => op.type === 'comprehension_insight')?.value ||
        0;

      const result = {
        cultivatorName: activeCultivator.name,
        cultivatorRealm: activeCultivator.realm,
        amount: spiritStonesGain,
        expGain,
        insightGain,
        materials: gainedMaterials,
        hours: hoursElapsed,
      };

      // 6. 生成 SSE 流式响应
      const encoder = new TextEncoder();
      const customStream = new ReadableStream({
        async start(controller) {
          try {
            // First send the calculation result
            const initialData = JSON.stringify({
              type: 'result',
              data: result,
            });
            controller.enqueue(encoder.encode(`data: ${initialData}\n\n`));

            const systemPrompt =
              '你是一个修仙世界的记录者，负责记录修士外出历练的经历。';
            const userPrompt = `
                请为一位【${result.cultivatorRealm}】境界的修士【${result.cultivatorName}】生成一段【100-200字】的历练经历。
                修士在历练中花费了【${result.hours.toFixed(1)}】小时。

                收获如下：
                1. 灵石：【${result.amount}】枚。
                ${result.expGain ? `2. 修为精进：【${result.expGain}】点。` : ''}
                ${result.insightGain ? (result.expGain ? '3.' : '2.') + ` 天道感悟：【${result.insightGain}】点。` : ''}
                ${result.materials?.length ? (result.expGain || result.insightGain ? '4.' : '2.') + ` 获得材料：${result.materials.map((m) => `【${m.rank}】${m.name}`).join('、')}` : ''}

                要求：
                1. 描述修士在历练中遇到的具体事件（如探索遗迹、斩杀妖兽、奇遇等），并巧妙地将获得灵石、修为、感悟值和材料的过程融入故事中。
                2. 必须符合修仙世界观，文风古风，有代入感。
                3. 若获得了稀有材料（玄品以上）或功法典籍，请着重描写其获取的不易或机缘巧合。
                4. 若获得了感悟值，请描述为修士在历练中参悟天地法则、突破瓶颈的过程。
              `;

            // Stream AI generation
            const aiStreamResult = stream_text(systemPrompt, userPrompt, true);
            for await (const chunk of aiStreamResult.textStream) {
              const msg = JSON.stringify({ type: 'chunk', text: chunk });
              controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
            }
          } catch (e) {
            console.error('Stream processing error:', e);
            const errorMsg = JSON.stringify({
              type: 'error',
              error: '天机推演中断...',
            });
            controller.enqueue(encoder.encode(`data: ${errorMsg}\n\n`));
          } finally {
            controller.close();
            // Release lock when stream ends
            await redis.del(lockKey);
          }
        },
      });

      return new NextResponse(customStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (e) {
      // If error happens before stream creation, release lock here
      await redis.del(lockKey);
      throw e;
    }
  },
);
