import { HttpException, Injectable } from '@nestjs/common';
import {
  createAltchaChallenge,
  isAltchaAction,
  isAltchaServerEnabled,
} from '@server/lib/auth/altcha.js';

@Injectable()
export class CaptchaService {
  config() {
    return { enabled: isAltchaServerEnabled() };
  }

  async challenge(action: string) {
    if (!isAltchaAction(action)) {
      throw new HttpException(
        { success: false, error: '无效的人机验证场景' },
        400,
      );
    }
    if (!isAltchaServerEnabled()) {
      throw new HttpException(
        { success: false, error: '人机验证服务未配置' },
        503,
      );
    }
    try {
      return await createAltchaChallenge(action);
    } catch (error) {
      console.error('[altcha] challenge creation failed', error);
      throw new HttpException(
        { success: false, error: '人机验证服务暂不可用' },
        503,
      );
    }
  }
}
