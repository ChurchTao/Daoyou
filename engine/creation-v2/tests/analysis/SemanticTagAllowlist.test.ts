import { GameplayTags } from "@/engine/battle-v5/core/GameplayTags";
import {
  extractSemanticTagsFromText,
  getCreationSemanticTagAllowlist,
  normalizeSemanticTag,
  normalizeSemanticTags,
} from '@/engine/creation-v2/analysis/SemanticTagAllowlist';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';

describe('SemanticTagAllowlist', () => {
  it('应将别名归一化为 canonical tag', () => {
    expect(normalizeSemanticTag('fire')).toBe('Material.Semantic.Flame');
    expect(normalizeSemanticTag('雷')).toBe('Material.Semantic.Thunder');
    expect(normalizeSemanticTag('material.semantic.guard')).toBe(
      'Material.Semantic.Guard',
    );
    expect(normalizeSemanticTag('poison')).toBe('Material.Semantic.Poison');
    expect(normalizeSemanticTag('圣')).toBe('Material.Semantic.Divine');
    expect(normalizeSemanticTag('spatial')).toBe('Material.Semantic.Space');
    expect(normalizeSemanticTag('vitality')).toBe('Material.Semantic.Life');
  });

  it('白名单应与 GameplayTags 的 20 个语义标签一致', () => {
    expect(getCreationSemanticTagAllowlist()).toEqual([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      CreationTags.MATERIAL.SEMANTIC_METAL,
      CreationTags.MATERIAL.SEMANTIC_WATER,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_POISON,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_CHAOS,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
      CreationTags.MATERIAL.SEMANTIC_TIME,
      CreationTags.MATERIAL.SEMANTIC_LIFE,
    ]);
  });

  it('应丢弃未知标签和自由文本', () => {
    const result = normalizeSemanticTags([
      'Material.Semantic.Flame',
      'DROP TABLE users;',
      '{"tag":"Material.Semantic.Flame"}',
      'new.custom.tag',
    ]);

    expect(result.tags).toEqual(['Material.Semantic.Flame']);
    expect(result.droppedTags).toContain('DROP TABLE users;');
    expect(result.droppedTags).toContain('{"tag":"Material.Semantic.Flame"}');
    expect(result.droppedTags).toContain('new.custom.tag');
  });

  it('应去重并限制最大标签数', () => {
    const result = normalizeSemanticTags([
      'fire',
      'Material.Semantic.Flame',
      'ice',
      'thunder',
      'wind',
      'blade',
    ]);

    expect(result.tags).toEqual([
      'Material.Semantic.Flame',
      'Material.Semantic.Freeze',
      'Material.Semantic.Thunder',
      'Material.Semantic.Wind',
    ]);
    expect(result.droppedTags).toContain('Material.Semantic.Flame');
    expect(result.droppedTags).toContain('blade');
  });

  it('应基于共享文本规则提取语义标签', () => {
    const tags = extractSemanticTagsFromText('毒 圣 空 时 木 土');
    expect(tags).toEqual([
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_POISON,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
      CreationTags.MATERIAL.SEMANTIC_TIME,
    ]);
  });
});