import alchemyFirstFurnace from './data/alchemy-first-furnace.json' with { type: 'json' };
import beastPouch from './data/beast-pouch.json' with { type: 'json' };
import caveLayout from './data/cave-layout.json' with { type: 'json' };
import forgeFirstWeapon from './data/forge-first-weapon.json' with { type: 'json' };
import sectDoor from './data/sect-door.json' with { type: 'json' };
import mapQingxi from './data/map-qingxi.json' with { type: 'json' };
import {
  parseGuideLesson,
  type GuideLesson,
} from '@daoyou/game-domain/guide';

const lessons = new Map<string, GuideLesson>([
  ['alchemy-first-furnace', parseGuideLesson(alchemyFirstFurnace)],
  ['map-qingxi', parseGuideLesson(mapQingxi)],
  ['beast-pouch', parseGuideLesson(beastPouch)],
  ['cave-layout', parseGuideLesson(caveLayout)],
  ['forge-first-weapon', parseGuideLesson(forgeFirstWeapon)],
  ['sect-door', parseGuideLesson(sectDoor)],
]);

export function getGuideLesson(id: string): GuideLesson | null {
  return lessons.get(id) ?? null;
}
