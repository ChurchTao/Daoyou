// 由 hutu.si scene.js 的 tt(2024) + t0() 改疏、改淡。正面先画深色纤维，再画浅色纤维。

function createFiberRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 1831565813) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function fiberSvg(count: number, random: () => number) {
  let paths = '';
  for (let index = 0; index < count; index += 1) {
    const x = random() * 620;
    const y = random() * 360;
    const angle = random() * 6.283;
    const length = 2.4 + 24 * random() ** 2.2;
    const bend = (random() - 0.5) * 0.6 * length;
    const endX = x + Math.cos(angle) * length;
    const endY = y + Math.sin(angle) * length;
    const controlX = (x + endX) / 2 - Math.sin(angle) * bend;
    const controlY = (y + endY) / 2 + Math.cos(angle) * bend;
    const fixed = (point: number) => point.toFixed(1);
    paths += `<path d='M${fixed(x)} ${fixed(y)}Q${fixed(controlX)} ${fixed(controlY)} ${fixed(endX)} ${fixed(endY)}' stroke-width='${(0.3 + random() * 0.48).toFixed(2)}' stroke-opacity='${(0.18 + random() * 0.4).toFixed(2)}'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' width='620' height='360'><g fill='none' stroke='#000' stroke-linecap='round'>${paths}</g></svg>`;
}

const random = createFiberRandom(2024);
const frontDarkSvg = fiberSvg(88, random);
const frontLightSvg = fiberSvg(68, random);

function maskUrl(svg: string) {
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const paperStrokeDarkMask = maskUrl(frontDarkSvg);
export const paperStrokeLightMask = maskUrl(frontLightSvg);
