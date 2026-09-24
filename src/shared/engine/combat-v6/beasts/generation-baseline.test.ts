import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { beastPanel, generateStarterBeast, projectBeastRoster } from './index';
import {
  beastRestCost,
  gainBeastExp,
  generateCapturedBeast,
} from './progression';
// Species revision 10 raises full native skill probabilities to 3–5%.
// Individual v3 adds baby free points and a permanent wild point deficit.
// Aptitude/growth draw order and progression revision 3 remain unchanged.
const baseline = [
  {
    speciesId: 'combat.wild.species.spirit-fox',
    hash: 'b32f2d959a2d0ce86ba563f195f4ce1c5c3c58a565c1d8d51a282ee7faf242d5',
  },
  {
    speciesId: 'combat.wild.species.rock-boar',
    hash: 'df6cc835d00a35e89563d0800d8b83a6538f85394de5f3c21529b66087c08ac1',
  },
  {
    speciesId: 'combat.wild.species.wind-wolf',
    hash: 'a88d3b3862e151a8642c49471f8fb655453560c687203d013f015d7e2aa16e78',
  },
];
function digest(speciesId: string) {
  const owner = '00000000-0000-4000-8000-000000000001',
    id = '00000000-0000-4000-8000-000000000002';
  const results = Array.from({ length: 128 }, (_, seed) =>
    [
      generateStarterBeast(id, owner, speciesId, seed),
      ...[0, 10, 90, 180].map((level) =>
        generateCapturedBeast(id, owner, speciesId, level, seed),
      ),
    ].map((beast) => ({
      beast,
      panel: beastPanel(beast),
      grown: gainBeastExp(beast, 5000, 180),
      cost: beastRestCost({ ...beast, currentLifespan: 123 }),
      roster: projectBeastRoster(
        {
          beasts: [beast],
          lineup: { carriedBeastIds: [id], leadBeastId: id, revision: 0 },
        },
        owner,
        0,
        0,
      ),
    })),
  );
  const facts = JSON.stringify(results);
  return createHash('sha256').update(facts).digest('hex');
}
it.each(baseline)(
  'matches current $speciesId outputs for 128 seeds',
  ({ speciesId, hash }) => expect(digest(speciesId)).toBe(hash),
);


it.each([
  { index: 0, ranges: [[672, 840], [864, 1080], [2880, 3600], [1536, 1920], [864, 1080]], growth: [982, 1030] },
  { index: 1, ranges: [[816, 1020], [1180, 1440], [3960, 4950], [1536, 1920], [576, 720]], growth: [1012, 1060] },
  { index: 2, ranges: [[1104, 1380], [624, 780], [2160, 2700], [960, 1200], [864, 1080]], growth: [952, 1000] },
])('new species $index rolls stay within the confirmed design ranges', ({ index, ranges, growth }) => {
  const id = '00000000-0000-4000-8000-000000000001';
  for (let seed = 0; seed < 128; seed++) {
    const beast = generateStarterBeast(id, id, baseline[index].speciesId, seed);
    Object.values(beast.aptitudes).forEach((value, i) => {
      expect(value).toBeGreaterThanOrEqual(ranges[i][0]);
      expect(value).toBeLessThanOrEqual(ranges[i][1]);
    });
    expect(beast.growth).toBeGreaterThanOrEqual(growth[0] / 1000);
    expect(beast.growth).toBeLessThanOrEqual(growth[1] / 1000);
  }
});
