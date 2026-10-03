export const MINING_RULES_VERSION = 3;
export const MINING_DURATION_MS = 60_000;
export const MINING_SESSION_TTL_MS = 10 * 60_000;
export const MINING_MAX_CASTS = 24;
export const MINING_ANGLE_MIN_MILLI_DEGREES = -70_000;
export const MINING_ANGLE_MAX_MILLI_DEGREES = 70_000;
export const MINING_AIM_PERIOD_MS = 2_800;
export const MINING_CAST_SPEED = 500;
export const MINING_EMPTY_RETRACT_SPEED = 650;
export const MINING_CANVAS = { width: 1_120, height: 630 } as const;
export const MINING_HOOK_ORIGIN = { x: 560, y: 174 } as const;
export const MINING_EXPLOSION_RADIUS = 145;

const MINING_FIELD = {
  left: 72,
  right: MINING_CANVAS.width - 72,
  top: 252,
  bottom: MINING_CANVAS.height - 38,
} as const;

export const MINING_ORE_KINDS = [
  'spirit_crystal',
  'copper_ore',
  'dark_iron',
  'earth_essence',
] as const;
export type MiningOreKind = (typeof MINING_ORE_KINDS)[number];
export type MiningTargetKind = MiningOreKind | 'explosive_barrel';
export type MiningOreSize = 'small' | 'medium' | 'large';

export const MINING_SCORE_TIERS = ['D', 'C', 'B', 'A', 'S'] as const;
export type MiningScoreTier = (typeof MINING_SCORE_TIERS)[number];

interface MiningTargetBase {
  id: string;
  kind: MiningTargetKind;
  x: number;
  y: number;
  radius: number;
  score: number;
  weight: number;
}

export interface MiningOre extends MiningTargetBase {
  category: 'ore';
  kind: MiningOreKind;
  size: MiningOreSize;
}

export interface MiningExplosiveBarrel extends MiningTargetBase {
  category: 'hazard';
  kind: 'explosive_barrel';
  blastRadius: number;
}

export type MiningTarget = MiningOre | MiningExplosiveBarrel;

export interface MiningCastInput {
  atMs: number;
  angleMilliDegrees: number;
}

export interface MiningCatch {
  castIndex: number;
  targetId: string;
  kind: MiningTargetKind;
  score: number;
  weight: number;
  radius: number;
  distance: number;
  returnedAtMs: number;
  destroyedOreIds: string[];
}

export interface MiningOreSummary {
  kind: MiningOreKind;
  count: number;
  score: number;
}

export interface MiningSimulationResult {
  valid: boolean;
  score: number;
  maxScore: number;
  ratio: number;
  tier?: MiningScoreTier;
  qualified: boolean;
  collectedOreIds: string[];
  destroyedOreIds: string[];
  removedTargetIds: string[];
  catches: MiningCatch[];
  availableAtMs: number;
  completedAtMs: number;
  clearedAll: boolean;
  reason?: 'too_many_casts' | 'invalid_time' | 'invalid_angle' | 'hook_busy';
}

interface MiningOreSpec {
  kind: MiningOreKind;
  count: number;
  radius: number;
  score: number;
  weight: number;
  sizes: readonly MiningOreSize[];
}

const MINING_SIZE_RULES = {
  small: { radius: 0.65, score: 0.5, weight: 0.5 },
  medium: { radius: 1, score: 1, weight: 1 },
  large: { radius: 1.55, score: 2.2, weight: 2.1 },
} as const satisfies Record<
  MiningOreSize,
  { radius: number; score: number; weight: number }
>;

export const MINING_ORE_SPECS = [
  {
    kind: 'spirit_crystal',
    count: 6,
    radius: 22,
    score: 90,
    weight: 1,
    sizes: ['small', 'medium', 'large', 'small', 'medium', 'large'],
  },
  {
    kind: 'copper_ore',
    count: 5,
    radius: 29,
    score: 150,
    weight: 2,
    sizes: ['small', 'medium', 'large', 'small', 'large'],
  },
  {
    kind: 'dark_iron',
    count: 3,
    radius: 41,
    score: 260,
    weight: 4,
    sizes: ['small', 'medium', 'large'],
  },
  {
    kind: 'earth_essence',
    count: 2,
    radius: 25,
    score: 420,
    weight: 3,
    sizes: ['medium', 'large'],
  },
] as const satisfies readonly MiningOreSpec[];

function scaledOreValue(base: number, multiplier: number): number {
  return Math.round((base * multiplier) / 10) * 10;
}

export const MINING_MAX_SCORE = MINING_ORE_SPECS.reduce(
  (sum, spec) =>
    sum +
    spec.sizes.reduce(
      (specSum, size) =>
        specSum + scaledOreValue(spec.score, MINING_SIZE_RULES[size].score),
      0,
    ),
  0,
);

