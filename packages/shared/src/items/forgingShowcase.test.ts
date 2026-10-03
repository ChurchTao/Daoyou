import { describe, expect, it } from 'vitest';
import { DomainEventDataSchemas } from '../contracts/domainEvents.js';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging.js';
import { forgingShowcaseSnapshot } from './forgingShowcase.js';
import { isInventoryShowcase } from './showcase.js';

function equipment() {
  const result = generateForgedEquipment({
    id: 'forge-showcase',
    createdAt: '2026-09-30T00:00:00Z',
    seed: 1,
    templateId: 'dao_equipment.standard.weapon.v1',
    equipmentLevel: 10,
    weaponType: 'sword',
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!result.ok) throw new Error('equipment generation failed');
  return {
    ...result.instance,
    crafterName: '铸器道友',
    essenceIds: [] as string[],
    artId: undefined as string | undefined,
  };
}

describe('forging showcases', () => {
  it('does not showcase ordinary equipment', () => {
    expect(forgingShowcaseSnapshot(equipment())).toBeUndefined();
  });

  it.each([
    { artId: 'dao_equipment.art.huiyuan', essenceIds: [] },
    { artId: undefined, essenceIds: ['dao_equipment.essence.cangfeng'] },
    {
      artId: 'dao_equipment.art.huiyuan',
      essenceIds: ['dao_equipment.essence.cangfeng'],
    },
  ])(
    'showcases equipment with either or both special properties: %j',
    (special) => {
      const item = { ...equipment(), ...special };
      const data = DomainEventDataSchemas['equipment.forged'].parse({
        userId: '11111111-1111-4111-8111-111111111111',
        cultivatorId: '22222222-2222-4222-8222-222222222222',
        cultivatorName: item.crafterName,
        equipment: item,
      });
      const snapshot = forgingShowcaseSnapshot(data.equipment);
      expect(snapshot).toEqual({
        definitionId: 'equipment.v6',
        name: item.name,
        quantity: 1,
        instanceData: item,
      });
      expect(isInventoryShowcase({ version: 1, snapshot })).toBe(true);
      item.essenceIds.push('later-change');
      item.name = 'later-name';
      expect(snapshot?.name).not.toBe(item.name);
      expect(snapshot?.instanceData).not.toEqual(item);
    },
  );

  it('rejects incomplete equipment snapshots at the event boundary', () => {
    expect(
      DomainEventDataSchemas['equipment.forged'].safeParse({
        userId: '11111111-1111-4111-8111-111111111111',
        cultivatorId: '22222222-2222-4222-8222-222222222222',
        cultivatorName: '铸器道友',
        equipment: { artId: 'art' },
      }).success,
    ).toBe(false);
  });
});
