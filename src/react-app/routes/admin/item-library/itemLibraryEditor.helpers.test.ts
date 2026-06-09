import {
  buildItemLibrarySubmitBody,
  createEmptyDraft,
  entryToDraft,
} from './itemLibraryEditor.helpers';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';

describe('item library editor helpers', () => {
  it('builds material payloads from visual draft fields', () => {
    const draft = {
      ...createEmptyDraft(),
      itemId: 'refined_iron',
      name: '精炼玄铁',
      description: '炼器材料。',
      materialType: 'ore' as const,
      materialRank: '玄品' as const,
      materialElement: '金' as const,
    };

    expect(buildItemLibrarySubmitBody(draft)).toEqual({
      itemId: 'refined_iron',
      type: 'material',
      status: 'published',
      payload: {
        name: '精炼玄铁',
        type: 'ore',
        rank: '玄品',
        element: '金',
        description: '炼器材料。',
      },
      editorConfig: {},
    });
  });

  it('builds pill payloads without JSON input', () => {
    const draft = {
      ...createEmptyDraft(),
      itemId: 'healing_pill',
      type: 'consumable' as const,
      name: '回春丹',
      description: '回补气血。',
      consumableKind: 'pill' as const,
      consumableQuality: '真品' as const,
      consumableElement: '木' as const,
      consumableScore: '120',
      pillFamily: 'healing' as const,
      pillQuotaCategory: 'none' as const,
      pillStability: '72',
      pillToxicity: '8',
      pillSourceMaterials: '青木芝、灵露',
      pillOperations: [
        {
          type: 'restore_resource' as const,
          resource: 'hp' as const,
          mode: 'percent' as const,
          value: '20',
        },
        {
          type: 'change_gauge' as const,
          delta: '8',
        },
      ],
    };

    expect(buildItemLibrarySubmitBody(draft)).toMatchObject({
      itemId: 'healing_pill',
      type: 'consumable',
      payload: {
        name: '回春丹',
        type: '丹药',
        quality: '真品',
        score: 120,
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.2,
            },
            {
              type: 'change_gauge',
              gauge: 'pillToxicity',
              delta: 8,
            },
          ],
          alchemyMeta: {
            dominantElement: '木',
            sourceMaterials: ['青木芝', '灵露'],
            stability: 72,
            toxicityRating: 8,
          },
        },
      },
    });
  });

  it('builds talisman payloads without JSON input', () => {
    const draft = {
      ...createEmptyDraft(),
      itemId: 'fate_talisman',
      type: 'consumable' as const,
      name: '天机逆命符',
      consumableKind: 'talisman' as const,
      consumableQuality: '灵品' as const,
      talismanScenario: 'fate_reshape',
      talismanSessionMode: 'consume_on_action' as const,
      talismanNotes: '每次逆命消耗。',
    };

    expect(buildItemLibrarySubmitBody(draft)).toMatchObject({
      itemId: 'fate_talisman',
      type: 'consumable',
      payload: {
        name: '天机逆命符',
        type: '符箓',
        quality: '灵品',
        spec: {
          kind: 'talisman',
          scenario: 'fate_reshape',
          sessionMode: 'consume_on_action',
          notes: '每次逆命消耗。',
        },
      },
    });
  });

  it('fills visual pill draft fields from existing entries', () => {
    const entry: ItemLibraryEntry = {
      id: '11111111-1111-4111-8111-111111111111',
      itemId: 'cultivation_pill',
      type: 'consumable',
      status: 'published',
      name: '养元丹',
      description: '积修养元。',
      quality: '玄品',
      element: '金',
      category: '丹药',
      payload: {
        name: '养元丹',
        type: '丹药',
        quality: '玄品',
        spec: {
          kind: 'pill',
          family: 'cultivation',
          operations: [
            {
              type: 'gain_progress',
              target: 'cultivation_exp',
              value: 48,
            },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'cultivation',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: ['金霞芝'],
            dominantElement: '金',
            stability: 72,
            toxicityRating: 9,
            tags: ['cultivation'],
          },
        },
      },
      editorConfig: {},
      createdBy: '11111111-1111-4111-8111-111111111111',
      updatedBy: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };

    expect(entryToDraft(entry)).toMatchObject({
      consumableKind: 'pill',
      pillFamily: 'cultivation',
      pillQuotaCategory: 'cultivation',
      consumableElement: '金',
      pillSourceMaterials: '金霞芝',
      pillOperations: [
        {
          type: 'gain_progress',
          target: 'cultivation_exp',
          value: '48',
        },
      ],
    });
  });

  it('requires generated artifact preview payload before submit', () => {
    const draft = {
      ...createEmptyDraft(),
      type: 'artifact' as const,
      itemId: 'lihuo_seal',
      name: '离火古印',
      artifactAffixIds: ['artifact-panel-atk'],
      artifactPayload: null,
    };

    expect(() => buildItemLibrarySubmitBody(draft)).toThrow('请先生成法宝预览');
  });
});
