import type { AdminAiUsageQuery } from '@daoyou/contracts/admin/ai-usage';
import { z } from 'zod';

const DAY_MS = 86_400_000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1_000;
const dateString = z.iso.date();
const filterString = (max: number) =>
  z.string().trim().min(1).max(max).optional();
const pageNumber = (max: number, fallback: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max))
    .optional()
    .transform((value) => value ?? fallback);

export function aiUsageDateStart(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`);
}

/** UTC calendar arithmetic preserves date-only strings across host time zones. */
export function shiftAiUsageDate(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export const AdminAiUsageQuerySchema = z
  .strictObject({
    from: dateString.optional(),
    to: dateString.optional(),
    sceneId: filterString(120),
    provider: filterString(120),
    modelId: filterString(240),
    page: pageNumber(1_000_000, 1),
    pageSize: pageNumber(100, 25),
  })
  .transform((query): AdminAiUsageQuery => {
    // Defaults are evaluated for each request, including after a long-lived server crosses midnight.
    const today = new Date(Date.now() + SHANGHAI_OFFSET_MS)
      .toISOString()
      .slice(0, 10);
    const to = query.to ?? today;
    const from = query.from ?? shiftAiUsageDate(to, -6);
    return { ...query, from, to };
  })
  .superRefine((query, context) => {
    if (
      !dateString.safeParse(query.from).success ||
      !dateString.safeParse(shiftAiUsageDate(query.to, 1)).success
    ) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: '日期范围超出支持的日历边界',
      });
      return;
    }
    const boundaries = [
      aiUsageDateStart(query.from),
      aiUsageDateStart(shiftAiUsageDate(query.to, 1)),
    ];
    if (
      boundaries.some(
        (date) => !Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1,
      )
    ) {
      context.addIssue({
        code: 'custom',
        path: ['from'],
        message: '日期换算后超出支持的数据库时间边界',
      });
      return;
    }
    const days = (Date.parse(query.to) - Date.parse(query.from)) / DAY_MS + 1;
    if (!Number.isFinite(days) || days < 1 || days > 366) {
      context.addIssue({
        code: 'custom',
        path: ['to'],
        message: '日期范围必须为 1 至 366 天，且开始日期不能晚于结束日期',
      });
    }
  });