function hashSeed(seed: string): number {
  let value = 2166136261;
  for (const char of seed) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0 || 1;
}

function randomSequence(seed: string) {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

function targetOverlaps(
  target: MiningTarget,
  placed: readonly MiningTarget[],
): boolean {
  return placed.some((candidate) => {
    const dx = candidate.x - target.x;
    const dy = candidate.y - target.y;
    const spacing = candidate.radius + target.radius + 10;
    return dx * dx + dy * dy < spacing * spacing;
  });
}

function polarPosition(angleDegrees: number, distance: number) {
  const radians = (angleDegrees / 180) * Math.PI;
  return {
    x: MINING_HOOK_ORIGIN.x + Math.sin(radians) * distance,
    y: MINING_HOOK_ORIGIN.y + Math.cos(radians) * distance,
  };
}

const FORCED_TARGET_POSITIONS: Readonly<
  Record<string, { x: number; y: number }>
> = {
  'spirit_crystal:0': polarPosition(-32, 280),
  'earth_essence:1': polarPosition(-32, 445),
  'explosive_barrel:0': polarPosition(34, 350),
  'copper_ore:0': polarPosition(34, 445),
};

const PROTECTED_LANES = [
  { angleMilliDegrees: -32_000, distance: 520 },
  { angleMilliDegrees: 34_000, distance: 500 },
] as const;

function targetInsideField(target: MiningTarget): boolean {
  return (
    target.x - target.radius >= MINING_FIELD.left &&
    target.x + target.radius <= MINING_FIELD.right &&
    target.y - target.radius >= MINING_FIELD.top &&
    target.y + target.radius <= MINING_FIELD.bottom
  );
}

function rayDirection(angleMilliDegrees: number) {
  const radians = (angleMilliDegrees / 1_000 / 180) * Math.PI;
  return { x: Math.sin(radians), y: Math.cos(radians) };
}

function rayCircleDistance(
  direction: { x: number; y: number },
  target: MiningTarget,
): number | undefined {
  const relativeX = target.x - MINING_HOOK_ORIGIN.x;
  const relativeY = target.y - MINING_HOOK_ORIGIN.y;
  const projection = relativeX * direction.x + relativeY * direction.y;
  if (projection <= 0) return undefined;
  const perpendicularSquared =
    relativeX * relativeX + relativeY * relativeY - projection * projection;
  const radiusSquared = target.radius * target.radius;
  if (perpendicularSquared > radiusSquared) return undefined;
  return projection - Math.sqrt(radiusSquared - perpendicularSquared);
}

function blocksProtectedLane(target: MiningTarget): boolean {
  if (FORCED_TARGET_POSITIONS[target.id]) return false;
  return PROTECTED_LANES.some((lane) => {
    const distance = rayCircleDistance(
      rayDirection(lane.angleMilliDegrees),
      target,
    );
    return distance !== undefined && distance <= lane.distance;
  });
}

function fallbackPosition(
  target: MiningTarget,
  placed: readonly MiningTarget[],
): { x: number; y: number } {
  for (
    let y = MINING_FIELD.top + target.radius;
    y <= MINING_FIELD.bottom - target.radius;
    y += 8
  ) {
    for (
      let x = MINING_FIELD.left + target.radius;
      x <= MINING_FIELD.right - target.radius;
      x += 8
    ) {
      const candidate = { ...target, x, y };
      if (
        !targetOverlaps(candidate, placed) &&
        !blocksProtectedLane(candidate)
      )
        return { x, y };
    }
  }
  throw new Error(`Unable to place mining target ${target.id}`);
}

function createMiningTargets(): MiningTarget[] {
  const ores = MINING_ORE_SPECS.flatMap((spec) =>
    spec.sizes.map((size, index): MiningOre => {
      const sizeRule = MINING_SIZE_RULES[size];
      return {
        id: `${spec.kind}:${index}`,
        category: 'ore',
        kind: spec.kind,
        size,
        x: 0,
        y: 0,
        radius: Math.round(spec.radius * sizeRule.radius),
        score: scaledOreValue(spec.score, sizeRule.score),
        weight: Math.max(
          0.25,
          Math.round(spec.weight * sizeRule.weight * 100) / 100,
        ),
      };
    }),
  );
  const barrels: MiningExplosiveBarrel[] = Array.from(
    { length: 2 },
    (_, index) => ({
      id: `explosive_barrel:${index}`,
      category: 'hazard',
      kind: 'explosive_barrel',
      x: 0,
      y: 0,
      radius: index === 0 ? 30 : 34,
      score: 0,
      weight: 1,
      blastRadius: MINING_EXPLOSION_RADIUS,
    }),
  );
  return [...ores, ...barrels];
}

export function createMiningField(seed: string): MiningTarget[] {
  const random = randomSequence(seed);
  const targets = createMiningTargets();
  const placed: MiningTarget[] = targets
    .filter((target) => FORCED_TARGET_POSITIONS[target.id])
    .map((target) => ({
      ...target,
      ...FORCED_TARGET_POSITIONS[target.id]!,
    }));

  for (const target of placed) {
    const precedingTargets = placed.slice(0, placed.indexOf(target));
    if (
      !targetInsideField(target) ||
      targetOverlaps(target, precedingTargets)
    )
      throw new Error(`Invalid forced mining target ${target.id}`);
  }

  for (const target of targets) {
    if (FORCED_TARGET_POSITIONS[target.id]) continue;
    let positioned: MiningTarget | undefined;
    for (let attempt = 0; attempt < 600; attempt += 1) {
      const candidate = {
        ...target,
        x:
          MINING_FIELD.left +
          target.radius +
          random() *
            (MINING_FIELD.right - MINING_FIELD.left - target.radius * 2),
        y:
          MINING_FIELD.top +
          target.radius +
          random() *
            (MINING_FIELD.bottom - MINING_FIELD.top - target.radius * 2),
      };
      if (
        !targetOverlaps(candidate, placed) &&
        !blocksProtectedLane(candidate)
      ) {
        positioned = candidate;
        break;
      }
    }
    placed.push(
      positioned ?? {
        ...target,
        ...fallbackPosition(target, placed),
      },
    );
  }

  const byId = new Map(placed.map((target) => [target.id, target]));
  return targets.map((target) => byId.get(target.id)!);
}

export function miningLoadedRetractSpeed(weight: number): number {
  const safeWeight = Math.max(0.25, weight);
  return Math.min(650, Math.max(90, 520 / safeWeight ** 0.85));
}

export function miningAimAngleAt(atMs: number): number {
  const position =
    ((Math.max(0, atMs) % MINING_AIM_PERIOD_MS) / MINING_AIM_PERIOD_MS) * 2;
  const progress = position <= 1 ? position : 2 - position;
  return (
    MINING_ANGLE_MIN_MILLI_DEGREES +
    progress * (MINING_ANGLE_MAX_MILLI_DEGREES - MINING_ANGLE_MIN_MILLI_DEGREES)
  );
}

export function miningScoreTier(
  score: number,
  maxScore = MINING_MAX_SCORE,
): MiningScoreTier | undefined {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  if (ratio < 0.2) return undefined;
  if (ratio < 0.35) return 'D';
  if (ratio < 0.5) return 'C';
  if (ratio < 0.65) return 'B';
  if (ratio < 0.8) return 'A';
  return 'S';
}

export function summarizeMiningCatches(
  catches: readonly Pick<MiningCatch, 'kind' | 'score'>[],
): MiningOreSummary[] {
  return MINING_ORE_KINDS.flatMap((kind) => {
    const collected = catches.filter((item) => item.kind === kind);
    return collected.length
      ? [
          {
            kind,
            count: collected.length,
            score: collected.reduce((sum, item) => sum + item.score, 0),
          },
        ]
      : [];
  });
}

function hookMaximumDistance(direction: { x: number; y: number }): number {
  const distances = [
    direction.y > 0
      ? (MINING_CANVAS.height - 16 - MINING_HOOK_ORIGIN.y) / direction.y
      : Number.POSITIVE_INFINITY,
    direction.x > 0
      ? (MINING_CANVAS.width - 16 - MINING_HOOK_ORIGIN.x) / direction.x
      : Number.POSITIVE_INFINITY,
    direction.x < 0
      ? (16 - MINING_HOOK_ORIGIN.x) / direction.x
      : Number.POSITIVE_INFINITY,
  ];
  return Math.min(...distances.filter((distance) => distance > 0));
}

function findExplosionVictims(
  field: readonly MiningTarget[],
  barrel: MiningExplosiveBarrel,
  removed: ReadonlySet<string>,
): MiningOre[] {
  return field.filter((target): target is MiningOre => {
    if (target.category !== 'ore' || removed.has(target.id)) return false;
    return (
      Math.hypot(target.x - barrel.x, target.y - barrel.y) <=
      barrel.blastRadius + target.radius
    );
  });
}

export function simulateMiningTranscript(
  seed: string,
  casts: readonly MiningCastInput[],
): MiningSimulationResult {
  const field = createMiningField(seed);
  const oreTargets = field.filter(
    (target): target is MiningOre => target.category === 'ore',
  );
  const maxScore = oreTargets.reduce((sum, ore) => sum + ore.score, 0);
  if (casts.length > MINING_MAX_CASTS)
    return invalidSimulation(maxScore, 'too_many_casts');

  const collected = new Set<string>();
  const destroyed = new Set<string>();
  const removed = new Set<string>();
  const catches: MiningCatch[] = [];
  let availableAtMs = 0;
  let score = 0;

  for (let castIndex = 0; castIndex < casts.length; castIndex += 1) {
    const cast = casts[castIndex]!;
    if (
      !Number.isSafeInteger(cast.atMs) ||
      cast.atMs < 0 ||
      cast.atMs >= MINING_DURATION_MS
    )
      return invalidSimulation(maxScore, 'invalid_time', {
        score,
        availableAtMs,
        catches,
        collected,
        destroyed,
        removed,
      });
    if (
      !Number.isSafeInteger(cast.angleMilliDegrees) ||
      cast.angleMilliDegrees < MINING_ANGLE_MIN_MILLI_DEGREES ||
      cast.angleMilliDegrees > MINING_ANGLE_MAX_MILLI_DEGREES ||
      Math.abs(
        cast.angleMilliDegrees - Math.round(miningAimAngleAt(cast.atMs)),
      ) > 2
    )
      return invalidSimulation(maxScore, 'invalid_angle', {
        score,
        availableAtMs,
        catches,
        collected,
        destroyed,
        removed,
      });
    if (cast.atMs < Math.ceil(availableAtMs))
      return invalidSimulation(maxScore, 'hook_busy', {
        score,
        availableAtMs,
        catches,
        collected,
        destroyed,
        removed,
      });

    const direction = rayDirection(cast.angleMilliDegrees);
    const maximumDistance = hookMaximumDistance(direction);
    const hit = field
      .filter((target) => !removed.has(target.id))
      .map((target) => ({
        target,
        distance: rayCircleDistance(direction, target),
      }))
      .filter(
        (
          candidate,
        ): candidate is { target: MiningTarget; distance: number } =>
          candidate.distance !== undefined &&
          candidate.distance <= maximumDistance,
      )
      .sort((left, right) => left.distance - right.distance)[0];
    const distance = hit?.distance ?? maximumDistance;
    const castDuration = (distance / MINING_CAST_SPEED) * 1_000;
    const retractSpeed =
      hit?.target.category === 'ore'
        ? miningLoadedRetractSpeed(hit.target.weight)
        : MINING_EMPTY_RETRACT_SPEED;
    availableAtMs =
      cast.atMs + castDuration + (distance / retractSpeed) * 1_000;

    if (!hit) continue;
    const target = hit.target;
    removed.add(target.id);
    const destroyedOreIds =
      target.category === 'hazard'
        ? findExplosionVictims(field, target, removed).map((ore) => ore.id)
        : [];
    for (const id of destroyedOreIds) {
      destroyed.add(id);
      removed.add(id);
    }
    if (target.category === 'ore') {
      collected.add(target.id);
      score += target.score;
    }
    catches.push({
      castIndex,
      targetId: target.id,
      kind: target.kind,
      score: target.score,
      weight: target.weight,
      radius: target.radius,
      distance: hit.distance,
      returnedAtMs: availableAtMs,
      destroyedOreIds,
    });
  }

  const ratio = score / maxScore;
  const tier = miningScoreTier(score, maxScore);
  const clearedAll = oreTargets.every((ore) => removed.has(ore.id));
  return {
    valid: true,
    score,
    maxScore,
    ratio,
    ...(tier ? { tier } : {}),
    qualified: Boolean(tier),
    collectedOreIds: [...collected],
    destroyedOreIds: [...destroyed],
    removedTargetIds: [...removed],
    catches,
    availableAtMs,
    completedAtMs: clearedAll
      ? availableAtMs
      : Math.max(MINING_DURATION_MS, availableAtMs),
    clearedAll,
  };
}

function invalidSimulation(
  maxScore: number,
  reason: NonNullable<MiningSimulationResult['reason']>,
  partial?: {
    score: number;
    availableAtMs: number;
    catches: MiningCatch[];
    collected: ReadonlySet<string>;
    destroyed: ReadonlySet<string>;
    removed: ReadonlySet<string>;
  },
): MiningSimulationResult {
  const score = partial?.score ?? 0;
  return {
    valid: false,
    score,
    maxScore,
    ratio: score / maxScore,
    qualified: false,
    collectedOreIds: [...(partial?.collected ?? [])],
    destroyedOreIds: [...(partial?.destroyed ?? [])],
    removedTargetIds: [...(partial?.removed ?? [])],
    catches: partial?.catches ?? [],
    availableAtMs: partial?.availableAtMs ?? 0,
    completedAtMs: partial?.availableAtMs ?? 0,
    clearedAll: false,
    reason,
  };
}
