import { describe, expect, it } from 'vitest';
import { EnemyGenerator } from '@shared/engine/enemyGenerator';
import { buildEnemyNarrativeFacts } from './ServerEnemyCopyProvider';

describe('ServerEnemyCopyProvider narrative facts', () => {
  it('does not send fallback names or titles as LLM naming anchors', () => {
    const generator = new EnemyGenerator();
    const draft = generator.buildDraft({
      realm: '金丹',
      realmStage: '中期',
      race: '古兽',
      difficulty: 80,
      variantSeed: 'tower:2026-W22@Asia/Shanghai:金丹:10',
      isBoss: true,
    });

    const facts = buildEnemyNarrativeFacts(draft);
    const serialized = JSON.stringify(facts);

    expect(facts).toMatchObject({
      race: '古兽',
      realm: '金丹',
      realmStage: '中期',
      isBoss: true,
      bodyCultivation: draft.copyFacts.bodyCultivation,
    });
    expect(serialized).not.toContain('fallbackName');
    expect(serialized).not.toContain('fallbackTitle');
    expect(serialized).not.toContain(draft.copyFacts.character.fallbackName);
    expect(serialized).not.toContain(draft.copyFacts.character.fallbackTitle);
    for (const product of draft.copyFacts.products) {
      expect(serialized).not.toContain(product.fallbackName);
    }
  });

  it('keeps manually supplied character copy as locked context only', () => {
    const generator = new EnemyGenerator();
    const draft = generator.buildDraft({
      realm: '金丹',
      realmStage: '初期',
      race: '人族',
      name: '陆沉',
      title: '忘川客',
      difficulty: 45,
    });

    const facts = buildEnemyNarrativeFacts(draft);

    expect(facts.characterRequest.requestedFields).toEqual([
      'background',
      'description',
    ]);
    expect(facts.characterRequest.existingCopy).toMatchObject({
      name: '陆沉',
      title: '忘川客',
    });
  });
});
