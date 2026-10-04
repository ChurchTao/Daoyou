import { Injectable } from '@nestjs/common';
import { getLlmMetricsSnapshot } from '@server/lib/llm/metricsStore.js';
import { getOnlineUsersSnapshot } from '@server/realtime/infrastructure/onlinePresenceService.js';

@Injectable()
export class MonitoringService {
  async llmMetrics(query: Record<string, string | undefined>) {
    const limit = Number.parseInt(query.limit ?? '300', 10);
    const sceneId = query.sceneId?.trim() || undefined;
    return {
      success: true,
      data: await getLlmMetricsSnapshot({
        limit: Number.isFinite(limit) ? limit : 300,
        sceneId,
      }),
    };
  }

  async onlineUsers() {
    return { success: true, data: await getOnlineUsersSnapshot() };
  }
}
