import { HttpException, Injectable } from '@nestjs/common';
import {
  getAuthPageAnnouncement,
  getResolvedCommunityQqGroupNumber,
} from '@server/lib/repositories/appSettingsRepository.js';

@Injectable()
export class CommunityService {
  async qqGroup() {
    let groupNumber: string;
    try {
      groupNumber = await getResolvedCommunityQqGroupNumber();
    } catch {
      throw new HttpException(
        { success: false, error: 'QQ 群配置暂不可用，请稍后重试' },
        503,
      );
    }
    return {
      success: true,
      groupNumber,
      joinHint: '请复制群号后前往 QQ 搜索并申请加群',
    };
  }

  async announcement() {
    let announcement: string | null;
    try {
      announcement = await getAuthPageAnnouncement();
    } catch {
      throw new HttpException(
        { success: false, error: '公告配置暂不可用，请稍后重试' },
        503,
      );
    }
    return { success: true, announcement };
  }
}
