import { type CultivatorSectState } from '../domain';
import type { SectModule } from '../plugin';

/** 持久化水合与运行时入口共用的结构校验器。 */
export class SectStateValidator {
  validate(module: SectModule, state: CultivatorSectState): void {
    if (!state.membershipId?.trim()) throw new Error('宗门成员ID不能为空');
    if (
      state.status !== 'prospect' &&
      state.status !== 'active' &&
      state.status !== 'transferred'
    )
      throw new Error(`宗门成员状态无效: ${String(state.status)}`);
    if (!Number.isInteger(state.contribution) || state.contribution < 0)
      throw new Error('宗门贡献必须为非负整数');
    if (state.configVersion !== module.definition.configVersion) {
      throw new Error(
        `宗门 ${state.sectId} 配置版本不兼容: ${state.configVersion}`,
      );
    }
    if (state.sectId !== module.definition.id) throw new Error('宗门归属不匹配');
  }
}
