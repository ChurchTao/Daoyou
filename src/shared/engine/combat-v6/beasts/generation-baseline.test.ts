import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { beastPanel, generateStarterBeast, projectBeastRoster } from './index';
import {
  beastRestCost,
  gainBeastExp,
  generateCapturedBeast,
} from './progression';
// Original G3 scenarios, refreshed for the approved mobile-reference panel formulas and species ranges (revision 3).
const baseline = [
  {
    speciesId: 'combat.wild.species.spirit-fox',
    hash: 'f936b7c1e6130aea7e79dc7e44b396d965fbabfb0bd0c035c493d0ebecc92649',
  },
  {
    speciesId: 'combat.wild.species.rock-boar',
    hash: '16d09edb44c072ee35eaa472d3b32ee2a6812140aae71007f527e2d69a875b88',
  },
  {
    speciesId: 'combat.wild.species.wind-wolf',
    hash: '30d8d1c592ed014867bc385b57f9c1c9c54975900fe716f6a9a09a3b65467c70',
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
  return createHash('sha256').update(JSON.stringify(results)).digest('hex');
}
it.each(baseline)(
  'matches current $speciesId outputs for 128 seeds',
  ({ speciesId, hash }) => expect(digest(speciesId)).toBe(hash),
);


it.each([
  { index: 0, ranges: [[672, 840], [864, 1080], [2880, 3600], [1536, 1920], [864, 1080]], growth: [982, 1030] },
  { index: 1, ranges: [[816, 1020], [864, 1080], [3960, 4950], [1536, 1920], [576, 720]], growth: [1012, 1060] },
  { index: 2, ranges: [[1104, 1380], [624, 780], [2160, 2700], [960, 1200], [864, 1080]], growth: [952, 1000] },
])('new species $index rolls stay within the adopted mobile reference ranges', ({ index, ranges, growth }) => {
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
