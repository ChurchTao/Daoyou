import { HttpException, Injectable } from '@nestjs/common';
import { deleteCultivatorCommand } from '@server/cultivator/application/CultivatorProfileApplicationService.js';
import { getLastDeadCultivatorSummary } from '@server/cultivator/application/readers/CultivatorProfileRepository.js';
@Injectable()
export class LifecycleService {
  async delete(userId: string, cultivatorId: string | undefined) {
    if (!cultivatorId) throw new HttpException({ error: '请提供角色ID' }, 400);
    const success = await deleteCultivatorCommand({ userId, cultivatorId });
    if (!success)
      throw new HttpException({ error: '删除角色失败或角色不存在' }, 404);
    return { success: true, message: '角色删除成功' };
  }
  async reincarnateContext(userId: string) {
    const summary = await getLastDeadCultivatorSummary(userId);
    return { success: true, data: summary ?? null };
  }
}
