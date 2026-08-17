import { createHash } from 'node:crypto';

export type AfdianApiEnvelope = {
  user_id: string;
  params: string;
  ts: number;
  sign: string;
};

export function buildAfdianWebhookSignedText(order: {
  outTradeNo: string;
  userId: string;
  planId: string;
  totalAmount: string;
}): string {
  return `${order.outTradeNo}${order.userId}${order.planId}${order.totalAmount}`;
}

export function createAfdianApiEnvelope(input: {
  userId: string;
  token: string;
  params: Record<string, unknown>;
  timestampSeconds: number;
}): AfdianApiEnvelope {
  const params = JSON.stringify(input.params);
  const signSource = `${input.token}params${params}ts${input.timestampSeconds}user_id${input.userId}`;
  return {
    user_id: input.userId,
    params,
    ts: input.timestampSeconds,
    sign: createHash('md5').update(signSource).digest('hex'),
  };
}

export function buildAfdianCheckoutUrl(input: {
  intentId: string;
  planId: string | null;
  customAmountFen?: number;
  creatorUserId?: string;
}): URL {
  const url = new URL('https://afdian.com/order/create');
  url.searchParams.set('product_type', '0');
  url.searchParams.set('custom_order_id', input.intentId);
  if (input.planId) {
    url.searchParams.set('plan_id', input.planId);
    return url;
  }
  if (input.customAmountFen && input.creatorUserId) {
    url.searchParams.set('user_id', input.creatorUserId);
    url.searchParams.set(
      'custom_price',
      (input.customAmountFen / 100).toFixed(2),
    );
    return url;
  }
  throw new Error('下单地址缺少方案或自选金额');
}
