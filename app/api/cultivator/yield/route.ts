import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { GeneratedMaterial } from '@/engine/material/creation/types';
import { YieldCalculator } from '@/engine/yield/YieldCalculator';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { redis } from '@/lib/redis';
import {
  getCultivatorById,
  updateCultivationExp,
  updateLastYieldAt,
  updateSpiritStones,
} from '@/lib/repositories/cultivatorRepository';
import { MailService } from '@/lib/services/MailService';
import { RealmType } from '@/types/constants';
import { stream_text } from '@/utils/aiClient';
import { NextResponse } from 'next/server';

/**
 * POST /api/cultivator/yield
 * 领取在外历练收益（灵石+修为+感悟值+材料）
 */
export const POST = withActiveCultivator(
  async (_req, { cultivator: activeCultivator, user }) => {
    const userId = user.id;
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
      // 获取完整角色信息（包含灵根、功法等）
      const fullCultivator = await getCultivatorById(userId, cultivatorId);
      if (!fullCultivator) {
        await redis.del(lockKey);
        return NextResponse.json(
          { success: false, error: '未找到角色信息' },
          { status: 404 },
        );
      }

      // 1. 计算奖励
      const realm = fullCultivator.realm as RealmType;
      const lastYieldAt = fullCultivator.last_yield_at
        ? new Date(fullCultivator.last_yield_at)
        : new Date(Date.now()); // 如果没有上次领取时间，使用当前时间
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

      // 2. 使用 YieldCalculator 计算基础奖励（不包含材料）
      const operations = YieldCalculator.calculateYield(
        realm,
        hoursElapsed,
        fullCultivator,
      );

      // 3. 计算材料数量（但不立即生成）
      const materialCount =
        YieldCalculator.calculateMaterialCount(hoursElapsed);

      // 4. 使用事务发放基础奖励（灵石、修为、感悟值），并更新 last_yield_at
      let success = true;
      let error: string | undefined;

      try {
        await getExecutor().transaction(async (tx) => {
          // 发放基础奖励（不包含材料）
          for (const gain of operations) {
            switch (gain.type) {
              case 'spirit_stones':
                await updateSpiritStones(userId, cultivatorId, gain.value, tx);
                break;

              case 'cultivation_exp':
                await updateCultivationExp(
                  userId,
                  cultivatorId,
                  gain.value,
                  undefined,
                  tx,
                );
                break;

              case 'comprehension_insight':
                // 只修改感悟值，修为变化为0
                await updateCultivationExp(
                  userId,
                  cultivatorId,
                  0,
                  gain.value,
                  tx,
                );
                break;

              default:
                // 跳过材料类型，稍后异步处理
                if (gain.type !== 'material') {
                  throw new Error(`未知的资源类型: ${gain.type}`);
                }
                break;
            }
          }

          // 更新 last_yield_at 时间（在同一个事务中）
          await updateLastYieldAt(userId, cultivatorId, tx);
        });
      } catch (e) {
        success = false;
        error = e instanceof Error ? e.message : String(e);
      }

      if (!success) {
        await redis.del(lockKey);
        return NextResponse.json(
          {
            success: false,
            error: error || '发放奖励失败',
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
        cultivatorName: fullCultivator.name,
        cultivatorRealm: fullCultivator.realm,
        amount: spiritStonesGain,
        expGain,
        insightGain,
        materials: [] as GeneratedMaterial[], // 初始为空，材料稍后通过邮件发送
        hours: hoursElapsed,
        materialCount, // 告诉前端有多少材料正在生成中
      };

      // 6. 异步生成材料并通过邮件发送（不阻塞SSE响应）
      if (materialCount > 0) {
        // 使用 Promise.resolve().then() 实现异步执行，不阻塞主流程
        Promise.resolve().then(async () => {
          try {
            console.log(
              `[Yield] 开始异步生成材料: cultivatorId=${cultivatorId}, count=${materialCount}`,
            );

            // 生成材料
            const materials =
              await MaterialGenerator.generateRandom(materialCount);
            console.log(
              `[Yield] 材料生成完成: ${materials.map((m) => `${m.rank}${m.name}`).join(', ')}`,
            );

            if (materials.length === 0) {
              console.error(
                `[Yield] 材料生成结果为空，跳过空奖励邮件: cultivatorId=${cultivatorId}, expected=${materialCount}`,
              );
              return;
            }

            // 发送邮件通知
            const attachments = materials.map((m) => ({
              type: 'material' as const,
              name: m.name,
              quantity: m.quantity,
              data: m,
            }));

            await MailService.sendMail(
              cultivatorId,
              '历练机缘',
              '道友历练途中，偶得天材地宝，特以此传音玉简送达。',
              attachments,
              'reward',
            );
            console.log(`[Yield] 材料奖励邮件已发送`);
          } catch (err) {
            console.error('[Yield] 材料异步处理失败:', err);
            // 失败不影响主要奖励，仅记录日志
          }
        });
      }

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
                请为一位【${result.cultivatorRealm}】境界的修士【${result.cultivatorName}】生成一段【50-100字】的历练经历。

                收获如下：
                1. 灵石：【${result.amount}】枚。
                ${result.expGain ? `2. 修为精进：【${result.expGain}】点。` : ''}
                ${result.insightGain ? (result.expGain ? '3.' : '2.') + ` 道心感悟：【${result.insightGain}】点。` : ''}

                要求：
                1. 描述修士在历练中遇到的具体事件（如探索遗迹、斩杀妖兽、奇遇等），并巧妙地将获得灵石、修为、感悟值融入故事中。
                2. 必须符合《凡人修仙传》小说世界观，文风古风，有代入感。
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
