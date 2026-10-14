import {
  BEAST_SPECIES,
  BEAST_SUPERIOR_BOOK_SKILL_IDS,
} from '@daoyou/game-content/beasts';
import { ATLAS_ANCHORS, ATLAS_REGIONS } from '../world/mapAtlas.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
// 12:00 Asia/Shanghai is 04:00 UTC. This shift puts the cycle boundary there.
const WINDOW_OFFSET_MS = SHANGHAI_OFFSET_MS + DAY_MS - 12 * 60 * 60 * 1000;
// 与 updateSpiritStones 的单次变动上限一致。再高的标价会被夹成少扣。
const SPIRIT_STONE_LIMIT = 99_990_000;
const PLACE_MARGIN = 120;
const PLACE_SPAN = 761;
const PLACE_CLEARANCE = 0.07;
const PLACE_ATTEMPTS = 48;

const REGIONS: { id: keyof typeof ATLAS_ANCHORS; name: string }[] = (
  Object.keys(ATLAS_ANCHORS) as (keyof typeof ATLAS_ANCHORS)[]
).map((id) => {
  const region = ATLAS_REGIONS.find((entry) => entry.id === id);
  if (!region) throw new Error(`区域图缺少名称: ${id}`);
  return { id, name: region.name };
});

export const WANDERER_BOOK_START_PRICE = 200_000;
export const WANDERER_DEW_PRICE = 320_000;
export const WANDERER_SUPERIOR_DEW_ID = 'beast.refinement.superior-origin-dew';
export const WANDERER_WANTED_BOTTLES = 12;

export type WandererOffer = {
  speciesId: string;
  speciesName: string;
  bottles: number;
};

export type WandererAppearance = {
  id: string;
  cycle: number;
  regionId: (typeof REGIONS)[number]['id'];
  regionName: string;
  x: number;
  y: number;
  bearing: string;
  startsAt: number;
  expiresAt: number;
  wantedSpeciesId: string;
  wantedSpeciesName: string;
  offers: WandererOffer[];
};

export function wandererWindow(now: number) {
  const cycle = Math.floor((now + WINDOW_OFFSET_MS) / DAY_MS);
  const startsAt = cycle * DAY_MS - WINDOW_OFFSET_MS;
  return {
    cycle,
    id: `wanderer-v1-${cycle}`,
    startsAt,
    expiresAt: startsAt + DAY_MS,
  };
}

export function wandererBookPrice(sales: number): number | null {
  if (!Number.isSafeInteger(sales) || sales < 0) return null;
  let price = WANDERER_BOOK_START_PRICE;
  for (let sold = 0; sold < sales; sold += 1) {
    const next = Math.round((price * 108) / 100);
    if (!Number.isSafeInteger(next) || next > SPIRIT_STONE_LIMIT) return null;
    price = next;
  }
  return price;
}

export function wandererSuperiorBookIds(): readonly string[] {
  return [...BEAST_SUPERIOR_BOOK_SKILL_IDS]
    .sort()
    .map((skillId) => `book.${skillId}`);
}

export function wandererAppearance(now: number): WandererAppearance {
  const window = wandererWindow(now);
  const region = REGIONS[wandererHash(`${window.id}:region`) % REGIONS.length]!;
  const place = wandererPlace(window.id, region.id);
  const wanted =
    BEAST_SPECIES[wandererHash(`${window.id}:wanted`) % BEAST_SPECIES.length]!;
  const offers = BEAST_SPECIES.map((species) => ({
    speciesId: species.id,
    speciesName: species.name,
    bottles:
      species.id === wanted.id
        ? WANDERER_WANTED_BOTTLES
        : 2 + (wandererHash(`${window.id}:price:${species.id}`) % 5),
  }));
  return {
    ...window,
    regionId: region.id,
    regionName: region.name,
    x: place.x,
    y: place.y,
    bearing: wandererBearing(place.x, place.y),
    wantedSpeciesId: wanted.id,
    wantedSpeciesName: wanted.name,
    offers,
  };
}

export function wandererRumor(appearance: WandererAppearance): string {
  const place =
    appearance.bearing === '中部'
      ? `${appearance.regionName}中部`
      : `${appearance.regionName}偏${appearance.bearing}`;
  return `传闻${place}来了游商，今日点名要「${appearance.wantedSpeciesName}」，专收变异灵兽。`;
}

function wandererPlace(
  windowId: string,
  regionId: WandererAppearance['regionId'],
) {
  const anchors = Object.values(ATLAS_ANCHORS[regionId]);
  let best = { x: 0.5, y: 0.5, clearance: -1 };
  for (let attempt = 0; attempt < PLACE_ATTEMPTS; attempt += 1) {
    const x =
      (PLACE_MARGIN + (wandererHash(`${windowId}:x:${attempt}`) % PLACE_SPAN)) /
      1000;
    const y =
      (PLACE_MARGIN + (wandererHash(`${windowId}:y:${attempt}`) % PLACE_SPAN)) /
      1000;
    const clearance = anchors.reduce((min, anchor) => {
      const distance = Math.hypot(x - anchor[0], y - anchor[1]);
      return Math.min(min, distance);
    }, 1);
    if (clearance > best.clearance) best = { x, y, clearance };
    if (clearance >= PLACE_CLEARANCE) return { x, y };
  }
  return { x: best.x, y: best.y };
}

function wandererBearing(x: number, y: number): string {
  const northSouth = y < 0.4 ? '北' : y > 0.6 ? '南' : '';
  const eastWest = x < 0.4 ? '西' : x > 0.6 ? '东' : '';
  if (!northSouth && !eastWest) return '中部';
  return `${eastWest}${northSouth}`;
}

function wandererHash(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
