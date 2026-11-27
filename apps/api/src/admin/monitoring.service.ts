import type { AdminOnlineUsersResponse } from '@daoyou/contracts/admin/online-users';
import { Inject, Injectable } from '@nestjs/common';
import { PresenceService } from '@server/presence/presence.service.js';

@Injectable()
export class MonitoringService {
  constructor(
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

  async onlineUsers(): Promise<AdminOnlineUsersResponse> {
    return { success: true, data: await this.presence.getSnapshot() };
  }
}
