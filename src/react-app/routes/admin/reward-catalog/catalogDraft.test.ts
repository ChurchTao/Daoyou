import { parseRewardCatalog } from '@shared/lib/rewardCatalog';
import {
  createEmptyDraftItem,
  createEmptyOperationDraft,
  rewardCatalogDraftToItem,
  rewardCatalogItemToDraft,
} from './catalogDraft';

describe('reward catalog draft helpers', () => {
  it('round-trips a material catalog item', () => {
    const item = parseRewardCatalog([
      {
        id: 'refined_iron',
        type: 'material',
        data: {
          name: '精炼玄铁',
          type: 'ore',
          rank: '玄品',
          element: '金',
          description: '常用于锻造法宝。',
        },
      },
    ])[0]!;

    expect(rewardCatalogDraftToItem(rewardCatalogItemToDraft(item))).toEqual(item);
  });

  it('round-trips a formula pill item with operations', () => {
    const item = parseRewardCatalog([
      {
        id: 'breakthrough_pill',
        type: 'consumable',
        data: {
          name: '破境丹',
          type: '丹药',
          quality: '地品',
          description: '用于辅助突破。',
          prompt: '丹气翻涌，灵台澄明。',
          score: 91,
          spec: {
            kind: 'pill',
            family: 'breakthrough',
            operations: [
              {
                type: 'restore_resource',
                resource: 'mp',
                mode: 'flat',
                value: 180,
              },
              {
                type: 'add_status',
                status: 'clear_mind',
                stacks: 2,
                duration: {
                  kind: 'time',
                  expiresAt: '2026-06-01T12:00:00.000Z',
                },
                payload: {
                  bonus: 10,
                  rare: true,
                },
              },
            ],
            consumeRules: {
              scene: 'out_of_battle_only',
              quotaCategory: 'cultivation',
            },
            alchemyMeta: {
              source: 'formula',
              formulaId: 'breakthrough-pill-v2',
              sourceMaterials: ['寒髓草', '赤云花'],
              dominantElement: '火',
              stability: 82,
              toxicityRating: 14,
              tags: ['突破', '筑基'],
            },
          },
        },
      },
    ])[0]!;

    const draft = rewardCatalogItemToDraft(item);

    expect(draft.type).toBe('consumable');
    expect(draft.spec.kind).toBe('pill');
    if (draft.spec.kind !== 'pill') {
      throw new Error('expected pill draft');
    }

    expect(draft.spec.formulaId).toBe('breakthrough-pill-v2');
    expect(rewardCatalogDraftToItem(draft)).toEqual(item);
  });

  it('rejects invalid artifact effects json', () => {
    const draft = createEmptyDraftItem('artifact');
    draft.id = 'broken_artifact';
    draft.name = '残缺法宝';
    draft.slot = 'weapon';
    draft.element = '雷';
    draft.effectsText = '{';

    expect(() => rewardCatalogDraftToItem(draft)).toThrow(
      '法宝效果 JSON 格式错误',
    );
  });

  it('rejects invalid status payload json', () => {
    const draft = createEmptyDraftItem('consumable');
    draft.id = 'status_pill';
    draft.name = '清心丹';
    draft.consumableType = '丹药';
    draft.spec = {
      ...draft.spec,
      stability: '75',
      toxicityRating: '5',
      operations: [
        {
          ...createEmptyOperationDraft('add_status'),
          payloadText: '{',
        },
      ],
    };

    expect(() => rewardCatalogDraftToItem(draft)).toThrow(
      '状态载荷 JSON 格式错误',
    );
  });
});
