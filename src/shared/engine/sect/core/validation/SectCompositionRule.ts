import type { SectModule } from '../plugin';
import type { ValidationRule } from './ValidationPipeline';

/** 校验序列化定义与对象插件树是否来自同一组合根。 */
export class SectCompositionRule implements ValidationRule<SectModule> {
  validate(module: SectModule): void {
    if (!module.progression || !module.methodGrowth || !module.organization) {
      throw new Error(`宗门 ${module.definition.id} 缺少标准领域策略`);
    }
    const definedPathIds = new Set(
      module.definition.paths.map((path) => path.id),
    );
    for (const path of module.definition.paths) {
      const pathModule = module.paths.get(path.id);
      if (!pathModule) throw new Error(`流派 ${path.id} 未注册运行时模块`);
      if (pathModule.definition !== path) {
        throw new Error(`流派 ${path.id} 定义与运行时模块不一致`);
      }
      const definedNodeIds = new Set(path.nodes.map((node) => node.id));
      for (const nodeId of definedNodeIds) {
        if (!pathModule.nodes.has(nodeId)) {
          throw new Error(`流派 ${path.id} 缺少节点插件 ${nodeId}`);
        }
      }
      for (const nodeId of pathModule.nodes.keys()) {
        if (!definedNodeIds.has(nodeId)) {
          throw new Error(`流派 ${path.id} 注册了孤立节点插件 ${nodeId}`);
        }
      }
      for (const tactic of path.tactics) {
        const strategy = pathModule.createSelectionStrategy(tactic.id);
        if (!strategy || typeof strategy.select !== 'function') {
          throw new Error(`流派 ${path.id} 战术 ${tactic.id} 未实现策略`);
        }
      }
    }
    for (const pathId of module.paths.keys()) {
      if (!definedPathIds.has(pathId)) {
        throw new Error(
          `宗门 ${module.definition.id} 注册了未定义流派 ${pathId}`,
        );
      }
    }
  }
}
