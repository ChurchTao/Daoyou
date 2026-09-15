import fireCrow from './assets/beast-fire-crow.svg';
import ghostLanternButterfly from './assets/beast-ghost-lantern-butterfly.svg';
import inkJiao from './assets/beast-ink-jiao.svg';
import moonMarten from './assets/beast-moon-marten.svg';
import silverwingMantis from './assets/beast-silverwing-mantis.svg';
import sixEyedApe from './assets/beast-six-eyed-ape.svg';
import snowCrane from './assets/beast-snow-crane.svg';
import thunderPeng from './assets/beast-thunder-peng.svg';

/** Only GameIcon resolves these names. Never construct asset URLs from values. */
export const iconRegistry: ReadonlyMap<string, string> = new Map([
  ['beast-fire-crow', fireCrow],
  ['beast-lantern-butterfly', ghostLanternButterfly],
  ['beast-ink-jiao', inkJiao],
  ['beast-moon-marten', moonMarten],
  ['beast-silverwing-mantis', silverwingMantis],
  ['beast-six-eyed-ape', sixEyedApe],
  ['beast-snow-crane', snowCrane],
  ['beast-thunder-peng', thunderPeng],
]);
