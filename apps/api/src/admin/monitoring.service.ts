import { Injectable } from '@nestjs/common';
import { getOnlineUsersSnapshot } from '@server/realtime/infrastructure/onlinePresenceService.js';

@Injectable()
export class MonitoringService {
  async onlineUsers() {
    return { success: true, data: await getOnlineUsersSnapshot() };
  }
}
