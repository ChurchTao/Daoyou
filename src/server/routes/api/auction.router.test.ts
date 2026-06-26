import { Hono } from 'hono';

const {
  buyItemMock,
  cancelListingMock,
  clearAuctionListingsCacheMock,
  commitPlayerStateMutationMock,
  findActiveListingsMock,
  listItemMock,
} = vi.hoisted(() => ({
  buyItemMock: vi.fn(),
  cancelListingMock: vi.fn(),
  clearAuctionListingsCacheMock: vi.fn(),
  commitPlayerStateMutationMock: vi.fn(),
  findActiveListingsMock: vi.fn(),
  listItemMock: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
        name: '韩立',
        userId: 'user-1',
        realm: '筑基',
      });
      await next();
    },
}));

vi.mock('@server/lib/hono/response', () => ({
  jsonWithStatus: (context: any, body: unknown, status: number) =>
    context.json(body, status),
}));

vi.mock('@server/lib/repositories/auctionRepository', () => ({
  findActiveListings: findActiveListingsMock,
}));

vi.mock('@server/lib/services/AuctionService', () => ({
  AuctionServiceError: class AuctionServiceError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message);
    }
  },
  buyItem: buyItemMock,
  cancelListing: cancelListingMock,
  clearAuctionListingsCache: clearAuctionListingsCacheMock,
  listItem: listItemMock,
}));

vi.mock('@server/lib/services/PlayerStateMutationService', () => ({
  commitPlayerStateMutation: commitPlayerStateMutationMock,
  toPlayerStateMutationResponse: (committed: any) => ({
    success: true,
    data: committed.result,
    state: committed.state,
  }),
}));

import auctionRouter from './auction.router';

function createApp() {
  return new Hono().route('/api/auction', auctionRouter);
}

describe('auction router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findActiveListingsMock.mockResolvedValue({ listings: [], total: 0 });
  });

  it('passes indexed exact filters to the listing repository', async () => {
    const query = new URLSearchParams({
      scope: 'mine',
      itemType: 'material',
      itemCategory: 'herb',
      itemQuality: '玄品',
      itemName: '  赤心芝  ',
      sellerName: '  韩立  ',
      minPrice: '10',
      maxPrice: '200',
      sortBy: 'price_asc',
      page: '2',
      limit: '15',
    });

    const response = await createApp().request(
      `/api/auction/listings?${query.toString()}`,
    );

    expect(response.status).toBe(200);
    expect(findActiveListingsMock).toHaveBeenCalledWith({
      scope: 'mine',
      itemType: 'material',
      itemCategory: 'herb',
      itemQuality: '玄品',
      itemName: '赤心芝',
      sellerName: '韩立',
      minPrice: 10,
      maxPrice: 200,
      sortBy: 'price_asc',
      page: 2,
      limit: 15,
      viewerCultivatorId: 'cultivator-1',
    });
  });

  it('uses all scope by default and returns pagination metadata', async () => {
    findActiveListingsMock.mockResolvedValueOnce({
      listings: [{ id: 'listing-1' }],
      total: 21,
    });

    const response = await createApp().request('/api/auction/listings');

    expect(response.status).toBe(200);
    expect(findActiveListingsMock).toHaveBeenCalledWith({
      scope: 'all',
      viewerCultivatorId: 'cultivator-1',
    });
    await expect(response.json()).resolves.toEqual({
      listings: [{ id: 'listing-1' }],
      pagination: {
        page: 1,
        limit: 20,
        total: 21,
        totalPages: 2,
        hasMore: true,
      },
    });
  });

  it('returns 400 for invalid listing query parameters', async () => {
    const response = await createApp().request(
      '/api/auction/listings?scope=nearby&limit=1000',
    );

    expect(response.status).toBe(400);
    expect(findActiveListingsMock).not.toHaveBeenCalled();
  });
});
