import type { SectRoomActorDefinition } from '@daoyou/game-rules/sect-organization';

const portraitsByRole: Readonly<Record<string, string>> = {
  'affairs.daily': 'noble-m',
  'affairs.weekly': 'merchant-f',
  'affairs.promotion': 'elder-m',
  'hall.registry': 'noble-m',
  'hall.stipend': 'merchant-f',
  'treasury.keeper': 'merchant-m',
  'industries.construction': 'servant-m',
  'industries.donation': 'merchant-f',
  'archive.keeper': 'elder-f',
  'paths.guide': 'elder-m',
  'arena.instructor': 'disciple-m',
  'arena.marshal': 'disciple-f',
  'cultivation.keeper': 'elder-f',
  'alchemy.keeper': 'elder-m',
  'refinery.keeper': 'servant-m',
  'spiritVein.keeper': 'wanderer-m',
  'herbGarden.keeper': 'servant-f',
  'gate.keeper': 'disciple-m',
  'formation.warden': 'elder-m',
};

const portraitsByActor: Readonly<Record<string, string>> = {
  'youdu-bai-shoubu': 'elder-m',
  'youdu-chu-yingui': 'elder-f',
  'youdu-fafeng': 'elder-f',
  'jiujie-weekly': 'elder-m',
  'wuxiang-due': 'abbot',
  'wuxiang-kongzang': 'abbot',
  'wuxiang-kongdu': 'abbot',
  'wuxiang-jiefeng': 'abbot',
  'wuxiang-zhiguan': 'abbot',
  'wuxiang-mingmen': 'abbot',
};

export function getSectRoomPortrait(
  roomKey: string,
  actor: SectRoomActorDefinition,
) {
  if (actor.appearance === 'facility') return undefined;
  const key =
    portraitsByActor[actor.id] ??
    (actor.id.startsWith('wuxiang-')
      ? 'monk'
      : portraitsByRole[`${roomKey}.${actor.roleKey}`]);
  return key ? `icon:portrait-${key}` : undefined;
}
