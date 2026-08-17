import {
  buildAfdianCheckoutUrl,
  buildAfdianWebhookSignedText,
  createAfdianApiEnvelope,
} from '@shared/lib/afdianProtocol';
import { parseCnyAmountToFen } from '@shared/lib/sponsorship';
import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { z } from 'zod';
import type {
  ProviderOrder,
  SponsorshipCheckoutRequest,
  SponsorshipProvider,
  VerifiedWebhook,
} from './types';

const AFDIAN_API_BASE_URL = 'https://ifdian.net';
const AFDIAN_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwwdaCg1Bt+UKZKs0R54y
lYnuANma49IpgoOwNmk3a0rhg/PQuhUJ0EOZSowIC44l0K3+fqGns3Ygi4AfmEfS
4EKbdk1ahSxu7Zkp2rHMt+R9GarQFQkwSS/5x1dYiHNVMiR8oIXDgjmvxuNes2Cr
8fw9dEF0xNBKdkKgG2qAawcN1nZrdyaKWtPVT9m2Hl0ddOO9thZmVLFOb9NVzgYf
jEgI+KWX6aY19Ka/ghv/L4t1IXmz9pctablN5S0CRWpJW3Cn0k6zSXgjVdKm4uN7
jRlgSRaf/Ind46vMCm3N2sgwxu/g3bnooW+db0iLo13zzuvyn727Q3UDQ0MmZcEW
MQIDAQAB
-----END PUBLIC KEY-----`;

const AfdianSkuSchema = z.object({
  sku_id: z.string().optional().default(''),
});

const AfdianOrderSchema = z
  .object({
    out_trade_no: z.string().min(1).max(80),
    custom_order_id: z.string().max(128).optional().default(''),
    user_id: z.string().min(1).max(80),
    plan_id: z.string().max(80).optional().default(''),
    month: z.coerce.number().int().nonnegative().optional(),
    total_amount: z.string(),
    show_amount: z.string(),
    status: z.coerce.number().int(),
    product_type: z.coerce.number().int().optional(),
    create_time: z.coerce.number().int().positive().optional(),
    sku_detail: z.array(AfdianSkuSchema).optional().default([]),
  })
  .passthrough();

const AfdianWebhookSchema = z.object({
  data: z.object({
    type: z.literal('order'),
    order: AfdianOrderSchema,
    sign: z.string().min(1),
  }),
});

const AfdianApiResponseSchema = z.object({
  ec: z.number().int(),
  em: z.string().optional(),
  data: z.unknown().optional(),
});

function mapOrder(
  input: z.infer<typeof AfdianOrderSchema>,
  raw: unknown,
): ProviderOrder {
  const totalAmountFen = parseCnyAmountToFen(input.total_amount);
  const showAmountFen = parseCnyAmountToFen(input.show_amount);
  if (totalAmountFen === null || showAmountFen === null) {
    throw new Error('爱发电订单金额格式无效');
  }
  return {
    provider: 'afdian',
    providerOrderId: input.out_trade_no,
    customOrderId: input.custom_order_id || null,
    providerUserId: input.user_id,
    planId: input.plan_id || null,
    skuId: input.sku_detail[0]?.sku_id || null,
    productType: input.product_type ?? null,
    totalAmountFen,
    showAmountFen,
    month: input.month ?? null,
    status: input.status,
    createdAt: input.create_time ? new Date(input.create_time * 1_000) : null,
    raw,
  };
}

export class AfdianSponsorshipProvider implements SponsorshipProvider {
  readonly id = 'afdian' as const;

  isConfigured(): boolean {
    return Boolean(
      process.env.AFDIAN_USER_ID?.trim() && process.env.AFDIAN_TOKEN?.trim(),
    );
  }

  verifyWebhook(payload: unknown): VerifiedWebhook {
    const parsed = AfdianWebhookSchema.parse(payload);
    const order = parsed.data.order;
    const signed = buildAfdianWebhookSignedText({
      outTradeNo: order.out_trade_no,
      userId: order.user_id,
      planId: order.plan_id,
      totalAmount: order.total_amount,
    });
    const valid = verifySignature(
      'sha256',
      Buffer.from(signed, 'utf8'),
      createPublicKey(AFDIAN_PUBLIC_KEY),
      Buffer.from(parsed.data.sign, 'base64'),
    );
    if (!valid) throw new Error('爱发电 Webhook 签名无效');
    return { order: mapOrder(order, payload), raw: payload };
  }

  async queryOrder(providerOrderId: string): Promise<ProviderOrder | null> {
    const data = await this.request('/api/open/query-order', {
      out_trade_no: providerOrderId,
    });
    const list = z
      .object({ list: z.array(AfdianOrderSchema) })
      .parse(data).list;
    const row = list.find((item) => item.out_trade_no === providerOrderId);
    return row ? mapOrder(row, row) : null;
  }

  async listOrders(page: number, perPage: number): Promise<ProviderOrder[]> {
    const data = await this.request('/api/open/query-order', {
      page,
      per_page: perPage,
    });
    return z
      .object({ list: z.array(AfdianOrderSchema) })
      .parse(data)
      .list.map((row) => mapOrder(row, row));
  }

  async sendMessage(recipient: string, content: string): Promise<void> {
    await this.request('/api/open/send-msg', { recipient, content });
  }

  async ping(): Promise<void> {
    await this.request('/api/open/ping', { ping: 'daoyou' });
  }

  buildCheckoutUrl(input: SponsorshipCheckoutRequest): URL {
    return buildAfdianCheckoutUrl({
      intentId: input.intentId,
      planId: input.planId,
      customAmountFen: input.customAmountFen,
      creatorUserId: input.planId
        ? undefined
        : this.requireCredentials().userId,
    });
  }

  private requireCredentials(): { userId: string; token: string } {
    const userId = process.env.AFDIAN_USER_ID?.trim();
    const token = process.env.AFDIAN_TOKEN?.trim();
    if (!userId || !token) throw new Error('爱发电 Provider 未配置');
    return { userId, token };
  }

  private async request(
    path: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const credentials = this.requireCredentials();
    const ts = Math.floor(Date.now() / 1_000);
    const envelope = createAfdianApiEnvelope({
      userId: credentials.userId,
      token: credentials.token,
      params,
      timestampSeconds: ts,
    });
    const response = await fetch(`${AFDIAN_API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`爱发电 API HTTP ${response.status}`);
    const parsed = AfdianApiResponseSchema.parse(await response.json());
    if (parsed.ec !== 200) {
      throw new Error(
        `爱发电 API ${parsed.ec}: ${parsed.em ?? 'unknown error'}`,
      );
    }
    return parsed.data ?? {};
  }
}

export const afdianSponsorshipProvider = new AfdianSponsorshipProvider();
