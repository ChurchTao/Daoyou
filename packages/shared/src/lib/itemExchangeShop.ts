const PURCHASE_WEEK_TIME_ZONE = 'Asia/Shanghai';

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
