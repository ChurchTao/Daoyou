import { expect, it } from 'vitest';
import { BEAST_SPECIES } from './content';
import { generateCapturedBeast, generateStarterBeast } from './generator';
const id = '00000000-0000-4000-8000-000000000001';
it.each(BEAST_SPECIES)(
  '$name 只从物种池等权不重复抽取，核心不必带，资质与成长保持不变',
  (species) => {
    const seen = new Set<string>();
    const counts = new Set<number>();
    for (let seed = 0; seed < 256; seed++) {
      const born = generateStarterBeast(id, id, species.id, seed);
      const captured = generateCapturedBeast(id, id, species.id, 10, seed);
      expect(born.skills).toHaveLength(1);
      expect(captured.skills.length).toBe(captured.skillSlotCapacity);
      expect(captured.skills[0]).toBe(born.skills[0]);
      expect(new Set(captured.skills).size).toBe(captured.skills.length);
      expect(captured.aptitudes).toEqual(born.aptitudes);
      expect(captured.growth).toBe(born.growth);
      expect(captured).toEqual(
        generateCapturedBeast(id, id, species.id, 10, seed),
      );
      captured.skills.forEach((s) => {
        expect(species.skills).toContain(s);
        seen.add(s);
      });
      counts.add(captured.skills.length);
    }
    expect([...counts].sort()).toEqual([1, 2]);
    expect([...seen].sort()).toEqual([...species.skills].sort());
  },
);
