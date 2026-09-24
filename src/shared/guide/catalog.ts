import alchemyFirstFurnace from '../content/guides/alchemy-first-furnace.json';
import beastPouch from '../content/guides/beast-pouch.json';
import caveLayout from '../content/guides/cave-layout.json';
import forgeFirstWeapon from '../content/guides/forge-first-weapon.json';
import sectDoor from '../content/guides/sect-door.json';
import mapQingxi from '../content/guides/map-qingxi.json';
import { parseGuideLesson, type GuideLesson } from './schema';

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
