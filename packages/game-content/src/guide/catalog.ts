import alchemyFirstFurnace from './data/alchemy-first-furnace.json' with { type: 'json' };
import beastPouch from './data/beast-pouch.json' with { type: 'json' };
import caveLayout from './data/cave-layout.json' with { type: 'json' };
import cultivatorBasics from './data/cultivator-basics.json' with { type: 'json' };
import firstAttributes from './data/first-attributes.json' with { type: 'json' };
import forgeFirstWeapon from './data/forge-first-weapon.json' with { type: 'json' };
import inventoryBasics from './data/inventory-basics.json' with { type: 'json' };
import sectFirstPath from './data/sect-first-path.json' with { type: 'json' };
import sectDoor from './data/sect-door.json' with { type: 'json' };
import mapQingxi from './data/map-qingxi.json' with { type: 'json' };
import weaponEquip from './data/weapon-equip.json' with { type: 'json' };
import {
  parseGuideLesson,
  type GuideLesson,
} from '@daoyou/game-domain/guide';

const lessons = new Map<string, GuideLesson>([
  ['alchemy-first-furnace', parseGuideLesson(alchemyFirstFurnace)],
  ['map-qingxi', parseGuideLesson(mapQingxi)],
  ['beast-pouch', parseGuideLesson(beastPouch)],
  ['cave-layout', parseGuideLesson(caveLayout)],
  ['cultivator-basics', parseGuideLesson(cultivatorBasics)],
  ['first-attributes', parseGuideLesson(firstAttributes)],
  ['forge-first-weapon', parseGuideLesson(forgeFirstWeapon)],
  ['inventory-basics', parseGuideLesson(inventoryBasics)],
  ['sect-first-path', parseGuideLesson(sectFirstPath)],
  ['sect-door', parseGuideLesson(sectDoor)],
  ['weapon-equip', parseGuideLesson(weaponEquip)],
]);

export function getGuideLesson(id: string): GuideLesson | null {
  return lessons.get(id) ?? null;
}
