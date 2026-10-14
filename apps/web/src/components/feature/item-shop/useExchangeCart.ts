import {
  ITEM_EXCHANGE_CART_MAX_COUNT,
  ITEM_EXCHANGE_CART_MAX_LINES,
} from '@daoyou/game-domain/shops/exchange';
import type { ItemExchangeShopItemView } from '@daoyou/game-domain/shops/exchange';
import { useMemo, useState } from 'react';

export const HIGH_VALUE_EXCHANGE_CONFIRM_THRESHOLD = 100;

export interface ExchangeCartLine {
  id: string;
  count: number;
  price: number;
  name: string;
}

export type ExchangeBlock = 'limit' | 'loading' | 'short' | 'full';

export function weeklyExchangeCap(item: ItemExchangeShopItemView): number {
  const remaining =
    item.remainingPurchases === null
      ? ITEM_EXCHANGE_CART_MAX_COUNT
      : item.remainingPurchases;
  return Math.min(ITEM_EXCHANGE_CART_MAX_COUNT, Math.max(0, remaining));
}

export function affordableExchangeCount(
  item: ItemExchangeShopItemView,
  balance: number | undefined,
  reserved: number,
): number {
  const cap = weeklyExchangeCap(item);
  if (cap < 1 || balance === undefined || item.price < 1) return 0;
  return Math.min(
    cap,
    Math.floor(Math.max(0, balance - reserved) / item.price),
  );
}

export function canonicalExchangeLines(
  lines: readonly ExchangeCartLine[],
): Array<{ id: string; count: number }> {
  return [...lines]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((line) => ({ id: line.id, count: line.count }));
}

export function exchangeSummary(lines: readonly ExchangeCartLine[]): string {
  const pieces = lines.reduce((sum, line) => sum + line.count, 0);
  if (lines.length === 1) {
    const line = lines[0];
    return line.count > 1
      ? `已兑换${line.name} ×${line.count}`
      : `已兑换${line.name}`;
  }
  return `已兑换 ${lines.length} 种，共 ${pieces} 次`;
}

export function useExchangeCart(items: ItemExchangeShopItemView[]) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const itemKey = items
    .map((item) => `${item.id}:${weeklyExchangeCap(item)}`)
    .join('|');
  const [seenItemKey, setSeenItemKey] = useState(itemKey);
  if (seenItemKey !== itemKey) {
    setSeenItemKey(itemKey);
    setCounts((previous) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [id, count] of Object.entries(previous)) {
        const item = items.find((entry) => entry.id === id);
        const cap = item ? weeklyExchangeCap(item) : 0;
        if (cap < 1) {
          changed = true;
          continue;
        }
        const clamped = Math.min(count, cap);
        if (clamped !== count) changed = true;
        next[id] = clamped;
      }
      if (Object.keys(previous).length !== Object.keys(next).length)
        changed = true;
      return changed ? next : previous;
    });
  }

  const lines = useMemo<ExchangeCartLine[]>(
    () =>
      items.flatMap((item) => {
        const count = counts[item.id];
        if (!count) return [];
        return [
          {
            id: item.id,
            count,
            price: item.price,
            name: item.item?.name ?? '道具',
          },
        ];
      }),
    [counts, items],
  );
  const total = lines.reduce((sum, line) => sum + line.price * line.count, 0);
  const pieces = lines.reduce((sum, line) => sum + line.count, 0);

  function reservedExcept(id: string) {
    return lines.reduce(
      (sum, line) => (line.id === id ? sum : sum + line.price * line.count),
      0,
    );
  }

  function toggle(
    item: ItemExchangeShopItemView,
    balance: number | undefined,
  ): ExchangeBlock | null {
    if (counts[item.id]) {
      setCounts((previous) => {
        const next = { ...previous };
        delete next[item.id];
        return next;
      });
      return null;
    }
    if (item.remainingPurchases === 0) return 'limit';
    if (balance === undefined) return 'loading';
    if (lines.length >= ITEM_EXCHANGE_CART_MAX_LINES) return 'full';
    if (affordableExchangeCount(item, balance, reservedExcept(item.id)) < 1)
      return 'short';
    setCounts((previous) => ({ ...previous, [item.id]: 1 }));
    return null;
  }

  function setCount(
    id: string,
    raw: number,
    balance: number | undefined,
  ) {
    const item = items.find((entry) => entry.id === id);
    if (!item || !Number.isInteger(raw)) return;
    const max = affordableExchangeCount(item, balance, reservedExcept(id));
    if (max < 1) return;
    setCounts((previous) => {
      if (
        previous[id] === undefined &&
        Object.keys(previous).length >= ITEM_EXCHANGE_CART_MAX_LINES
      )
        return previous;
      return { ...previous, [id]: Math.min(max, Math.max(1, raw)) };
    });
  }

  function clear(ids?: readonly string[]) {
    if (!ids) {
      setCounts({});
      return;
    }
    setCounts((previous) => {
      const next = { ...previous };
      for (const id of ids) delete next[id];
      return next;
    });
  }

  return {
    counts,
    lines,
    total,
    pieces,
    reservedExcept,
    toggle,
    setCount,
    clear,
  };
}
