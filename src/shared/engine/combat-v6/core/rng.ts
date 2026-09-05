/**
 * mulberry32：战斗内核唯一随机源。
 * 公式、命中、兽决概率都必须走这里，禁止 Math.random，否则录像无法对拍。
 */
export class SeededRng {
  private s: number

  constructor(seed: number) {
    this.s = seed >>> 0
  }

  get state(): number {
    return this.s
  }

  set state(value: number) {
    this.s = value >>> 0
  }

  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0
    let t = this.s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  chance(p: number): boolean {
    if (p <= 0) return false
    if (p >= 1) return true
    return this.next() < p
  }

  range(min: number, max: number): number {
    if (min === max) return min
    return min + this.next() * (max - min)
  }
}
