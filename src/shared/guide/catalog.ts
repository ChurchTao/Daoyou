import alchemyFirstFurnace from '../content/guides/alchemy-first-furnace.json';
import mapQingxi from '../content/guides/map-qingxi.json';
import { parseGuideLesson, type GuideLesson } from './schema';

const lessons = new Map<string, GuideLesson>([
  ['alchemy-first-furnace', parseGuideLesson(alchemyFirstFurnace)],
  ['map-qingxi', parseGuideLesson(mapQingxi)],
]);

export function getGuideLesson(id: string): GuideLesson | null {
  return lessons.get(id) ?? null;
}
