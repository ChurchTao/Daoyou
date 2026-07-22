export const TIANYAN_SECT_ID = 'tianyan';
export const TIANYAN_DERIVATION = 'sect.tianyan.derivation';
export const TIANYAN_ELEMENT_SEAL = 'sect.tianyan.element-seal';
export const TIANYAN_BURN = 'sect.tianyan.burn';
export const TIANYAN_LAVA = 'sect.tianyan.lava';

export const TIANYAN_HETU_PATH_ID = 'hetu-evolution';
export const TIANYAN_LUOSHU_PATH_ID = 'luoshu-control';

export const TIANYAN_METHOD_IDS = [
  'tianyan-canon',
  'wood-vitality',
  'fire-illumination',
  'earth-bearing',
  'metal-severing',
  'water-flowing',
] as const;

export const TIANYAN_VISIBLE_ABILITY_IDS = [
  'primordial-ray',
  'verdant-pulse',
  'myriad-wood-renewal',
  'flowing-flame',
  'lotus-in-fire',
  'earth-bearing-seal',
  'boundless-earth',
  'metal-cloud-cutter',
  'white-star-breaker',
  'dark-water-return',
  'heavenly-river-cleansing',
  'shift-palace',
  'five-qi-repository',
] as const;

export const TIANYAN_LANDING_ABILITY_IDS = [
  'verdant-pulse',
  'flowing-flame',
  'earth-bearing-seal',
  'metal-cloud-cutter',
  'white-star-breaker',
  'dark-water-return',
] as const;

export type TianyanLandingAbilityId =
  (typeof TIANYAN_LANDING_ABILITY_IDS)[number];

export const TIANYAN_MAIN_DAMAGE_MEMORY = 'sect.tianyan.main-damage';
export const TIANYAN_INNER_NOURISH = 'sect.tianyan.inner-nourish';
export const TIANYAN_HIDDEN_FIRE = 'sect.tianyan.hidden-fire';
export const TIANYAN_HIDDEN_EDGE = 'sect.tianyan.hidden-edge';
export const TIANYAN_REVERSE_SHIFT = 'sect.tianyan.reverse-shift';
export const TIANYAN_CHAIN_CONTROL = 'sect.tianyan.chain-control';
export const TIANYAN_FIRST_CHANGE = 'sect.tianyan.first-change';
export const TIANYAN_SHATTER_COOLDOWN = 'sect.tianyan.shatter-cooldown';
export const TIANYAN_DISPEL_TRUTH_COOLDOWN = 'sect.tianyan.dispel-truth-cooldown';

export const TIANYAN_TECHNIQUE = 'landing-technique';
export const TIANYAN_INNER_ART = 'inner-art';
export const TIANYAN_SECRET_ART = 'secret-art';
