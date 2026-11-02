import { DAO_EQUIPMENT_TEMPLATES_V1 } from '@daoyou/game-content/equipment/base';
import {
  DAO_EQUIPMENT_SPECIAL_GENERATION,
  equipmentArtPool,
  equipmentEssencePool,
} from '@daoyou/game-content/equipment/forging';
import {
  DAO_EQUIPMENT_SLOTS,
  EQUIPMENT_LEVELS,
} from '@daoyou/game-domain/equipment';
import { expect, it } from 'vitest';
import { listEquipmentCodex, listEquipmentCodexAffixes } from './codex.js';
import { equipmentRealm } from './realm.js';
import { daoEquipmentBaseRange } from './ranges.js';

const sword = listEquipmentCodex();
const axe = listEquipmentCodex('axe');
const affixes = listEquipmentCodexAffixes();

it('按开放器阶与六个部位列出白字', () => {
  expect(sword.map((entry) => entry.level)).toEqual([...EQUIPMENT_LEVELS]);
  for (const entry of sword) {
    expect(entry.realm).toBe(equipmentRealm(entry.level).realm);
    expect(entry.requiredLevel).toBe(equipmentRealm(entry.level).requiredLevel);
    expect(entry.slots.map((slot) => slot.slot)).toEqual([
      ...DAO_EQUIPMENT_SLOTS,
    ]);
    for (const slot of entry.slots) {
      const template = DAO_EQUIPMENT_TEMPLATES_V1.find(
        (item) => item.slot === slot.slot,
      )!;
      expect(slot.stats.map((stat) => stat.attr)).toEqual(
        template.baseStats.map((stat) => stat.attr),
      );
      for (const [stat, source] of slot.stats.map(
        (stat, index) => [stat, template.baseStats[index]!] as const,
      )) {
        expect(stat.base).toEqual(
          daoEquipmentBaseRange(source, entry.level, 0),
        );
        expect(stat.peak).toEqual(
          daoEquipmentBaseRange(source, entry.level, 1),
        );
        expect(stat.peak.max).toBeGreaterThanOrEqual(stat.base.max);
      }
    }
  }
});

it('法兵器形只改动物攻与法攻，其余部位沿用标准窗口', () => {
  const swordWeapon = sword[0]!.slots[0]!;
  const axeWeapon = axe[0]!.slots[0]!;
  const template = DAO_EQUIPMENT_TEMPLATES_V1.find(
    (item) => item.slot === 'weapon',
  )!;
  expect(axeWeapon.stats.map((stat) => stat.base)).toEqual(
    template.baseStats.map((stat) =>
      daoEquipmentBaseRange(stat, 10, 0, 'axe'),
    ),
  );
  expect(axeWeapon.stats[0]!.base).not.toEqual(swordWeapon.stats[0]!.base);
  expect(axeWeapon.stats.at(-1)).toEqual(swordWeapon.stats.at(-1));
  expect(axe[0]!.slots.slice(1)).toEqual(sword[0]!.slots.slice(1));
});

it('器蕴和器诀各列一次，并标出可出现的部位', () => {
  expect(affixes.essences.map((entry) => entry.id)).toEqual([
    ...DAO_EQUIPMENT_SPECIAL_GENERATION.essencePool,
  ]);
  expect(affixes.arts.map((entry) => entry.id)).toEqual([
    ...DAO_EQUIPMENT_SPECIAL_GENERATION.artPool,
  ]);
  for (const entry of [...affixes.essences, ...affixes.arts]) {
    expect(entry.description).not.toMatch(/\{/);
    expect(entry.slots).toEqual(
      DAO_EQUIPMENT_SLOTS.filter((slot) =>
        (affixes.essences.some((essence) => essence.id === entry.id)
          ? equipmentEssencePool(slot)
          : equipmentArtPool(slot)
        ).includes(entry.id),
      ),
    );
    expect(entry.slots.length).toBeGreaterThan(0);
  }
  expect(affixes.essences.find((entry) => entry.name === '藏锋')?.slots).toEqual(
    [...DAO_EQUIPMENT_SLOTS],
  );
  expect(affixes.essences.find((entry) => entry.name === '噬灵')?.slots).toEqual(
    ['weapon'],
  );
  expect(
    affixes.essences.find((entry) => entry.name === '藏锋')?.description,
  ).toContain('3%');
  for (const art of affixes.arts) expect(art.rageCost).toBeGreaterThan(0);
});
