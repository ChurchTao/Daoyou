import { allBuffTemplates } from '@/config/buffTemplates';
import { buffTemplateRegistry } from './BuffTemplateRegistry';
import type { BuffConfig } from './types';
import { BuffTag } from './types';

/**
 * Buff 配置注册表
 * 集中管理所有 Buff 配置
 */
class BuffRegistry {
  private configs: Map<string, BuffConfig> = new Map();

  /**
   * 注册 Buff 配置
   */
  register(config: BuffConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * 批量注册
   */
  registerAll(configs: BuffConfig[]): void {
    for (const config of configs) {
      this.register(config);
    }
  }

  /**
   * 获取配置
   */
  get(id: string): BuffConfig | undefined {
    return this.configs.get(id);
  }

  /**
   * 检查是否存在
   */
  has(id: string): boolean {
    return this.configs.has(id);
  }

  /**
   * 获取所有配置
   */
  getAll(): BuffConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * 按标签筛选
   */
  getByTag(tag: BuffTag): BuffConfig[] {
    return this.getAll().filter((c) => c.tags?.includes(tag));
  }
}

// 创建全局单例
export const buffRegistry = new BuffRegistry();

/**
 * 初始化 Buff 系统
 * 同时初始化模板注册表和配置注册表
 */
export function initializeBuffRegistry(): void {
  // 先初始化模板注册表
  buffTemplateRegistry.registerAll(allBuffTemplates);
}

// 自动初始化
initializeBuffRegistry();
