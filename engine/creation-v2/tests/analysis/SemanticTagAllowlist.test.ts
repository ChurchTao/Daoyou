import {
  normalizeSemanticTag,
  normalizeSemanticTags,
} from '@/engine/creation-v2/analysis/SemanticTagAllowlist';

describe('SemanticTagAllowlist', () => {
  it('应将别名归一化为 canonical tag', () => {
    expect(normalizeSemanticTag('fire')).toBe('Material.Semantic.Flame');
    expect(normalizeSemanticTag('雷')).toBe('Material.Semantic.Thunder');
    expect(normalizeSemanticTag('material.semantic.guard')).toBe(
      'Material.Semantic.Guard',
    );
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
});