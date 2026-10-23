import { expect, it } from 'vitest';

import type { DaoEquipmentSlot } from '@daoyou/game-domain/equipment';
import { generateDaoEquipmentV2 } from './generator.js';
import {
  equipmentRollDifference,
  previewEquipmentReplacement,
} from './preview.js';

const base = { equipment: {}, level: 180 };
function item(slot: DaoEquipmentSlot, essences: string[] = [], art?: string) {
  const r = generateDaoEquipmentV2({
    id: `${slot}-${essences.join('-')}`,
    createdAt: 'test',
    seed: 12,
    templateId: `dao_equipment.standard.${slot}.v1`,
    equipmentLevel: 90,
    generatorVersion: 'dao_equipment_generator_v2',
  });
  if (!r.ok) throw new Error('generation');
  return {
    ...r.instance,
    essenceIds: essences.map((id) => `dao_equipment.essence.${id}`),
    artId: art ? `dao_equipment.art.${art}` : undefined,
  };
}
it('compares an empty slot without mutating the current loadout', () => {
  const input = structuredClone(base),
    candidate = item('weapon');
  const saved = structuredClone({ input, candidate });
  const r = previewEquipmentReplacement(input, candidate);
  expect(r.ok).toBe(true);
  if (r.ok) expect(r.previous).toBeUndefined();
  expect({ input, candidate }).toEqual(saved);
});
it('reports one fewer stack even when the same essence ID remains', () => {
  const r = previewEquipmentReplacement(
    {
      ...base,
      equipment: {
        head: item('head', ['pojia']),
        weapon: item('weapon', ['pojia']),
      },
    },
    item('weapon'),
  );
  expect(r.ok).toBe(true);
  if (r.ok)
    expect(r.essences).toContainEqual(
      expect.objectContaining({
        name: '破甲',
        before: 2,
        after: 1,
        stackable: true,
      }),
    );
});
it('does not report losing a unique essence or art still supplied elsewhere', () => {
  const r = previewEquipmentReplacement(
    {
      ...base,
      equipment: {
        head: item('head', ['huichun'], 'huiyuan'),
        weapon: item('weapon', ['huichun'], 'huiyuan'),
      },
    },
    item('weapon'),
  );
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.essences).toEqual([]);
    expect(r.arts).toEqual([]);
  }
});
it('reports retained arts becoming more expensive when guiyuan is removed', () => {
  const r = previewEquipmentReplacement(
    {
      ...base,
      equipment: {
        belt: item('belt', ['guiyuan']),
        weapon: item('weapon', [], 'huiyuan'),
      },
    },
    item('belt'),
  );
  expect(r.ok).toBe(true);
  if (r.ok)
    expect(r.arts).toContainEqual(
      expect.objectContaining({
        name: '回元诀',
        before: true,
        after: true,
        beforeCost: 24,
        afterCost: 30,
      }),
    );
});
it('reports arts actually lost and gained, including effective rage costs', () => {
  const r = previewEquipmentReplacement(
    {
      ...base,
      equipment: {
        belt: item('belt', ['guiyuan']),
        weapon: item('weapon', [], 'huiyuan'),
      },
    },
    item('weapon', [], 'yangyuan'),
  );
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.arts).toContainEqual(
      expect.objectContaining({
        name: '回元诀',
        before: true,
        after: false,
        beforeCost: 24,
      }),
    );
    expect(r.arts).toContainEqual(
      expect.objectContaining({
        name: '养元诀',
        before: false,
        after: true,
        afterCost: 48,
      }),
    );
  }
});
it('compares like-for-like rows and preserves removed attributes as negative deltas', () => {
  const old = [
    { attr: 'strength', value: 10 },
    { attr: 'spirit', value: 5 },
  ];
  const next = [{ attr: 'strength', value: 15 }];
  expect(equipmentRollDifference(next, old, 'strength')).toBe(5);
  expect(equipmentRollDifference(next, old, 'spirit')).toBe(-5);
  expect(equipmentRollDifference(next, undefined, 'strength')).toBe(15);
  expect(
    equipmentRollDifference(
      [
        { attr: 'physicalAtk', value: 20 },
        { attr: 'physicalAtk', value: 30 },
      ],
      [{ attr: 'physicalAtk', value: 45 }],
      'physicalAtk',
    ),
  ).toBe(5);
});
it('rejects an invalid candidate rather than presenting a partial success', () => {
  const r = previewEquipmentReplacement(base, item('weapon', ['guiyuan']));
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toContain('不能出现在该部位');
});

it('does not report special changes for identical equipment', () => {
  const weapon = item('weapon', ['pojia'], 'huiyuan');
  const r = previewEquipmentReplacement(
    { ...base, equipment: { weapon } },
    weapon,
  );
  expect(r.ok).toBe(true);
  if (r.ok) {
    expect(r.essences).toEqual([]);
    expect(r.arts).toEqual([]);
    expect(r.previous).toEqual(weapon);
  }
});
it('honors character equip requirements before reporting a comparison', () => {
  const r = previewEquipmentReplacement(
    { equipment: {}, level: 0 },
    item('weapon'),
  );
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.reason).toContain('境界不足');
});
