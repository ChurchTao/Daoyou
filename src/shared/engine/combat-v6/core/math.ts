/** 战斗结算用的纯数值工具，避免各处手写 Math.max(1, floor(...))。 */

export function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value))
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return clamp(0, 1, value)
}

export function atLeast(min: number, value: number): number {
  return Math.max(min, value)
}

export function floorAtLeast(min: number, value: number): number {
  return Math.max(min, Math.floor(value))
}

export function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}
