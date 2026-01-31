/**
 * Buff 模板注册表
 *
 * 管理所有 Buff 模板，支持动态 Buff 系统
 * 与 BuffRegistry 配合使用，提供向后兼容
 */

import { allBuffTemplates } from '@/config/buffTemplates';
import { BuffMaterializer } from './BuffMaterializer';
import type {
  BuffConfig,
  BuffMaterializationContext,
  BuffParamsOverride,
  BuffTag,
  BuffTemplate,
} from './types';

/**
 * Buff 模板注册表
 */
class BuffTemplateRegistry {
  private templates: Map<string, BuffTemplate> = new Map();

  /**
   * 注册 Buff 模板
   */
  register(template: BuffTemplate): void {
    this.templates.set(template.id, template);
  }

  /**
   * 批量注册
   */
  registerAll(templates: BuffTemplate[]): void {
    for (const template of templates) {
      this.register(template);
    }
  }

  /**
   * 获取模板
   */
  get(id: string): BuffTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 检查是否存在
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * 获取所有模板
   */
  getAll(): BuffTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 按标签筛选
   */
  getByTag(tag: BuffTag): BuffTemplate[] {
    return this.getAll().filter((t) => t.tags?.includes(tag));
  }

  /**
   * 获取数值化后的 BuffConfig
   * 使用默认上下文进行数值化
   */
  getDefaultConfig(id: string): BuffConfig | undefined {
    const template = this.get(id);
    if (!template) return undefined;
    return BuffMaterializer.materialize(template, {});
  }

  /**
   * 获取数值化后的 BuffConfig
   * 使用指定上下文和参数覆盖
   */
  getMaterializedConfig(
    id: string,
    context: BuffMaterializationContext,
    paramsOverride?: BuffParamsOverride,
  ): BuffConfig | undefined {
    const template = this.get(id);
    if (!template) return undefined;
    return BuffMaterializer.materialize(template, context, paramsOverride);
  }
}

// 创建全局单例
export const buffTemplateRegistry = new BuffTemplateRegistry();

// 先初始化模板注册表
buffTemplateRegistry.registerAll(allBuffTemplates);
