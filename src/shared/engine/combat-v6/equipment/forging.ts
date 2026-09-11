import { forgedName } from '../../../forging/names';
import { SeededRng } from '../core';
import { daoEquipmentAttributeRange, daoEquipmentTemplateOf } from './content';
import {
  daoEquipmentGenerationRulesV2,
  generateDaoEquipmentV2,
} from './generator';
import { DAO_EQUIPMENT_FORGING, equipmentEssencePool } from './forging-content';
import type {
  DaoEquipmentGenerationResult,
  GenerateDaoEquipmentV2Input,
} from './types';

export type ForgingBoosts = {
  ore: number;
  essence: number;
  attributes: number;
};
export const FORGING_BOOST_PER_MATERIAL = DAO_EQUIPMENT_FORGING.boostPerMaterial;
export function rollHigher(
  first: number,
  chance: number,
  random: () => number,
  draw: () => number,
) {
  return chance > 0 && random() < chance ? Math.max(first, draw()) : first;
}

/** Base V2 stream is unchanged. Each boost group has its own deterministic stream. */
export function generateForgedEquipment(
  input: Omit<GenerateDaoEquipmentV2Input, 'generatorVersion'> & {
    boosts: ForgingBoosts;
  },
): DaoEquipmentGenerationResult {
  const counts = Object.values(input.boosts);
  if (
    counts.some((n) => !Number.isInteger(n) || n < 0) ||
    counts.reduce((a, b) => a + b, 0) > 5
  )
    return {
      ok: false,
      diagnostics: [
        {
          severity: 'error',
          code: 'INVALID_EQUIPMENT_IDENTITY',
          message: '铸造材料数量无效',
        },
      ],
    };
  const generated = generateDaoEquipmentV2({
    ...input,
    generatorVersion: 'dao_equipment_generator_v2',
  });
  if (!generated.ok) return generated;
  const instance = generated.instance;
  const template = daoEquipmentTemplateOf(input.templateId)!;
  const ore = new SeededRng((input.seed ^ 0x41c64e6d) >>> 0);
  const bonus = new SeededRng((input.seed ^ 0x9e3779b9) >>> 0);
  const essence = new SeededRng((input.seed ^ 0x85ebca6b) >>> 0);
  const integer = (rng: SeededRng, min: number, max: number) =>
    min + Math.floor(rng.next() * (max - min + 1));
  instance.baseStats = instance.baseStats.map((stat) => {
    const rule = template.baseStats.find((r) => r.attr === stat.attr)!;
    return {
      ...stat,
      value: rollHigher(
        stat.value,
        input.boosts.ore * FORGING_BOOST_PER_MATERIAL,
        () => ore.next(),
        () =>
          integer(
            ore,
            Math.floor(input.equipmentLevel * rule.minCoefficient),
            Math.floor(input.equipmentLevel * rule.maxCoefficient),
          ),
      ),
    };
  });
  const bonusRange = daoEquipmentAttributeRange(input.equipmentLevel);
  instance.attributeBonuses = instance.attributeBonuses.map((stat) => ({
    ...stat,
    value: rollHigher(
      stat.value,
      input.boosts.attributes * FORGING_BOOST_PER_MATERIAL,
      () => bonus.next(),
      () =>
        integer(
          bonus,
          bonusRange.min,
          bonusRange.max,
        ),
    ),
  }));
  const count = rollHigher(
    instance.essenceIds.length,
    input.boosts.essence * FORGING_BOOST_PER_MATERIAL,
    () => essence.next(),
    () => daoEquipmentGenerationRulesV2.essenceCount(essence.next()),
  );
  const pool = equipmentEssencePool(instance.slot).filter(
    (id) => !instance.essenceIds.includes(id),
  );
  while (instance.essenceIds.length < count && pool.length)
    instance.essenceIds.push(
      pool.splice(Math.floor(essence.next() * pool.length), 1)[0],
    );
  instance.generatorVersion = 'dao_equipment_generator_v3';
  instance.name = forgedName(
    instance.slot,
    instance.equipmentLevel,
    input.seed,
  );
  return generated;
}
