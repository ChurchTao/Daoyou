import {
  buildItemLibrarySubmitBody,
  createEmptyDraft,
  entryToDraft,
  resetPillOperationsForFamily,
} from './itemLibraryEditor.helpers';
import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { CULTIVATION_BOOST_STATUS_KEY } from '@shared/lib/cultivationBoost';
import {
  BREAKTHROUGH_FOCUS_STATUS_KEY,
  CLEAR_MIND_STATUS_KEY,
  PROTECT_MERIDIANS_STATUS_KEY,
} from '@shared/lib/pillEffectScaling';

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
            appearance: 'middle',
          },
        },
      },
    });
  });

  it('builds new cultivation pills as retreat boost status by default', () => {
    const draft = resetPillOperationsForFamily(
      {
        ...createEmptyDraft(),
        itemId: 'cultivation_boost_pill',
        type: 'consumable',
        name: '养元丹',
        consumableKind: 'pill',
        pillQuotaCategory: 'cultivation',
      },
      'cultivation',
    );

    expect(buildItemLibrarySubmitBody(draft)).toMatchObject({
      type: 'consumable',
      payload: {
        spec: {
          family: 'cultivation',
          operations: [
            {
              type: 'add_status',
              status: CULTIVATION_BOOST_STATUS_KEY,
              usesRemaining: 1,
              duration: { kind: 'until_removed' },
              payload: {
                boostPercent: 0.5,
                retreatExpMultiplier: 1.5,
              },
            },
          ],
          alchemyMeta: {
            appearance: 'middle',
          },
        },
      },
    });
  });

  it('round-trips dedicated pill status payload fields', () => {
    const entry: ItemLibraryEntry = {
      id: '11111111-1111-4111-8111-111111111111',
      itemId: 'breakthrough_pill',
      type: 'consumable',
      status: 'published',
      name: '破境丹组',
      description: '',
      payload: {
        name: '破境丹组',
        type: '丹药',
        quality: '天品',
        spec: {
          kind: 'pill',
          family: 'breakthrough',
          operations: [
            {
              type: 'add_status',
              status: BREAKTHROUGH_FOCUS_STATUS_KEY,
              usesRemaining: 1,
              payload: { breakthroughChanceBonus: 0.08 },
            },
            {
              type: 'add_status',
              status: PROTECT_MERIDIANS_STATUS_KEY,
              usesRemaining: 1,
              payload: { failureExpLossReductionPercent: 0.45 },
            },
            {
              type: 'add_status',
              status: CLEAR_MIND_STATUS_KEY,
              usesRemaining: 2,
            },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: [],
            stability: 80,
            toxicityRating: 5,
            appearance: 'high',
            tags: ['breakthrough'],
          },
        },
      },
      editorConfig: {},
      createdBy: '11111111-1111-4111-8111-111111111111',
      updatedBy: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-06-01T00:00:00.000Z',
      updatedAt: '2026-06-01T00:00:00.000Z',
    };

    const draft = entryToDraft(entry);
    expect(draft).toMatchObject({
      pillAppearance: 'high',
      pillOperations: [
        {
          status: BREAKTHROUGH_FOCUS_STATUS_KEY,
          breakthroughChanceBonus: '8',
        },
        {
          status: PROTECT_MERIDIANS_STATUS_KEY,
          failureExpLossReductionPercent: '45',
        },
        {
          status: CLEAR_MIND_STATUS_KEY,
          usesRemaining: '2',
        },
      ],
    });

    expect(buildItemLibrarySubmitBody(draft)).toMatchObject({
      payload: {
        spec: {
          operations: [
            {
              payload: { breakthroughChanceBonus: 0.08 },
            },
            {
              payload: { failureExpLossReductionPercent: 0.45 },
            },
            {
              usesRemaining: 2,
              payload: { preventsInnerDemon: true },
            },
          ],
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
      pillAppearance: '',
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

    expect(buildItemLibrarySubmitBody(entryToDraft(entry))).toMatchObject({
      payload: {
        spec: {
          operations: [
            {
              type: 'gain_progress',
              target: 'cultivation_exp',
              value: 48,
            },
          ],
          alchemyMeta: expect.not.objectContaining({
            appearance: expect.anything(),
          }),
        },
      },
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

  it('keeps artifact quality in editor config when submitting', () => {
    const draft = {
      ...createEmptyDraft(),
      type: 'artifact' as const,
      itemId: 'lihuo_seal',
      name: '离火古印',
      artifactSlot: 'accessory' as const,
      artifactElement: '火' as const,
      artifactQuality: '天品' as const,
      artifactAffixIds: ['artifact-panel-atk'],
      artifactPayload: {
        name: '离火古印',
        slot: 'accessory' as const,
        element: '火' as const,
        quality: '天品' as const,
        productModel: {
          productType: 'artifact',
          projectionQuality: '天品',
        },
      },
    };

    expect(buildItemLibrarySubmitBody(draft)).toMatchObject({
      type: 'artifact',
      editorConfig: {
        slot: 'accessory',
        element: '火',
        quality: '天品',
        affixIds: ['artifact-panel-atk'],
      },
    });
  });
});
