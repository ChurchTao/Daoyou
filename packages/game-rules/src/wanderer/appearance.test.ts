import { BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { describe, expect, it } from 'vitest';
import { ATLAS_ANCHORS } from '../world/mapAtlas.js';
import {
  WANDERER_BOOK_START_PRICE,
  WANDERER_DEW_PRICE,
  WANDERER_INCENSE_PRICE,
  WANDERER_WANTED_BOTTLES,
  wandererAppearance,
  wandererBookPrice,
  wandererRumor,
  wandererSuperiorBookIds,
  wandererWindow,
} from './appearance.js';

const noon = Date.UTC(2026, 9, 14, 4, 0, 0);
const beforeNoon = Date.UTC(2026, 9, 14, 3, 59, 59, 999);

describe('云游商人刷新', () => {
  it('按北京时间 12 点换窗，窗口内身份不变', () => {
    const current = wandererWindow(noon);
    const previous = wandererWindow(beforeNoon);
    expect(current.startsAt).toBe(noon);
    expect(previous.expiresAt).toBe(noon);
    expect(current.id).not.toBe(previous.id);
    expect(wandererAppearance(noon + 60_000)).toEqual(wandererAppearance(noon));
    expect(wandererAppearance(noon).id).toBe(current.id);
    expect(wandererAppearance(beforeNoon).id).toBe(previous.id);
  });

  it('当天坐标落在区域图内，并离开已有地点', () => {
    for (let day = 0; day < 40; day += 1) {
      const appearance = wandererAppearance(noon + day * 24 * 60 * 60 * 1000);
      expect(appearance.x).toBeGreaterThanOrEqual(0.12);
      expect(appearance.x).toBeLessThanOrEqual(0.88);
      expect(appearance.y).toBeGreaterThanOrEqual(0.12);
      expect(appearance.y).toBeLessThanOrEqual(0.88);
      const clearance = Object.values(
        ATLAS_ANCHORS[appearance.regionId],
      ).reduce(
        (min, anchor) =>
          Math.min(
            min,
            Math.hypot(appearance.x - anchor[0], appearance.y - anchor[1]),
          ),
        1,
      );
      expect(clearance).toBeGreaterThanOrEqual(0.07);
    }
  });

  it('心仪物种与各物种瓶数由当天种子固定', () => {
    const appearance = wandererAppearance(noon);
    const wanted = appearance.offers.find(
      (offer) => offer.speciesId === appearance.wantedSpeciesId,
    );
    expect(wanted).toMatchObject({
      speciesName: appearance.wantedSpeciesName,
      bottles: WANDERER_WANTED_BOTTLES,
    });
    expect(appearance.offers.map((offer) => offer.speciesId)).toEqual(
      BEAST_SPECIES.map((species) => species.id),
    );
    for (const offer of appearance.offers) {
      if (offer.speciesId === appearance.wantedSpeciesId) continue;
      expect(offer.bottles).toBeGreaterThanOrEqual(2);
      expect(offer.bottles).toBeLessThanOrEqual(6);
    }
    const next = wandererAppearance(noon + 24 * 60 * 60 * 1000);
    expect(next.offers).not.toEqual(appearance.offers);
  });

  it('传闻写出区域、方位和心仪物种', () => {
    const appearance = wandererAppearance(noon);
    const text = wandererRumor(appearance);
    expect(text).toContain(appearance.regionName);
    expect(text).toContain(`「${appearance.wantedSpeciesName}」`);
    expect(text).toContain(
      appearance.bearing === '中部' ? '中部' : `偏${appearance.bearing}`,
    );
    expect(text.includes('http')).toBe(false);
    expect(text.includes(appearance.regionId)).toBe(false);
  });

  it('上品灵印从 20 万起按 8% 四舍五入，超出单次灵石变动上限后停售', () => {
    expect(WANDERER_DEW_PRICE).toBe(320_000);
    expect(WANDERER_INCENSE_PRICE).toBe(1_080_000);
    expect(wandererBookPrice(0)).toBe(WANDERER_BOOK_START_PRICE);
    expect([1, 2, 3, 4].map((sales) => wandererBookPrice(sales))).toEqual([
      216_000, 233_280, 251_942, 272_097,
    ]);
    expect(wandererBookPrice(-1)).toBeNull();
    let sales = 0;
    let price = wandererBookPrice(0);
    while (price !== null && sales < 300) {
      sales += 1;
      price = wandererBookPrice(sales);
    }
    expect(sales).toBeLessThan(300);
    expect(wandererBookPrice(sales - 1)).toBeLessThanOrEqual(99_990_000);
    expect(wandererSuperiorBookIds().length).toBeGreaterThan(0);
    expect(new Set(wandererSuperiorBookIds()).size).toBe(
      wandererSuperiorBookIds().length,
    );
  });
});
