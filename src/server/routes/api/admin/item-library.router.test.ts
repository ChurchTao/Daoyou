import { Hono } from 'hono';

const {
  archiveItemLibraryEntryMock,
  createItemLibraryEntryMock,
  listItemLibraryMock,
  updateItemLibraryEntryMock,
} = vi.hoisted(() => ({
  archiveItemLibraryEntryMock: vi.fn(),
  createItemLibraryEntryMock: vi.fn(),
  listItemLibraryMock: vi.fn(),
  updateItemLibraryEntryMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireAdmin: () => async (context: any, next: () => Promise<void>) => {
    context.set('user', {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
    });
    await next();
  },
}));

vi.mock('@server/lib/repositories/itemLibraryRepository', () => ({
  archiveItemLibraryEntry: archiveItemLibraryEntryMock,
  createItemLibraryEntry: createItemLibraryEntryMock,
  findItemLibraryById: vi.fn(),
  listItemLibrary: listItemLibraryMock,
  updateItemLibraryEntry: updateItemLibraryEntryMock,
}));

import itemLibraryRouter from './item-library.router';

function createApp() {
  return new Hono().route('/api/admin/item-library', itemLibraryRouter);
}

describe('admin item library router', () => {
  const materialItem = {
    id: '22222222-2222-4222-8222-222222222222',
    itemId: 'refined_iron',
    type: 'material' as const,
    status: 'published' as const,
    name: '精炼玄铁',
    description: null,
    quality: '玄品',
    element: '金',
    category: 'ore',
    payload: {
      name: '精炼玄铁',
      type: 'ore' as const,
      rank: '玄品' as const,
      element: '金' as const,
    },
    editorConfig: {},
    createdBy: '11111111-1111-4111-8111-111111111111',
    updatedBy: '11111111-1111-4111-8111-111111111111',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists item library entries with filters', async () => {
    listItemLibraryMock.mockResolvedValueOnce([materialItem]);

    const response = await createApp().request(
      '/api/admin/item-library?status=published&type=material&q=iron',
    );

    expect(response.status).toBe(200);
    expect(listItemLibraryMock).toHaveBeenCalledWith({
      status: 'published',
      type: 'material',
      q: 'iron',
    });
    await expect(response.json()).resolves.toEqual({
      items: [materialItem],
    });
  });

  it('creates material entries', async () => {
    createItemLibraryEntryMock.mockResolvedValueOnce(materialItem);

    const response = await createApp().request('/api/admin/item-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId: 'refined_iron',
        type: 'material',
        status: 'published',
        payload: {
          name: '精炼玄铁',
          type: 'ore',
          rank: '玄品',
          element: '金',
        },
        editorConfig: {},
      }),
    });

    expect(response.status).toBe(200);
    expect(createItemLibraryEntryMock).toHaveBeenCalledWith({
      entry: expect.objectContaining({
        itemId: 'refined_iron',
        type: 'material',
      }),
      userId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('archives item entries', async () => {
    archiveItemLibraryEntryMock.mockResolvedValueOnce({
      ...materialItem,
      status: 'archived',
    });

    const response = await createApp().request(
      '/api/admin/item-library/22222222-2222-4222-8222-222222222222/archive',
      { method: 'POST' },
    );

    expect(response.status).toBe(200);
    expect(archiveItemLibraryEntryMock).toHaveBeenCalledWith({
      id: '22222222-2222-4222-8222-222222222222',
      userId: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('returns artifact previews and rejects unknown affixes', async () => {
    const ok = await createApp().request(
      '/api/admin/item-library/artifact/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '离火古印',
          slot: 'accessory',
          element: '火',
          quality: '真品',
          realm: '筑基',
          realmStage: '后期',
          affixIds: ['artifact-panel-atk'],
        }),
      },
    );
    expect(ok.status).toBe(200);
    const okPayload = (await ok.json()) as { payload?: { productModel?: unknown } };
    expect(okPayload.payload?.productModel).toBeTruthy();
    expect(okPayload.payload).toMatchObject({ quality: '真品' });

    const bad = await createApp().request(
      '/api/admin/item-library/artifact/preview',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '离火古印',
          slot: 'accessory',
          element: '火',
          affixIds: ['missing-affix'],
        }),
      },
    );
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toEqual({
      error: '未知词缀：missing-affix',
    });
  });
});
