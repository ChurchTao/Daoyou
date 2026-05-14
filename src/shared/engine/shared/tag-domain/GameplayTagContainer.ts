import type { TagPath } from './types';

/**
 * 标签容器：管理单位、技能、Buff 等对象的标签集合。
 */
export class GameplayTagContainer {
  private _tags = new Set<TagPath>();

  public addTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.add(tag));
  }

  public removeTags(tags: TagPath[]): void {
    tags.forEach((tag) => this._tags.delete(tag));
  }

  public hasTag(tag: TagPath): boolean {
    if (this._tags.has(tag)) {
      return true;
    }

    const parentTags = this._getParentTags(tag);
    return parentTags.some((parent) => this._tags.has(parent));
  }

  public hasAnyTag(tags: TagPath[]): boolean {
    return tags.some((tag) => this.hasTag(tag));
  }

  public hasAllTags(tags: TagPath[]): boolean {
    return tags.every((tag) => this.hasTag(tag));
  }

  public getTags(): TagPath[] {
    return Array.from(this._tags);
  }

  public clear(): void {
    this._tags.clear();
  }

  public clone(): GameplayTagContainer {
    const clone = new GameplayTagContainer();
    clone.addTags(this.getTags());
    return clone;
  }

  private _getParentTags(tag: TagPath): TagPath[] {
    const parts = tag.split('.');
    const parents: TagPath[] = [];

    for (let i = 1; i < parts.length; i++) {
      parents.push(parts.slice(0, i).join('.'));
    }

    return parents;
  }
}
