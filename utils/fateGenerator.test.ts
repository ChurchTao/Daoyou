// src/lib/utils.test.ts
import { FATE_AFFIX_IDS } from '@/engine/creation/affixes/fateAffixes';
import { FateAffixGenerator } from '@/engine/creation/FateAffixGenerator';
import { generatePreHeavenFates } from './fateGenerator';

test('test 气运生成器', async () => {
  const fates = await generatePreHeavenFates(3);
  console.log(fates);
});

test('test 数值化', async () => {
  const quality = '神品';
  const realm = '炼气';
  const blueprint = {
    affix_ids: [FATE_AFFIX_IDS.FATE_WISDOM],
  };
  const effects = FateAffixGenerator.generate(
    quality,
    realm,
    blueprint.affix_ids,
  );
  console.log(effects);
});
