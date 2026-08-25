export const PERSONAL_STORY_CONSUMER_NAME = 'personal-story-projector-v1';
export const PERSONAL_TRAVEL_STORY_CONSUMER_NAME =
  'personal-travel-story-projector-v1';
export const PERSONAL_STORY_COOLDOWN_MS = 24 * 60 * 60 * 1_000;
export const PERSONAL_STORY_LIVE_EVENT_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
export const PERSONAL_STORY_ECHO_DELAY_MS = 12 * 60 * 60 * 1_000;

export function personalStoryEchoDelayMs(): number {
  const configuredHours = Number.parseFloat(
    process.env.PERSONAL_STORY_ECHO_DELAY_HOURS ?? '',
  );
  if (Number.isFinite(configuredHours)) {
    return Math.max(0, configuredHours) * 60 * 60 * 1_000;
  }
  return process.env.NODE_ENV === 'production'
    ? PERSONAL_STORY_ECHO_DELAY_MS
    : 0;
}

export function isNextPersonalStoryGenerationDue(input: {
  activeThreadId: string | null;
  cooldownUntil: Date | null;
  now?: Date;
}): boolean {
  return (
    input.activeThreadId === null &&
    input.cooldownUntil !== null &&
    input.cooldownUntil <= (input.now ?? new Date())
  );
}

export function isPersonalStoryEnabledForCultivator(
  cultivatorId: string,
): boolean {
  if (process.env.PERSONAL_STORY_ENABLED === 'true') return true;

  const allowlist = new Set(
    (process.env.PERSONAL_STORY_CULTIVATOR_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  );
  if (allowlist.size > 0) return allowlist.has(cultivatorId);
  if (process.env.PERSONAL_STORY_ENABLED === 'false') return false;

  return process.env.NODE_ENV !== 'production';
}

export function personalTravelStoryChance(): number {
  const configured = Number.parseFloat(
    process.env.PERSONAL_STORY_TRAVEL_EVENT_CHANCE ?? '',
  );
  if (Number.isFinite(configured)) {
    return Math.min(1, Math.max(0, configured));
  }
  return process.env.NODE_ENV === 'production' ? 0.35 : 1;
}
