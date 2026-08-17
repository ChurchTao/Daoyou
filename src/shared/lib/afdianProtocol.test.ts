import { describe, expect, it } from 'vitest';
import {
  buildAfdianCheckoutUrl,
  buildAfdianWebhookSignedText,
  createAfdianApiEnvelope,
} from './afdianProtocol';

describe('Afdian official protocol', () => {
  it('matches the official API signing example', () => {
    expect(
      createAfdianApiEnvelope({
        userId: 'abc',
        token: '123',
        params: { a: 333 },
        timestampSeconds: 1_624_339_905,
      }),
    ).toEqual({
      user_id: 'abc',
      params: '{"a":333}',
      ts: 1_624_339_905,
      sign: 'a4acc28b81598b7e5d84ebdc3e91710c',
    });
  });

  it('uses the documented webhook field order', () => {
    expect(
      buildAfdianWebhookSignedText({
        outTradeNo: 'ORDER',
        userId: 'USER',
        planId: 'PLAN',
        totalAmount: '38.00',
      }),
    ).toBe('ORDERUSERPLAN38.00');
  });

  it('builds a fixed-plan checkout bound to the intent', () => {
    const url = buildAfdianCheckoutUrl({
      intentId: 'intent-id',
      planId: 'plan-id',
    });
    expect(url.origin + url.pathname).toBe('https://afdian.com/order/create');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      product_type: '0',
      custom_order_id: 'intent-id',
      plan_id: 'plan-id',
    });
  });

  it('formats custom amounts as CNY with two decimals', () => {
    const url = buildAfdianCheckoutUrl({
      intentId: 'intent-id',
      planId: null,
      customAmountFen: 3_801,
      creatorUserId: 'creator-id',
    });
    expect(url.searchParams.get('custom_price')).toBe('38.01');
    expect(url.searchParams.get('user_id')).toBe('creator-id');
  });
});
