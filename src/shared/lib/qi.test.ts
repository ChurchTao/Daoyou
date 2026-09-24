import {
  QI_MAX,
  QI_NATURAL_RESTORE_INTERVAL_MS,
  QI_OVERFLOW_MAX,
} from '@shared/config/qiSystem';
import { projectNaturalQiState } from './qi';

const BASE_MS = Date.parse('2026-07-30T00:00:00.000Z');

describe('projectNaturalQiState', () => {
  it('默认每六分钟恢复一点，从零到240需要24小时', () => {
    const project = (elapsedMs: number) => projectNaturalQiState({
      qi: 0,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(BASE_MS + elapsedMs),
    });

    expect(project(6 * 60_000 - 1).current).toBe(0);
    expect(project(6 * 60_000).current).toBe(1);
    expect(project(60 * 60_000).current).toBe(10);
    expect(project(0).recovery.fullRestoreInMs).toBe(24 * 60 * 60_000);
    expect(project(24 * 60 * 60_000).current).toBe(240);
    expect(project(48 * 60 * 60_000).current).toBe(240);
    expect(project(0).max).toBe(240);
  });

  it.each([
    {
      name: '恢复边界前不增加',
      qi: 100,
      nowMs: BASE_MS + QI_NATURAL_RESTORE_INTERVAL_MS - 1,
      expected: 100,
      restored: 0,
    },
    {
      name: '六分钟恢复一点',
      qi: 100,
      nowMs: BASE_MS + QI_NATURAL_RESTORE_INTERVAL_MS,
      expected: 101,
      restored: 1,
    },
    {
      name: '连续多个恢复周期一次追算',
      qi: 100,
      nowMs: BASE_MS + 3 * QI_NATURAL_RESTORE_INTERVAL_MS,
      expected: 103,
      restored: 3,
    },
    {
      name: '恢复量钳制到自然上限',
      qi: 239,
      nowMs: BASE_MS + 2 * QI_NATURAL_RESTORE_INTERVAL_MS,
      expected: QI_MAX,
      restored: 1,
    },
  ])('$name', ({ qi, nowMs, expected, restored }) => {
    const projection = projectNaturalQiState({
      qi,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(nowMs),
    });

    expect(projection.current).toBe(expected);
    expect(projection.restored).toBe(restored);
  });

  it('保留未满资源的六分钟周期余量并给出精确恢复时间', () => {
    const nowMs = BASE_MS + QI_NATURAL_RESTORE_INTERVAL_MS + 2 * 60_000;
    const projection = projectNaturalQiState({
      qi: 100,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(nowMs),
    });

    expect(projection.current).toBe(101);
    expect(projection.baselineAt.getTime()).toBe(
      BASE_MS + QI_NATURAL_RESTORE_INTERVAL_MS,
    );
    expect(projection.recovery.nextRestoreAt?.getTime()).toBe(
      BASE_MS + 2 * QI_NATURAL_RESTORE_INTERVAL_MS,
    );
    expect(projection.recovery.nextRestoreInMs).toBe(4 * 60_000);
    expect(projection.recovery.fullRestoreAt?.getTime()).toBe(
      BASE_MS + 140 * QI_NATURAL_RESTORE_INTERVAL_MS,
    );
  });

  it.each([
    { name: '自然满值', qi: QI_MAX, status: 'full' as const },
    { name: '符箓溢出', qi: QI_MAX + 25, status: 'overflow' as const },
  ])('$name 暂停自然恢复并以当前时间作为下一次消费基线', ({ qi, status }) => {
    const nowMs = BASE_MS + 5 * QI_NATURAL_RESTORE_INTERVAL_MS;
    const projection = projectNaturalQiState({
      qi,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(nowMs),
    });

    expect(projection.current).toBe(qi);
    expect(projection.baselineAt.getTime()).toBe(nowMs);
    expect(projection.recovery.status).toBe(status);
    expect(projection.recovery.nextRestoreAt).toBeNull();
  });

  it('将越界资源钳制到符箓溢出上限', () => {
    const projection = projectNaturalQiState({
      qi: QI_OVERFLOW_MAX + 50,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(BASE_MS),
    });

    expect(projection.current).toBe(QI_OVERFLOW_MAX);
    expect(projection.shouldPersist).toBe(true);
  });

  it('从溢出状态消费到自然上限以下后重新开始计时', () => {
    const overflow = projectNaturalQiState({
      qi: QI_MAX + 25,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(BASE_MS + 2 * QI_NATURAL_RESTORE_INTERVAL_MS),
    });
    const consumed = projectNaturalQiState({
      qi: QI_MAX - 10,
      qiLastRefreshedAt: overflow.baselineAt,
      now: overflow.baselineAt,
    });

    expect(consumed.current).toBe(QI_MAX - 10);
    expect(consumed.recovery.status).toBe('recovering');
    expect(consumed.recovery.nextRestoreAt?.getTime()).toBe(
      overflow.baselineAt.getTime() + QI_NATURAL_RESTORE_INTERVAL_MS,
    );
  });

  it('将无效资源值修复为零', () => {
    const projection = projectNaturalQiState({
      qi: Number.NaN,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(BASE_MS),
    });

    expect(projection.current).toBe(0);
    expect(projection.shouldPersist).toBe(true);
  });

  it.each([
    { name: '缺失时间', value: null },
    { name: '无效时间', value: 'not-a-date' },
    {
      name: '未来时间',
      value: new Date(BASE_MS + QI_NATURAL_RESTORE_INTERVAL_MS),
    },
  ])('$name 不赠送恢复量并要求修复基线', ({ value }) => {
    const projection = projectNaturalQiState({
      qi: 100,
      qiLastRefreshedAt: value,
      now: new Date(BASE_MS),
    });

    expect(projection.current).toBe(100);
    expect(projection.restored).toBe(0);
    expect(projection.baselineAt.getTime()).toBe(BASE_MS);
    expect(projection.timestampValid).toBe(false);
    expect(projection.shouldPersist).toBe(true);
    expect(projection.recovery.status).toBe('unknown');
  });

  it('使用投影后的值和基线连续投影不会重复恢复', () => {
    const firstNowMs =
      BASE_MS + 2 * QI_NATURAL_RESTORE_INTERVAL_MS + 2 * 60_000;
    const first = projectNaturalQiState({
      qi: 100,
      qiLastRefreshedAt: new Date(BASE_MS),
      now: new Date(firstNowMs),
    });
    const second = projectNaturalQiState({
      qi: first.current,
      qiLastRefreshedAt: first.baselineAt,
      now: new Date(firstNowMs + 3 * 60_000),
    });

    expect(first.current).toBe(102);
    expect(second.current).toBe(102);
    expect(second.restored).toBe(0);
    expect(second.baselineAt.getTime()).toBe(first.baselineAt.getTime());
  });
});
