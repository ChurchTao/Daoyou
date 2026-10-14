import {
  ITEM_EXCHANGE_CART_MAX_COUNT,
  ITEM_EXCHANGE_CART_MAX_LINES,
} from '@daoyou/game-domain/shops/exchange';

const PURCHASE_WEEK_TIME_ZONE = 'Asia/Shanghai';

export interface ExchangeCartQuoteLine {
  price: number;
  count: number;
}

export type ExchangeCartQuote =
  | { ok: true; total: number }
  | { ok: false; reason: 'invalid' | 'repriced' };

/** Server-side cart total. `expectedTotal` rejects a stale client price. */
export function quoteExchangeCart(
  lines: readonly ExchangeCartQuoteLine[],
  expectedTotal: number | null,
): ExchangeCartQuote {
  if (lines.length < 1 || lines.length > ITEM_EXCHANGE_CART_MAX_LINES)
    return { ok: false, reason: 'invalid' };
  let total = 0;
  for (const line of lines) {
    if (
      !Number.isSafeInteger(line.price) ||
      line.price < 1 ||
      !Number.isSafeInteger(line.count) ||
      line.count < 1 ||
      line.count > ITEM_EXCHANGE_CART_MAX_COUNT
    )
      return { ok: false, reason: 'invalid' };
    const cost = line.price * line.count;
    if (!Number.isSafeInteger(cost)) return { ok: false, reason: 'invalid' };
    total += cost;
  }
  if (!Number.isSafeInteger(total) || total < 1)
    return { ok: false, reason: 'invalid' };
  if (
    expectedTotal !== null &&
    (!Number.isSafeInteger(expectedTotal) || expectedTotal !== total)
  )
    return { ok: false, reason: 'repriced' };
  return { ok: true, total };
}

export function getItemExchangePurchaseWeek(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PURCHASE_WEEK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const localDate = new Date(
    Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day)),
  );
  const dayOffset = (localDate.getUTCDay() + 6) % 7;
  localDate.setUTCDate(localDate.getUTCDate() - dayOffset);
  return localDate.toISOString().slice(0, 10);
}
