import alchemyFirstFurnace from '../content/guides/alchemy-first-furnace.json' with { type: 'json' };
import beastPouch from '../content/guides/beast-pouch.json' with { type: 'json' };
import caveLayout from '../content/guides/cave-layout.json' with { type: 'json' };
import forgeFirstWeapon from '../content/guides/forge-first-weapon.json' with { type: 'json' };
import sectDoor from '../content/guides/sect-door.json' with { type: 'json' };
import mapQingxi from '../content/guides/map-qingxi.json' with { type: 'json' };
import { parseGuideLesson, type GuideLesson } from './schema.js';

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
