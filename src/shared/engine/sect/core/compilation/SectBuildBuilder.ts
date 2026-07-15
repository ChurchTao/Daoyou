import type {
  AbilityConfig,
  CombatResourceDefinition,
} from '@shared/engine/battle-v5/core/configs';
import type {
  AbilityPresentationModifier,
  SectAbilityId,
  SectCompiledAbility,
  SectCompiledBuild,
} from '../domain';

/**
 * 宗门编译期唯一的可变对象。
 *
 * 内容插件只能通过这里暴露的操作修改产物，最终快照始终是独立副本，
 * 从而避免节点之间共享并意外改写同一个 AbilityConfig 引用。
 */
export class SectBuildBuilder {
  private defaultAbilityId: SectAbilityId;
  private readonly abilities = new Map<SectAbilityId, SectCompiledAbility>();
  private readonly resources = new Map<string, CombatResourceDefinition>();
  private readonly passives = new Map<string, AbilityConfig>();
  private readonly abilityPresentationModifiers: AbilityPresentationModifier[] = [];
  private readonly extensions = new Map<symbol, unknown>();

  constructor(seed: SectCompiledBuild) {
    this.defaultAbilityId = seed.defaultAbilityId;
    this.replaceAbilities(seed.abilities);
    for (const resource of seed.resources) this.setResource(resource);
    for (const passive of seed.passives) this.addPassive(passive);
    for (const modifier of seed.abilityPresentationModifiers ?? []) {
      this.addAbilityPresentationModifier(modifier);
    }
  }

  static from(seed: SectCompiledBuild): SectBuildBuilder {
    return new SectBuildBuilder(seed);
  }

  setDefaultAbility(abilityId: SectAbilityId): this {
    this.defaultAbilityId = abilityId;
    return this;
  }

  setAbility(abilityId: SectAbilityId, ability: SectCompiledAbility): this {
    this.abilities.set(abilityId, structuredClone(ability));
    return this;
  }

  replaceAbilities(
    abilities: Record<SectAbilityId, SectCompiledAbility>,
  ): this {
    this.abilities.clear();
    for (const [abilityId, ability] of Object.entries(abilities)) {
      this.setAbility(abilityId, ability);
    }
    return this;
  }

  getAbility(abilityId: SectAbilityId): SectCompiledAbility {
    const ability = this.abilities.get(abilityId);
    if (!ability) throw new Error(`宗门神通未注册: ${abilityId}`);
    return structuredClone(ability);
  }

  updateAbility(
    abilityId: SectAbilityId,
    update: (ability: SectCompiledAbility) => SectCompiledAbility,
  ): this {
    return this.setAbility(abilityId, update(this.getAbility(abilityId)));
  }

  setResource(resource: CombatResourceDefinition): this {
    this.resources.set(resource.id, structuredClone(resource));
    return this;
  }

  getResource(resourceId: string): CombatResourceDefinition {
    const resource = this.resources.get(resourceId);
    if (!resource) throw new Error(`宗门战斗资源未注册: ${resourceId}`);
    return structuredClone(resource);
  }

  updateResource(
    resourceId: string,
    update: (resource: CombatResourceDefinition) => CombatResourceDefinition,
  ): this {
    return this.setResource(update(this.getResource(resourceId)));
  }

  clearResources(): this {
    this.resources.clear();
    return this;
  }

  addPassive(passive: AbilityConfig): this {
    if (this.passives.has(passive.slug)) {
      throw new Error(`宗门被动监听器重复注册: ${passive.slug}`);
    }
    this.passives.set(passive.slug, structuredClone(passive));
    return this;
  }

  addAbilityPresentationModifier(
    modifier: AbilityPresentationModifier,
  ): this {
    const key = `${modifier.sourceId}:${modifier.abilityId}`;
    const existing = this.abilityPresentationModifiers.find(
      (candidate) => `${candidate.sourceId}:${candidate.abilityId}` === key,
    );
    if (existing) {
      existing.factRows = Array.from(
        new Set([...existing.factRows, ...modifier.factRows]),
      );
    } else {
      this.abilityPresentationModifiers.push(structuredClone(modifier));
    }
    return this;
  }

  setExtension<T>(key: symbol, value: T): this {
    this.extensions.set(key, value);
    return this;
  }

  requireExtension<T>(key: symbol, label: string): T {
    const value = this.extensions.get(key);
    if (value === undefined) throw new Error(`${label}尚未初始化`);
    return value as T;
  }

  build(): SectCompiledBuild {
    if (!this.abilities.has(this.defaultAbilityId)) {
      throw new Error(`默认攻击未注册: ${this.defaultAbilityId}`);
    }
    return {
      defaultAbilityId: this.defaultAbilityId,
      abilities: Object.fromEntries(
        Array.from(this.abilities, ([id, ability]) => [
          id,
          structuredClone(ability),
        ]),
      ),
      resources: Array.from(this.resources.values(), (resource) =>
        structuredClone(resource),
      ),
      passives: Array.from(this.passives.values(), (passive) =>
        structuredClone(passive),
      ),
      abilityPresentationModifiers: structuredClone(
        this.abilityPresentationModifiers,
      ),
    };
  }
}
