import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { beastPanel, generateStarterBeast, projectBeastRoster } from './index';
import {
  beastRestCost,
  gainBeastExp,
  generateCapturedBeast,
} from './progression';
// Captured before G3: generated facts, panel, progression and roster output.
const baseline = [
  {
    speciesId: 'combat.wild.species.spirit-fox',
    hash: 'dd51602512d5acc200a97f18c6bdd6194651b23f0a45c572d7f0c14af3634cb8',
  },
  {
    speciesId: 'combat.wild.species.rock-boar',
    hash: 'd7556661b8b04c9d2ce2117a91c2e286f92bd80740b4cf8e73dbe51768e5c82d',
  },
  {
    speciesId: 'combat.wild.species.wind-wolf',
    hash: '31e7913f9d825341e1b42eea0439ead5f632bc8dc8f9d5bd46b27e1f0b6f7c1d',
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
  'preserves pre-G3 $speciesId outputs for 128 seeds',
  ({ speciesId, hash }) => expect(digest(speciesId)).toBe(hash),
);
