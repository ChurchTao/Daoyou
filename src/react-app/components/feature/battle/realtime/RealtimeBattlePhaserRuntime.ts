import type {
  CombatControlVisual,
  CombatImpactCue,
  CombatVisualActionInput,
  CombatVisualFact,
  CombatVisualSpec,
  CombatVisualTimeline,
} from '@shared/engine/battle-v5/presentation';
import type {
  BattlePresentationEntityV1,
  BattlePresentationSnapshotV1,
  BattlePresentationTeamV1,
} from '@shared/online-battle/BattlePresentation';
import * as Phaser from 'phaser';
import {
  realtimeBattleResourceAssets,
  realtimeBattleResourceTexture,
} from './realtimeBattleResourceAssets';

type RealtimeBattleEntity = BattlePresentationEntityV1;
type RealtimeBattleSnapshot = BattlePresentationSnapshotV1;
type RealtimeBattleTeam = BattlePresentationTeamV1;
type RealtimeBattleResource = RealtimeBattleEntity['combatResources'][number];

type BattleStageProfile = 'portrait' | 'compact-landscape' | 'wide';

interface StageSize {
  width: number;
  height: number;
  profile: BattleStageProfile;
}

interface StageSafeBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const PORTRAIT_STAGE: StageSize = {
  width: 720,
  height: 1080,
  profile: 'portrait',
};
const COMPACT_LANDSCAPE_STAGE: StageSize = {
  width: 1200,
  height: 800,
  profile: 'compact-landscape',
};
const WIDE_STAGE: StageSize = {
  width: 1440,
  height: 810,
  profile: 'wide',
};
const FONT_FAMILY = 'LXGWWenKai, serif';
const TEXT_OUTLINE_COLOR = '#eee7d6';
const UNIT_NAME_DISC_TEXTURE = 'realtime-unit-name-disc';
const UNIT_VITAL_TRACK_TEXTURE = 'realtime-unit-vital-track';
const UNIT_VITAL_HP_TEXTURE = 'realtime-unit-vital-hp';
const UNIT_VITAL_MP_TEXTURE = 'realtime-unit-vital-mp';
const UNIT_SHIELD_TEXTURE = 'realtime-unit-shield';
const UNIT_NAME_DISC_SCALE = 2;
const UNIT_VITAL_SCALE = 2.18;

function outlinedText(strokeThickness: number) {
  return {
    stroke: TEXT_OUTLINE_COLOR,
    strokeThickness,
  };
}

type FormationPoint = { x: number; y: number };

interface FormationRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const FORMATION_OWNER_ORDER = [
  'sikong-ye',
  'shen-yanqiu',
  'gu-tingchuan',
  'qing-li',
  'xie-wujiu',
  'lu-xingzhou',
];

interface RealtimeBattlePhaserArguments {
  root: HTMLElement;
  initialSnapshot: RealtimeBattleSnapshot;
  onState: (snapshot: RealtimeBattleSnapshot) => void;
  onFocus: (entityId: string) => void;
}

export interface RealtimeBattlePhaserController {
  syncSnapshot: (snapshot: RealtimeBattleSnapshot) => void;
  playTimeline: (timeline: CombatVisualTimeline, offsetMs?: number) => void;
  focus: (entityId: string) => void;
  setCommandSelection: (state: {
    actorUnitId?: string;
    legalTargetIds: readonly string[];
    lockedUnitIds: readonly string[];
    submitting: boolean;
  }) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  destroy: () => void;
}

interface EntityVisual {
  container: Phaser.GameObjects.Container;
  selection: Phaser.GameObjects.Arc;
  actorSelection: Phaser.GameObjects.Arc;
  targetSelection: Phaser.GameObjects.Arc;
  commandStateText: Phaser.GameObjects.Text;
  vitalLayer: Phaser.GameObjects.Container;
  hpBrush: Phaser.GameObjects.Image;
  qiBrush: Phaser.GameObjects.Image;
  hpBrushTextureKey: string;
  qiBrushTextureKey: string;
  hpRatio?: number;
  qiRatio?: number;
  shieldArt: Phaser.GameObjects.Image;
  shieldTextureKey: string;
  shieldStrength?: number;
  name: Phaser.GameObjects.Text;
  resourceLayer: Phaser.GameObjects.Container;
  resources: Map<string, ResourceVisual>;
  resourceHeight: number;
  statusLayer: Phaser.GameObjects.Container;
  statuses: Map<string, StatusVisual>;
  statusHeight: number;
  nameControlFx: Phaser.GameObjects.Graphics;
  controlMode?: CombatControlVisual;
  isPet: boolean;
  baseRadius: number;
  radius: number;
}

interface ResourceVisual {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  iconPulse: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  currentValue: Phaser.GameObjects.Text;
  maxValue: Phaser.GameObjects.Text;
  delta: Phaser.GameObjects.Text;
  width: number;
  height: number;
  barHeight: number;
}

type StatusTone = 'action' | 'control' | 'buff' | 'debuff';

interface StatusEntry {
  readonly key: string;
  readonly label: string;
  readonly tone: StatusTone;
}

interface StatusVisual {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  width: number;
  height: number;
}

interface ResourceCueState {
  actionId: string;
  delta: number;
  hideTimer?: Phaser.Time.TimerEvent;
}

interface QueuedImpactCue {
  cue: CombatImpactCue;
  action: CombatVisualActionInput;
}

function visualColor(visual: CombatVisualSpec) {
  const elementColors: Partial<
    Record<NonNullable<CombatVisualSpec['element']>, number>
  > = {
    fire: 0xa43c2d,
    water: 0x356f80,
    wood: 0x3d8063,
    metal: 0x8b4a50,
    earth: 0x8a682c,
    wind: 0x477768,
    ice: 0x4d7988,
    thunder: 0x665795,
  };
  if (visual.element && visual.element !== 'none') {
    return elementColors[visual.element] ?? 0x356f80;
  }
  if (visual.discipline === 'true') return 0x74517f;
  if (visual.discipline === 'physical') return 0x982d38;
  if (visual.impact === 'heal') return 0x3d8063;
  if (visual.impact === 'shield') return 0xa87918;
  return 0x356f80;
}

function colorHex(color: number) {
  return `#${color.toString(16).padStart(6, '0')}`;
}

function smoothStep(edge0: number, edge1: number, value: number) {
  const progress = Phaser.Math.Clamp(
    (value - edge0) / Math.max(edge1 - edge0, Number.EPSILON),
    0,
    1,
  );
  return progress * progress * (3 - 2 * progress);
}

const vitalProgressMaps = new Map<string, Float32Array>();

function vitalProgressMap(
  half: 'upper' | 'lower',
  width: number,
  height: number,
) {
  const key = `${half}:${width}x${height}`;
  const cached = vitalProgressMaps.get(key);
  if (cached) return cached;
  const centerX = width / 2;
  const centerY = height / 2;
  const progressMap = new Float32Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let angle = Math.atan2(y - centerY, x - centerX);
      if (angle < 0) angle += Math.PI * 2;
      let progress: number;
      if (half === 'upper') {
        if (angle < 0.28) angle += Math.PI * 2;
        progress = (angle - Math.PI) / Math.PI;
      } else {
        if (angle > Math.PI * 2 - 0.28) angle -= Math.PI * 2;
        progress = angle / Math.PI;
      }
      progressMap[y * width + x] = progress;
    }
  }
  vitalProgressMaps.set(key, progressMap);
  return progressMap;
}

function damageColor(
  damageType: Extract<CombatImpactCue, { kind: 'damage' }>['damageType'],
) {
  switch (damageType) {
    case 'physical':
      return 0x9c2f3b;
    case 'magical':
      return 0x28758d;
    case 'true':
      return 0x74517f;
    case 'dot':
      return 0x7f405d;
  }
}

function selectStage(width: number, height: number): StageSize {
  const aspect = width / Math.max(height, 1);
  if (aspect < 0.9) return { ...PORTRAIT_STAGE };
  if (height < 680 || aspect < 1.55) return { ...COMPACT_LANDSCAPE_STAGE };
  return { ...WIDE_STAGE };
}

function stageSafeBounds(stage: StageSize): StageSafeBounds {
  const portrait = stage.profile === 'portrait';
  const compact = stage.profile === 'compact-landscape';
  const sideRatio = portrait ? 0.07 : compact ? 0.055 : 0.05;
  const topRatio = portrait ? 0.145 : compact ? 0.14 : 0.13;
  const bottomRatio = portrait ? 0.26 : compact ? 0.27 : 0.235;
  return {
    left: stage.width * sideRatio,
    right: stage.width * (1 - sideRatio),
    top: stage.height * topRatio,
    bottom: stage.height * (1 - bottomRatio),
  };
}

function formationRadius(
  entity: RealtimeBattleEntity,
  stage: StageSize,
  teamSize: number,
) {
  const base =
    stage.profile === 'portrait'
      ? 58
      : stage.profile === 'compact-landscape'
        ? 66
        : 76;
  const rosterScale = teamSize <= 1 ? 1.18 : teamSize === 2 ? 1.1 : 1;
  const cultivatorRadius = base * rosterScale;
  return entity.kind === 'spirit-pet'
    ? Math.round(cultivatorRadius * 0.68)
    : Math.round(cultivatorRadius);
}

function formationBackY(team: RealtimeBattleTeam, stage: StageSize) {
  const safe = stageSafeBounds(stage);
  const available = safe.bottom - safe.top;
  const teamRatio = team === 'enemies' ? 0.2 : 0.8;
  return safe.top + available * teamRatio;
}

function formationPetOffset(team: RealtimeBattleTeam, stage: StageSize) {
  const distance =
    stage.profile === 'portrait'
      ? 116
      : stage.profile === 'compact-landscape'
        ? 126
        : 142;
  const angle = (35 * Math.PI) / 180;
  const frontDirection = team === 'enemies' ? 1 : -1;
  const sideDirection = team === 'enemies' ? 1 : -1;
  return {
    x: sideDirection * Math.sin(angle) * distance,
    y: frontDirection * Math.cos(angle) * distance,
  };
}

function formationSlotX(slot: number, count: number, stage: StageSize) {
  const safe = stageSafeBounds(stage);
  const center = (safe.left + safe.right) / 2;
  if (count <= 1) return center;
  const widthRatio = count === 2 ? 0.34 : count === 3 ? 0.58 : 0.7;
  const span = (safe.right - safe.left) * widthRatio;
  return center - span / 2 + (span * slot) / (count - 1);
}

function formationVisualRects(
  entity: RealtimeBattleEntity,
  point: FormationPoint,
  stage: StageSize,
  teamSize: number,
): FormationRect[] {
  const radius = formationRadius(entity, stage, teamSize);
  const isPet = entity.kind === 'spirit-pet';
  const bodyPadding = isPet ? 22 : 30;
  const upperHalfWidth = isPet ? Math.max(78, radius) : Math.max(112, radius);
  const lowerHalfWidth = isPet ? Math.max(62, radius) : Math.max(104, radius);
  const resourceRows = entity.combatResources.length;
  const statusCount = entity.actionStates.length + entity.effects.length;
  const statusRows = Math.ceil(
    statusCount / (stage.profile === 'wide' ? 2 : 1),
  );
  const annotationHeight =
    (resourceRows > 0 ? resourceRows * (isPet ? 30 : 36) + 8 : 0) +
    statusRows * (isPet ? 25 : 29);
  return [
    {
      left: point.x - radius - bodyPadding,
      right: point.x + radius + bodyPadding,
      top: point.y - radius - bodyPadding,
      bottom: point.y + radius + bodyPadding,
    },
    {
      left: point.x - upperHalfWidth,
      right: point.x + upperHalfWidth,
      top: point.y - radius - (isPet ? 78 : 102),
      bottom: point.y - radius + 4,
    },
    {
      left: point.x - lowerHalfWidth,
      right: point.x + lowerHalfWidth,
      top: point.y + radius + 2,
      bottom:
        point.y +
        radius +
        Math.max(isPet ? 82 : 100, annotationHeight + (isPet ? 26 : 32)),
    },
  ];
}

function formationRectsOverlap(
  left: FormationRect,
  right: FormationRect,
  gap: number,
) {
  return !(
    left.right + gap <= right.left ||
    right.right + gap <= left.left ||
    left.bottom + gap <= right.top ||
    right.bottom + gap <= left.top
  );
}

function formationIsReadable(
  entities: readonly RealtimeBattleEntity[],
  positions: ReadonlyMap<string, FormationPoint>,
  stage: StageSize,
) {
  const safe = stageSafeBounds(stage);
  const teamSizes = new Map<RealtimeBattleTeam, number>();
  const rectsByTeam = new Map<RealtimeBattleTeam, FormationRect[]>();
  for (const team of ['enemies', 'allies'] as const) {
    teamSizes.set(
      team,
      entities.filter(
        (entity) => entity.team === team && entity.kind === 'cultivator',
      ).length,
    );
    rectsByTeam.set(team, []);
  }
  for (const entity of entities) {
    const point = positions.get(entity.id);
    if (!point) continue;
    const rects = formationVisualRects(
      entity,
      point,
      stage,
      teamSizes.get(entity.team) ?? 1,
    );
    if (
      rects.some((rect) => rect.left < safe.left || rect.right > safe.right)
    ) {
      return false;
    }
    rectsByTeam.get(entity.team)?.push(...rects);
  }
  const enemies = rectsByTeam.get('enemies') ?? [];
  const allies = rectsByTeam.get('allies') ?? [];
  const readabilityGap = stage.profile === 'wide' ? 18 : 14;
  return !enemies.some((enemy) =>
    allies.some((ally) => formationRectsOverlap(enemy, ally, readabilityGap)),
  );
}

function projectFormation(
  entities: readonly RealtimeBattleEntity[],
  stage: StageSize,
) {
  const groupsByTeam = new Map<
    RealtimeBattleTeam,
    Array<{ owner?: RealtimeBattleEntity; pet?: RealtimeBattleEntity }>
  >();
  for (const team of ['enemies', 'allies'] as const) {
    const teamEntities = entities.filter((entity) => entity.team === team);
    const owners = teamEntities
      .filter((entity) => entity.kind === 'cultivator')
      .sort(
        (left, right) =>
          (left.slot ?? FORMATION_OWNER_ORDER.indexOf(left.id)) -
          (right.slot ?? FORMATION_OWNER_ORDER.indexOf(right.id)),
      )
      .slice(0, 4);
    const ownerIds = new Set(owners.map((owner) => owner.id));
    const groups: Array<{
      owner?: RealtimeBattleEntity;
      pet?: RealtimeBattleEntity;
    }> = owners.map((owner) => ({
      owner,
      pet: teamEntities.find((entity) => entity.ownerId === owner.id),
    }));
    const unownedPets = teamEntities.filter(
      (entity) =>
        entity.kind === 'spirit-pet' &&
        (!entity.ownerId || !ownerIds.has(entity.ownerId)),
    );
    groups.push(
      ...unownedPets
        .slice(0, Math.max(0, 4 - groups.length))
        .map((pet) => ({ owner: undefined, pet })),
    );

    groupsByTeam.set(team, groups);
  }

  const maxGroupCount = Math.max(
    1,
    groupsByTeam.get('enemies')?.length ?? 0,
    groupsByTeam.get('allies')?.length ?? 0,
  );
  const safe = stageSafeBounds(stage);
  const formationSpanRatio =
    maxGroupCount === 2 ? 0.34 : maxGroupCount === 3 ? 0.58 : 0.7;
  const slotGap =
    maxGroupCount <= 1
      ? stage.width * 0.28
      : ((safe.right - safe.left) * formationSpanRatio) / (maxGroupCount - 1);
  const staggerDistance =
    maxGroupCount <= 1 ? slotGap : Math.min(slotGap * 0.55, stage.width * 0.14);

  const positionsForStagger = (stagger: number) => {
    const positions = new Map<string, FormationPoint>();
    for (const team of ['enemies', 'allies'] as const) {
      const groups = groupsByTeam.get(team) ?? [];
      const backY = formationBackY(team, stage);
      const petOffset = formationPetOffset(team, stage);
      const teamOffset = team === 'enemies' ? stagger / 2 : -stagger / 2;
      groups.forEach(({ owner, pet }, slot) => {
        const x = formationSlotX(slot, groups.length, stage) + teamOffset;
        if (owner) positions.set(owner.id, { x, y: backY });
        if (pet) {
          positions.set(pet.id, {
            x: x + petOffset.x,
            y: backY + petOffset.y,
          });
        }
      });
    }
    return positions;
  };

  const candidates = [0, staggerDistance, -staggerDistance];
  for (const stagger of candidates) {
    const positions = positionsForStagger(stagger);
    if (formationIsReadable(entities, positions, stage)) return positions;
  }
  return positionsForStagger(staggerDistance);
}

export function attachRealtimeBattlePhaser(
  args: RealtimeBattlePhaserArguments,
): RealtimeBattlePhaserController {
  let stage = selectStage(args.root.clientWidth, args.root.clientHeight);
  const fittedCssScale = Math.min(
    args.root.clientWidth / stage.width,
    args.root.clientHeight / stage.height,
  );
  const renderScale = Phaser.Math.Clamp(
    (window.devicePixelRatio || 1) * Math.max(1, fittedCssScale),
    1,
    2,
  );
  let scene: RealtimeBattleScene | undefined;
  let currentSnapshot = args.initialSnapshot;
  let paused = false;
  let speed = 1;
  let destroyed = false;
  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;
  let formationPositions = projectFormation(currentSnapshot.entities, stage);

  const registerScene = (nextScene: RealtimeBattleScene) => {
    scene = nextScene;
  };

  class RealtimeBattleScene extends Phaser.Scene {
    private visuals = new Map<string, EntityVisual>();
    private castLabels = new Map<string, Phaser.GameObjects.Text>();
    private resourceCues = new Map<string, ResourceCueState>();
    private impactQueues = new Map<string, QueuedImpactCue[]>();
    private activeImpactTargets = new Set<string>();
    private legalTargetIds = new Set<string>();
    private lockedUnitIds = new Set<string>();
    private actorUnitId: string | undefined;
    private commandSubmitting = false;
    private activeTimelineActionIds = new Set<string>();
    private pendingStage?: StageSize;
    private formation?: Phaser.GameObjects.Graphics;
    private vitalTextureSequence = 0;

    preload() {
      this.load.image(
        UNIT_NAME_DISC_TEXTURE,
        '/assets/battle/realtime/ui/unit/name-ink-disc.png',
      );
      this.load.image(
        UNIT_VITAL_TRACK_TEXTURE,
        '/assets/battle/realtime/ui/unit/vital-ink-track.png',
      );
      this.load.image(
        UNIT_VITAL_HP_TEXTURE,
        '/assets/battle/realtime/ui/unit/vital-hp-upper.png',
      );
      this.load.image(
        UNIT_VITAL_MP_TEXTURE,
        '/assets/battle/realtime/ui/unit/vital-mp-lower.png',
      );
      this.load.image(
        UNIT_SHIELD_TEXTURE,
        '/assets/battle/realtime/ui/unit/shield-aegis.png',
      );
      for (const asset of realtimeBattleResourceAssets()) {
        this.load.image(asset.textureKey, asset.path);
      }
    }

    create() {
      registerScene(this);
      this.cameras.main
        .setZoom(renderScale)
        .centerOn(stage.width / 2, stage.height / 2);
      this.createFormationInk();
      for (const entity of currentSnapshot.entities) {
        this.createEntity(entity);
      }
      this.renderSnapshot(currentSnapshot);
      this.game.canvas.setAttribute(
        'aria-label',
        '多人实时字阵战场。点击文字单位选择目标，使用下方文字指令施展招式。',
      );
      this.game.canvas.setAttribute('role', 'application');
      args.onState(currentSnapshot);
    }

    setPlaybackState(nextPaused: boolean, nextSpeed: number) {
      this.time.paused = nextPaused;
      this.time.timeScale = nextSpeed;
      this.tweens.paused = nextPaused;
      this.tweens.timeScale = nextSpeed;
    }

    setCommandSelection(state: {
      actorUnitId?: string;
      legalTargetIds: readonly string[];
      lockedUnitIds: readonly string[];
      submitting: boolean;
    }) {
      this.actorUnitId = state.actorUnitId;
      this.legalTargetIds = new Set(state.legalTargetIds);
      this.lockedUnitIds = new Set(state.lockedUnitIds);
      this.commandSubmitting = state.submitting;
      this.renderSnapshot(currentSnapshot);
    }

    relayout(nextStage: StageSize) {
      stage = nextStage;
      formationPositions = projectFormation(currentSnapshot.entities, stage);
      this.scale.setGameSize(
        Math.round(stage.width * renderScale),
        Math.round(stage.height * renderScale),
      );
      this.cameras.main
        .setZoom(renderScale)
        .centerOn(stage.width / 2, stage.height / 2);
      this.createFormationInk();

      const teamSizes = new Map<RealtimeBattleTeam, number>();
      for (const team of ['allies', 'enemies'] as const) {
        teamSizes.set(
          team,
          currentSnapshot.entities.filter(
            (entity) => entity.team === team && entity.kind === 'cultivator',
          ).length,
        );
      }
      for (const entity of currentSnapshot.entities) {
        const visual = this.visuals.get(entity.id);
        const position = formationPositions.get(entity.id);
        if (!visual || !position) continue;
        const radius = formationRadius(
          entity,
          stage,
          teamSizes.get(entity.team) ?? 1,
        );
        const presentationScale = radius / visual.baseRadius;
        visual.radius = radius;
        visual.container
          .setPosition(position.x, position.y)
          .setScale(presentationScale);
      }
      this.renderSnapshot(currentSnapshot);
    }

    requestRelayout(nextStage: StageSize) {
      if (this.activeTimelineActionIds.size > 0) {
        this.pendingStage = nextStage;
        return;
      }
      this.relayout(nextStage);
    }

    playTimeline(timeline: CombatVisualTimeline, offsetMs = 0) {
      const pendingCommands = timeline.commands.filter(
        (command) => command.at + command.duration > offsetMs,
      );
      if (pendingCommands.some((command) => command.kind === 'settle')) {
        this.activeTimelineActionIds.add(timeline.action.id);
      }
      for (const command of pendingCommands) {
        this.time.delayedCall(Math.max(0, command.at - offsetMs), () => {
          if (!this.sys.isActive()) return;
          if (command.kind === 'cast') this.playCast(timeline.action);
          if (command.kind === 'delivery') {
            this.playDelivery(
              timeline.action,
              command.duration,
              command.impactAt - command.at,
            );
          }
          if (command.kind === 'reaction') {
            this.playReaction(command.fact, timeline.action, command.duration);
          }
          if (command.kind === 'resolve') {
            this.playFact(command.fact, timeline.action);
          }
          if (command.kind === 'impact_cue') {
            this.enqueueImpactCue(command.cue, timeline.action);
          }
          if (command.kind === 'settle') this.settleAction(timeline.action);
        });
      }
    }

    private playCast(action: CombatVisualActionInput) {
      const source = this.visuals.get(action.sourceId);
      if (!source) return;
      const color = visualColor(action.visual);
      source.container.setDepth(6);
      const existing = this.castLabels.get(action.id);
      if (existing?.active) existing.destroy();
      const label = this.add
        .text(0, -source.baseRadius - 72, action.ability.name, {
          fontFamily: FONT_FAMILY,
          fontSize:
            stage.profile === 'portrait'
              ? source.isPet
                ? '26px'
                : '34px'
              : source.isPet
                ? '18px'
                : '24px',
          fontStyle: 'bold',
          color: colorHex(color),
          ...outlinedText(source.isPet ? 3 : 4),
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.78)
        .setResolution(renderScale);
      source.container.add(label);
      this.castLabels.set(action.id, label);
      this.tweens.add({
        targets: label,
        alpha: 1,
        scale: 1,
        y: label.y - 5,
        duration: 480,
        ease: 'Back.Out',
      });

      const seal = this.add
        .circle(source.container.x, source.container.y, source.radius + 13)
        .setStrokeStyle(action.visual.weight === 'heavy' ? 3 : 2, color, 0.55)
        .setDepth(2.7);
      this.tweens.add({
        targets: seal,
        scale: 1.22,
        alpha: 0,
        duration: 720,
        ease: 'Cubic.Out',
        onComplete: () => seal.destroy(),
      });
    }

    private playDelivery(
      action: CombatVisualActionInput,
      duration: number,
      impactOffset: number,
    ) {
      const source = this.visuals.get(action.sourceId);
      const targets = action.targetIds
        .map((id) => this.visuals.get(id))
        .filter((target): target is EntityVisual => Boolean(target));
      if (!source || targets.length === 0) return;
      const color = visualColor(action.visual);
      switch (action.visual.delivery) {
        case 'melee':
          {
            const impactTargets = targets.filter((target) => target !== source);
            if (impactTargets.length === 0) break;
            this.playMeleeDelivery(
              source,
              impactTargets,
              action,
              color,
              duration,
              impactOffset,
            );
          }
          break;
        case 'projectile':
          this.playProjectileDelivery(
            source,
            targets,
            action,
            color,
            impactOffset,
          );
          break;
        case 'beam':
          this.playBeamDelivery(source, targets, action, color, impactOffset);
          break;
        case 'field':
          this.playFieldDelivery(source, targets, action, color, impactOffset);
          break;
        case 'self':
          this.playSelfDelivery(source, action, color, impactOffset);
          break;
      }
    }

    private playMeleeDelivery(
      source: EntityVisual,
      targets: EntityVisual[],
      action: CombatVisualActionInput,
      color: number,
      duration: number,
      impactOffset: number,
    ) {
      const origin = { x: source.container.x, y: source.container.y };
      const targetCenter = targets.reduce(
        (point, target) => ({
          x: point.x + target.container.x / targets.length,
          y: point.y + target.container.y / targets.length,
        }),
        { x: 0, y: 0 },
      );
      const targetRadius = Math.max(...targets.map((target) => target.radius));
      const distance = Phaser.Math.Distance.Between(
        origin.x,
        origin.y,
        targetCenter.x,
        targetCenter.y,
      );
      const ratio = Phaser.Math.Clamp(
        (distance - source.radius * 0.5 - targetRadius * 0.72) /
          Math.max(distance, 1),
        0.58,
        0.87,
      );
      this.tweens.add({
        targets: source.container,
        x: origin.x + (targetCenter.x - origin.x) * ratio,
        y: origin.y + (targetCenter.y - origin.y) * ratio,
        duration: Math.max(260, impactOffset),
        ease: action.visual.weight === 'heavy' ? 'Expo.In' : 'Cubic.In',
        onComplete: () => {
          targets.forEach((target) =>
            this.playImpactBurst(target.container, action.visual, color),
          );
          this.cameras.main.shake(
            action.visual.weight === 'heavy' ? 190 : 120,
            action.visual.weight === 'heavy' ? 0.0026 : 0.0012,
          );
          this.tweens.add({
            targets: source.container,
            x: origin.x,
            y: origin.y,
            delay: 120,
            duration: Math.max(380, duration - impactOffset - 120),
            ease: 'Cubic.Out',
          });
        },
      });
    }

    private playProjectileDelivery(
      source: EntityVisual,
      targets: EntityVisual[],
      action: CombatVisualActionInput,
      color: number,
      impactOffset: number,
    ) {
      const start = {
        x: source.container.x,
        y: source.container.y - source.radius - 32,
      };
      targets.forEach((target, index) => {
        const projectile = this.createSkillProjectile(action, color, start);
        const end = {
          x: target.container.x,
          y: target.container.y - target.radius * 0.18,
        };
        const duration = Math.max(420, impactOffset - index * 55);
        const isTrue = action.visual.discipline === 'true';
        const isFanout =
          action.visual.distribution === 'fanout' && targets.length > 1;
        if (isTrue || isFanout) {
          const dx = end.x - start.x;
          const dy = end.y - start.y;
          const length = Math.max(Math.hypot(dx, dy), 1);
          const bend = isTrue
            ? (index % 2 === 0 ? -1 : 1) * (62 + index * 8)
            : (index - (targets.length - 1) / 2) * 42;
          const control = {
            x: (start.x + end.x) / 2 + (-dy / length) * bend,
            y: (start.y + end.y) / 2 + (dx / length) * bend,
          };
          this.tweens.addCounter({
            from: 0,
            to: 1,
            duration,
            delay: index * 55,
            ease: 'Sine.InOut',
            onUpdate: (tween) => {
              const progress = tween.getValue() ?? 0;
              const inverse = 1 - progress;
              projectile.setPosition(
                inverse * inverse * start.x +
                  2 * inverse * progress * control.x +
                  progress * progress * end.x,
                inverse * inverse * start.y +
                  2 * inverse * progress * control.y +
                  progress * progress * end.y,
              );
              projectile.setAngle(Math.sin(progress * Math.PI * 3) * 5);
            },
            onComplete: () => {
              projectile.destroy(true);
              this.playImpactBurst(target.container, action.visual, color);
            },
          });
        } else {
          this.tweens.add({
            targets: projectile,
            x: end.x,
            y: end.y,
            duration,
            delay: index * 55,
            ease: 'Cubic.InOut',
            onComplete: () => {
              projectile.destroy(true);
              this.playImpactBurst(target.container, action.visual, color);
            },
          });
        }
      });
    }

    private playBeamDelivery(
      source: EntityVisual,
      targets: EntityVisual[],
      action: CombatVisualActionInput,
      color: number,
      impactOffset: number,
    ) {
      targets.forEach((target, index) => {
        const projectile = this.createSkillProjectile(action, color, {
          x: source.container.x,
          y: source.container.y,
        });
        this.tweens.add({
          targets: projectile,
          x: target.container.x,
          y: target.container.y,
          duration: Math.max(320, impactOffset),
          delay: index * 45,
          ease: 'Expo.In',
          onComplete: () => {
            projectile.destroy(true);
            this.playImpactBurst(target.container, action.visual, color);
          },
        });
      });
    }

    private playFieldDelivery(
      source: EntityVisual,
      targets: EntityVisual[],
      action: CombatVisualActionInput,
      color: number,
      impactOffset: number,
    ) {
      const center = targets.reduce(
        (point, target) => ({
          x: point.x + target.container.x,
          y: point.y + target.container.y,
        }),
        { x: 0, y: 0 },
      );
      center.x /= targets.length;
      center.y /= targets.length;
      const ring = this.add
        .ellipse(center.x, center.y, 380, 500, color, 0.035)
        .setStrokeStyle(action.visual.weight === 'heavy' ? 4 : 2, color, 0.62)
        .setScale(0.36)
        .setDepth(1.8);
      this.tweens.add({
        targets: ring,
        scale: 1,
        alpha: { from: 0.2, to: 0.8 },
        duration: Math.max(420, impactOffset),
        ease: 'Cubic.Out',
        onComplete: () => {
          targets.forEach((target) =>
            this.playImpactBurst(target.container, action.visual, color),
          );
          this.tweens.add({
            targets: ring,
            scale: 1.08,
            alpha: 0,
            duration: 620,
            onComplete: () => ring.destroy(),
          });
        },
      });
    }

    private playSelfDelivery(
      source: EntityVisual,
      action: CombatVisualActionInput,
      color: number,
      impactOffset: number,
    ) {
      const aura = this.add
        .circle(
          source.container.x,
          source.container.y,
          source.radius + 6,
          color,
          0.045,
        )
        .setStrokeStyle(3, color, 0.68)
        .setDepth(2.8);
      this.tweens.add({
        targets: aura,
        scale: 1.48,
        alpha: 0,
        duration: Math.max(420, impactOffset + 260),
        ease: 'Cubic.Out',
        onComplete: () => aura.destroy(),
      });
    }

    private createSkillProjectile(
      action: CombatVisualActionInput,
      color: number,
      start: { x: number; y: number },
    ) {
      const isTrue = action.visual.discipline === 'true';
      const aura = this.add.graphics();
      if (isTrue) {
        aura.lineStyle(2, color, 0.46).strokeCircle(0, 0, 30);
        aura.lineStyle(1, 0x29202f, 0.36).strokeCircle(0, 0, 39);
        aura.lineStyle(2, color, 0.2).lineBetween(-56, 0, -26, 0);
      } else {
        aura.lineStyle(2, color, 0.52).strokeEllipse(0, 0, 92, 40);
        aura.lineStyle(1, 0xe9e1cf, 0.8).strokeCircle(0, 0, 25);
      }
      const label = this.add
        .text(0, 0, action.ability.name, {
          fontFamily: FONT_FAMILY,
          fontSize: '18px',
          fontStyle: 'bold',
          color: colorHex(color),
          ...outlinedText(4),
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const projectile = this.add
        .container(start.x, start.y, [aura, label])
        .setDepth(7);
      this.tweens.add({
        targets: aura,
        angle: isTrue ? -360 : 360,
        duration: isTrue ? 1_500 : 1_100,
        repeat: -1,
      });
      return projectile;
    }

    private settleAction(action: CombatVisualActionInput) {
      const source = this.visuals.get(action.sourceId);
      const label = this.castLabels.get(action.id);
      this.castLabels.delete(action.id);
      if (!label?.active) {
        if (source?.container.active) source.container.setDepth(3);
        this.completeTimelineAction(action.id);
        return;
      }
      this.tweens.add({
        targets: label,
        alpha: 0,
        y: label.y - 8,
        duration: 260,
        ease: 'Quad.In',
        onComplete: () => {
          label.destroy();
          if (source?.container.active) source.container.setDepth(3);
          this.completeTimelineAction(action.id);
        },
      });
    }

    private completeTimelineAction(actionId: string) {
      this.activeTimelineActionIds.delete(actionId);
      if (this.activeTimelineActionIds.size > 0 || !this.pendingStage) return;
      const pendingStage = this.pendingStage;
      this.pendingStage = undefined;
      this.relayout(pendingStage);
    }

    private createFormationInk() {
      const formation = this.formation ?? this.add.graphics().setDepth(0.5);
      this.formation = formation;
      formation.clear();
      const enemyPetOffset = formationPetOffset('enemies', stage);
      const allyPetOffset = formationPetOffset('allies', stage);
      const formationHeight =
        Math.abs(enemyPetOffset.y) + (stage.profile === 'portrait' ? 150 : 176);
      formation.lineStyle(2, 0x75474a, 0.075);
      formation.strokeEllipse(
        stage.width / 2,
        formationBackY('enemies', stage) + enemyPetOffset.y / 2,
        stage.width * 0.64,
        formationHeight,
      );
      formation.lineStyle(2, 0x475b50, 0.075);
      formation.strokeEllipse(
        stage.width / 2,
        formationBackY('allies', stage) + allyPetOffset.y / 2,
        stage.width * 0.64,
        formationHeight,
      );
    }

    private createEntity(entity: RealtimeBattleEntity) {
      const position = formationPositions.get(entity.id) ?? {
        x: stage.width / 2,
        y: stage.height / 2,
      };
      const isPet = entity.kind === 'spirit-pet';
      const compact = stage.profile === 'portrait';
      const teamColor = entity.team === 'allies' ? 0x3f6b56 : 0x8e3039;
      const teamSize = currentSnapshot.entities.filter(
        (candidate) =>
          candidate.team === entity.team && candidate.kind === 'cultivator',
      ).length;
      const radius = formationRadius(entity, stage, teamSize);
      const nameControlFx = this.add.graphics().setAlpha(0);
      const selection = this.add
        .circle(0, 0, radius + 18, teamColor, 0)
        .setStrokeStyle(2, teamColor, 0)
        .setAlpha(0);
      const actorSelection = this.add
        .circle(0, 0, radius + 12, 0x3f6b56, 0.025)
        .setStrokeStyle(4, 0x3f6b56, 0)
        .setAlpha(0);
      const targetSelection = this.add
        .circle(0, 0, radius + 24, teamColor, 0.035)
        .setStrokeStyle(4, teamColor, 0)
        .setAlpha(0);
      if (!reduceMotion) {
        this.tweens.add({
          targets: targetSelection,
          scale: 1.08,
          duration: 680,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
      const name = this.add
        .text(0, 0, entity.name, {
          fontFamily: FONT_FAMILY,
          fontSize: isPet
            ? compact
              ? '22px'
              : '20px'
            : compact
              ? '29px'
              : '30px',
          color: '#fff8e6',
          fontStyle: 'bold',
          stroke: '#101612',
          strokeThickness: isPet ? 4 : 5,
          letterSpacing: isPet ? 1 : 2,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const nameDisc = this.add
        .image(0, 0, UNIT_NAME_DISC_TEXTURE)
        .setDisplaySize(
          radius * UNIT_NAME_DISC_SCALE,
          radius * UNIT_NAME_DISC_SCALE,
        )
        .setAlpha(0.92);
      const vitalTrack = this.add
        .image(0, 0, UNIT_VITAL_TRACK_TEXTURE)
        .setDisplaySize(radius * UNIT_VITAL_SCALE, radius * UNIT_VITAL_SCALE)
        .setAlpha(0.2);
      const textureSuffix = this.vitalTextureSequence++;
      const hpBrushTextureKey = `realtime-vital-hp-${textureSuffix}`;
      const qiBrushTextureKey = `realtime-vital-qi-${textureSuffix}`;
      const shieldTextureKey = `realtime-shield-${textureSuffix}`;
      this.textures.createCanvas(hpBrushTextureKey, 512, 512);
      this.textures.createCanvas(qiBrushTextureKey, 512, 512);
      this.textures.createCanvas(shieldTextureKey, 512, 512);
      const hpBrush = this.add
        .image(0, 0, hpBrushTextureKey)
        .setDisplaySize(radius * UNIT_VITAL_SCALE, radius * UNIT_VITAL_SCALE);
      const qiBrush = this.add
        .image(0, 0, qiBrushTextureKey)
        .setDisplaySize(radius * UNIT_VITAL_SCALE, radius * UNIT_VITAL_SCALE);
      const vitalLayer = this.add.container(0, 0, [
        vitalTrack,
        hpBrush,
        qiBrush,
      ]);
      const shieldArt = this.add
        .image(0, 0, shieldTextureKey)
        .setDisplaySize((radius + 24) * 2, (radius + 24) * 2)
        .setAlpha(0);
      if (!reduceMotion) {
        this.tweens.add({
          targets: shieldArt,
          angle: 360,
          duration: 16_000,
          repeat: -1,
          ease: 'Linear',
        });
      }

      const resourceLayer = this.add.container(0, radius + (isPet ? 12 : 16));
      const statusLayer = this.add.container(0, radius + (isPet ? 12 : 16));
      const commandStateText = this.add
        .text(0, -radius - (isPet ? 76 : 92), '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '18px' : '15px',
          fontStyle: 'bold',
          color: '#3f6b56',
          ...outlinedText(3),
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);

      const container = this.add
        .container(position.x, position.y, [
          selection,
          actorSelection,
          targetSelection,
          nameDisc,
          vitalLayer,
          shieldArt,
          nameControlFx,
          name,
          resourceLayer,
          statusLayer,
          commandStateText,
        ])
        .setSize((radius + 54) * 2, (radius + 48) * 2)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      container.on('pointerdown', () => {
        if (
          this.legalTargetIds.size > 0 &&
          !this.legalTargetIds.has(entity.id)
        ) {
          args.onFocus(entity.id);
          return;
        }
        currentSnapshot = { ...currentSnapshot, focusedEntityId: entity.id };
        this.renderSnapshot(currentSnapshot);
        args.onFocus(entity.id);
        args.onState(currentSnapshot);
      });

      this.visuals.set(entity.id, {
        container,
        selection,
        actorSelection,
        targetSelection,
        commandStateText,
        vitalLayer,
        hpBrush,
        qiBrush,
        hpBrushTextureKey,
        qiBrushTextureKey,
        hpRatio: undefined,
        qiRatio: undefined,
        shieldArt,
        shieldTextureKey,
        shieldStrength: undefined,
        name,
        resourceLayer,
        resources: new Map(),
        resourceHeight: 0,
        statusLayer,
        statuses: new Map(),
        statusHeight: 0,
        nameControlFx,
        isPet,
        baseRadius: radius,
        radius,
      });
    }

    renderSnapshot(snapshot: RealtimeBattleSnapshot) {
      for (const entity of snapshot.entities) {
        const visual = this.visuals.get(entity.id);
        if (!visual) continue;
        const isFocused = snapshot.focusedEntityId === entity.id;
        this.renderUnitVitals(visual, entity);
        this.syncResourceLayer(visual, entity);
        this.syncStatusLayer(visual, entity);
        const controls = entity.effects
          .filter((effect) => effect.statusType === 'control')
          .slice(-2);
        this.renderNameControlFx(
          visual,
          entity.alive && controls.length > 0
            ? (controls[0].controlVisual ?? 'generic')
            : undefined,
        );
        const isLegalTarget = this.legalTargetIds.has(entity.id);
        const isActor = this.actorUnitId === entity.id;
        const isLocked = this.lockedUnitIds.has(entity.id);
        visual.selection.setAlpha(isFocused && !isLegalTarget ? 0.28 : 0);
        visual.selection.setStrokeStyle(
          isFocused && !isLegalTarget ? 2 : 0,
          entity.team === 'allies' ? 0x3f6b56 : 0x9d303a,
          isFocused && !isLegalTarget ? 0.42 : 0,
        );
        visual.actorSelection
          .setAlpha(isActor ? 0.86 : 0)
          .setStrokeStyle(isActor ? 4 : 0, 0x3f6b56, isActor ? 0.9 : 0);
        visual.targetSelection
          .setAlpha(isLegalTarget ? 0.82 : 0)
          .setStrokeStyle(
            isLegalTarget ? 4 : 0,
            entity.team === 'allies' ? 0x3f6b56 : 0x9d303a,
            isLegalTarget ? 0.92 : 0,
          );
        visual.commandStateText
          .setText(
            isLocked
              ? '已定'
              : isActor && this.commandSubmitting
                ? '提交中'
                : isActor
                  ? '当前出招'
                  : '',
          )
          .setColor(isLocked ? '#735080' : '#3f6b56');
        visual.vitalLayer.setAlpha(entity.alive ? 1 : 0.18);
        visual.resourceLayer.setAlpha(entity.alive ? 1 : 0.35);
        visual.statusLayer.setAlpha(entity.alive ? 1 : 0.35);
        visual.name
          .setAlpha(entity.alive ? 1 : 0.35)
          .setColor(entity.alive ? '#fff8e6' : '#6f675e');
      }
    }

    private syncResourceLayer(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
    ) {
      const activeIds = new Set(
        entity.combatResources.map((resource) => resource.id),
      );
      for (const [resourceId, resourceVisual] of visual.resources) {
        if (activeIds.has(resourceId)) continue;
        resourceVisual.container.destroy(true);
        visual.resources.delete(resourceId);
      }

      for (const resource of entity.combatResources) {
        let resourceVisual = visual.resources.get(resource.id);
        if (!resourceVisual) {
          resourceVisual = this.createResourceVisual(visual, entity, resource);
          visual.resources.set(resource.id, resourceVisual);
        }
        this.updateResourceVisual(
          resourceVisual,
          entity,
          resource,
          this.resourceCues.get(this.resourceCueKey(entity.id, resource.id)),
        );
      }

      visual.resourceHeight = this.layoutResourceVisuals(visual, entity);
      visual.resourceLayer.setVisible(
        entity.alive && entity.combatResources.length > 0,
      );
    }

    private createResourceVisual(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
      resource: RealtimeBattleResource,
    ): ResourceVisual {
      const background = this.add.graphics();
      const iconSize = visual.isPet ? 34 : 42;
      const icon = this.add
        .image(0, 0, realtimeBattleResourceTexture(resource.id))
        .setDisplaySize(iconSize, iconSize);
      const iconPulse = this.add.container(0, 0, [icon]);
      const nameFontSize = visual.isPet
        ? stage.profile === 'portrait'
          ? 12
          : 11
        : stage.profile === 'portrait'
          ? 15
          : 14;
      const currentFontSize = visual.isPet
        ? stage.profile === 'portrait'
          ? 14
          : 13
        : stage.profile === 'portrait'
          ? 17
          : 16;
      const maxFontSize = visual.isPet
        ? stage.profile === 'portrait'
          ? 12
          : 11
        : stage.profile === 'portrait'
          ? 14
          : 13;
      const name = this.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${nameFontSize}px`,
          fontStyle: 'bold',
          color: '#ead8aa',
          stroke: '#080d0b',
          strokeThickness: visual.isPet ? 2 : 3,
        })
        .setOrigin(0, 0.5)
        .setResolution(renderScale);
      const currentValue = this.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${currentFontSize}px`,
          fontStyle: 'bold',
          color: '#fff2bd',
          stroke: '#080d0b',
          strokeThickness: visual.isPet ? 2 : 3,
        })
        .setOrigin(0, 0.5)
        .setResolution(renderScale);
      const maxValue = this.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${maxFontSize}px`,
          fontStyle: 'bold',
          color: '#b9ad8d',
          stroke: '#080d0b',
          strokeThickness: visual.isPet ? 2 : 3,
        })
        .setOrigin(0, 0.5)
        .setResolution(renderScale);
      const delta = this.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${currentFontSize}px`,
          fontStyle: 'bold',
          color: '#7ee2a8',
          stroke: '#080d0b',
          strokeThickness: visual.isPet ? 2 : 3,
        })
        .setOrigin(0, 0.5)
        .setAlpha(0)
        .setResolution(renderScale);
      const container = this.add.container(0, 0, [
        background,
        iconPulse,
        name,
        currentValue,
        maxValue,
        delta,
      ]);
      visual.resourceLayer.add(container);
      return {
        container,
        background,
        iconPulse,
        icon,
        name,
        currentValue,
        maxValue,
        delta,
        width: 0,
        height: iconSize,
        barHeight: visual.isPet ? 26 : 31,
      };
    }

    private updateResourceVisual(
      resourceVisual: ResourceVisual,
      entity: RealtimeBattleEntity,
      resource: RealtimeBattleResource,
      cue?: ResourceCueState,
    ) {
      const iconSize = resourceVisual.icon.displayWidth;
      const iconOverlap = entity.kind === 'spirit-pet' ? 14 : 18;
      const textGap = entity.kind === 'spirit-pet' ? 5 : 8;
      const valueGap = entity.kind === 'spirit-pet' ? 6 : 9;
      const maxGap = 2;
      const rightPadding = entity.kind === 'spirit-pet' ? 8 : 11;
      const deltaGap = cue ? 4 : 0;
      resourceVisual.icon.setTexture(
        realtimeBattleResourceTexture(resource.id),
      );
      resourceVisual.name.setText(resource.name);
      resourceVisual.currentValue.setText(`${resource.current}`);
      resourceVisual.maxValue.setText(`/ ${resource.max}`);
      resourceVisual.delta
        .setText(
          cue ? `${cue.delta >= 0 ? '+' : ''}${Math.round(cue.delta)}` : '',
        )
        .setColor(cue && cue.delta < 0 ? '#ff8b95' : '#7ee2a8')
        .setVisible(Boolean(cue));

      const deltaWidth = cue ? resourceVisual.delta.width : 0;
      const nameX = iconSize + textGap;
      const currentValueX = nameX + resourceVisual.name.width + valueGap;
      const maxValueX =
        currentValueX + resourceVisual.currentValue.width + maxGap;
      const deltaX = maxValueX + resourceVisual.maxValue.width + deltaGap;
      const width = deltaX + deltaWidth + rightPadding;
      const height = resourceVisual.height;
      const barHeight = resourceVisual.barHeight;
      const barRadius = barHeight / 2;
      const barX = iconSize - iconOverlap;
      const barY = (height - barHeight) / 2;
      resourceVisual.width = width;
      resourceVisual.container.setSize(width, height);
      resourceVisual.background.clear();
      resourceVisual.background.fillStyle(0x0a110e, 0.88);
      resourceVisual.background.fillRoundedRect(
        barX,
        barY,
        width - barX,
        barHeight,
        barRadius,
      );
      resourceVisual.background.fillRect(
        barX,
        barY,
        barRadius,
        barHeight,
      );
      resourceVisual.background.lineStyle(
        1.25,
        entity.team === 'allies' ? 0x799b7b : 0xc06b73,
        0.82,
      );
      resourceVisual.background.beginPath();
      resourceVisual.background.moveTo(barX, barY);
      resourceVisual.background.lineTo(width - barRadius, barY);
      resourceVisual.background.arc(
        width - barRadius,
        barY + barRadius,
        barRadius,
        -Math.PI / 2,
        Math.PI / 2,
      );
      resourceVisual.background.lineTo(barX, barY + barHeight);
      resourceVisual.background.closePath();
      resourceVisual.background.strokePath();
      resourceVisual.iconPulse.setPosition(iconSize / 2, height / 2);
      resourceVisual.name.setPosition(nameX, height / 2);
      resourceVisual.currentValue.setPosition(currentValueX, height / 2);
      resourceVisual.maxValue.setPosition(maxValueX, height / 2);
      resourceVisual.delta.setPosition(deltaX, height / 2);
    }

    private layoutResourceVisuals(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
    ) {
      const gapX = visual.isPet ? 4 : 6;
      const gapY = visual.isPet ? 4 : 5;
      const maxWidth = Math.max(
        visual.baseRadius * (visual.isPet ? 3.1 : 3.35),
        visual.isPet ? 142 : 188,
      );
      const rows: ResourceVisual[][] = [];
      let currentRow: ResourceVisual[] = [];
      let currentWidth = 0;
      for (const resource of entity.combatResources) {
        const resourceVisual = visual.resources.get(resource.id);
        if (!resourceVisual) continue;
        const nextWidth =
          currentWidth +
          (currentRow.length > 0 ? gapX : 0) +
          resourceVisual.width;
        if (currentRow.length > 0 && nextWidth > maxWidth) {
          rows.push(currentRow);
          currentRow = [];
          currentWidth = 0;
        }
        currentWidth +=
          (currentRow.length > 0 ? gapX : 0) + resourceVisual.width;
        currentRow.push(resourceVisual);
      }
      if (currentRow.length > 0) rows.push(currentRow);

      let y = 0;
      for (const row of rows) {
        const rowWidth = row.reduce(
          (sum, resourceVisual, index) =>
            sum + resourceVisual.width + (index > 0 ? gapX : 0),
          0,
        );
        let x = -rowWidth / 2;
        let rowHeight = 0;
        for (const resourceVisual of row) {
          resourceVisual.container.setPosition(x, y);
          x += resourceVisual.width + gapX;
          rowHeight = Math.max(rowHeight, resourceVisual.height);
        }
        y += rowHeight + gapY;
      }
      return rows.length > 0 ? y - gapY : 0;
    }

    private syncStatusLayer(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
    ) {
      const entries: StatusEntry[] = [
        ...entity.actionStates.map((state) => ({
          key: `action:${state.id}`,
          label: state.label,
          tone:
            state.tone === 'control'
              ? ('control' as const)
              : ('action' as const),
        })),
        ...entity.effects
          .filter((effect) => effect.statusType === 'control')
          .map((effect) => ({
            key: `effect:${effect.id}`,
            label: `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
            tone: 'control' as const,
          })),
        ...entity.effects
          .filter(
            (effect) =>
              effect.statusType !== 'control' && effect.tone === 'debuff',
          )
          .map((effect) => ({
            key: `effect:${effect.id}`,
            label: `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
            tone: 'debuff' as const,
          })),
        ...entity.effects
          .filter(
            (effect) =>
              effect.statusType !== 'control' && effect.tone === 'buff',
          )
          .map((effect) => ({
            key: `effect:${effect.id}`,
            label: `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
            tone: 'buff' as const,
          })),
      ];
      const activeKeys = new Set(entries.map((entry) => entry.key));
      for (const [key, statusVisual] of visual.statuses) {
        if (activeKeys.has(key)) continue;
        statusVisual.container.destroy(true);
        visual.statuses.delete(key);
      }
      for (const entry of entries) {
        let statusVisual = visual.statuses.get(entry.key);
        if (!statusVisual) {
          statusVisual = this.createStatusVisual(visual);
          visual.statuses.set(entry.key, statusVisual);
        }
        this.updateStatusVisual(statusVisual, entry, visual.isPet);
      }

      const resourceTop = visual.baseRadius + (visual.isPet ? 12 : 16);
      visual.resourceLayer.setY(resourceTop);
      visual.statusLayer.setY(
        resourceTop +
          (visual.resourceHeight > 0 ? visual.resourceHeight + 7 : 0),
      );
      visual.statusHeight = this.layoutStatusVisuals(visual, entries);
      visual.statusLayer.setVisible(entity.alive && entries.length > 0);
    }

    private createStatusVisual(visual: EntityVisual): StatusVisual {
      const background = this.add.graphics();
      const fontSize = visual.isPet
        ? stage.profile === 'portrait'
          ? 12
          : 10
        : stage.profile === 'portrait'
          ? 14
          : 12;
      const label = this.add
        .text(0, 0, '', {
          fontFamily: FONT_FAMILY,
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: '#eee7d6',
          stroke: '#080d0b',
          strokeThickness: visual.isPet ? 2 : 3,
        })
        .setOrigin(0, 0.5)
        .setResolution(renderScale);
      const container = this.add.container(0, 0, [background, label]);
      visual.statusLayer.add(container);
      return {
        container,
        background,
        label,
        width: 0,
        height: visual.isPet ? 24 : 28,
      };
    }

    private updateStatusVisual(
      statusVisual: StatusVisual,
      entry: StatusEntry,
      isPet: boolean,
    ) {
      const colors: Record<
        StatusTone,
        { accent: number }
      > = {
        action: { accent: 0x8e719b },
        control: { accent: 0xc1933f },
        buff: { accent: 0x628e70 },
        debuff: { accent: 0xb34f58 },
      };
      const palette = colors[entry.tone];
      const paddingLeft = isPet ? 9 : 11;
      const paddingRight = isPet ? 7 : 9;
      statusVisual.label.setText(entry.label).setColor('#eee7d6');
      statusVisual.width =
        statusVisual.label.width + paddingLeft + paddingRight;
      statusVisual.container.setSize(statusVisual.width, statusVisual.height);
      statusVisual.background.clear();
      const width = statusVisual.width;
      const height = statusVisual.height;
      statusVisual.background.fillStyle(0x090d0b, 0.66);
      statusVisual.background.fillPoints(
        [
          new Phaser.Math.Vector2(1, height * 0.42),
          new Phaser.Math.Vector2(5, height * 0.2),
          new Phaser.Math.Vector2(width * 0.34, height * 0.12),
          new Phaser.Math.Vector2(width - 3, height * 0.24),
          new Phaser.Math.Vector2(width, height * 0.56),
          new Phaser.Math.Vector2(width - 7, height * 0.8),
          new Phaser.Math.Vector2(width * 0.58, height * 0.88),
          new Phaser.Math.Vector2(4, height * 0.76),
        ],
        true,
      );
      statusVisual.background.lineStyle(2.2, palette.accent, 0.9);
      statusVisual.background.lineBetween(
        4,
        height * 0.27,
        4,
        height * 0.73,
      );
      statusVisual.background.lineStyle(1.15, palette.accent, 0.72);
      statusVisual.background.beginPath();
      statusVisual.background.moveTo(7, height - 4.5);
      statusVisual.background.lineTo(width * 0.68, height - 3.5);
      statusVisual.background.lineTo(width - 7, height - 6);
      statusVisual.background.strokePath();
      statusVisual.label.setPosition(paddingLeft, height / 2);
    }

    private layoutStatusVisuals(
      visual: EntityVisual,
      entries: readonly StatusEntry[],
    ) {
      const gapX = visual.isPet ? 4 : 5;
      const gapY = visual.isPet ? 3 : 4;
      const maxWidth = Math.max(
        visual.baseRadius * (visual.isPet ? 3 : 3.25),
        visual.isPet ? 140 : 184,
      );
      const rows: StatusVisual[][] = [];
      let row: StatusVisual[] = [];
      let rowWidth = 0;
      for (const entry of entries) {
        const statusVisual = visual.statuses.get(entry.key);
        if (!statusVisual) continue;
        const nextWidth =
          rowWidth + (row.length > 0 ? gapX : 0) + statusVisual.width;
        if (row.length > 0 && nextWidth > maxWidth) {
          rows.push(row);
          row = [];
          rowWidth = 0;
        }
        rowWidth += (row.length > 0 ? gapX : 0) + statusVisual.width;
        row.push(statusVisual);
      }
      if (row.length > 0) rows.push(row);

      let y = 0;
      for (const statusRow of rows) {
        const width = statusRow.reduce(
          (sum, statusVisual, index) =>
            sum + statusVisual.width + (index > 0 ? gapX : 0),
          0,
        );
        let x = -width / 2;
        let height = 0;
        for (const statusVisual of statusRow) {
          statusVisual.container.setPosition(x, y);
          x += statusVisual.width + gapX;
          height = Math.max(height, statusVisual.height);
        }
        y += height + gapY;
      }
      return rows.length > 0 ? y - gapY : 0;
    }

    private renderUnitVitals(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
    ) {
      const radius = visual.baseRadius;
      const hpRatio = Phaser.Math.Clamp(entity.hp / entity.maxHp, 0, 1);
      const qiRatio = Phaser.Math.Clamp(entity.qi / entity.maxQi, 0, 1);
      if (visual.hpRatio !== hpRatio) {
        this.renderVitalBrush(
          visual.hpBrushTextureKey,
          UNIT_VITAL_HP_TEXTURE,
          'upper',
          hpRatio,
        );
        visual.hpRatio = hpRatio;
      }
      if (visual.qiRatio !== qiRatio) {
        this.renderVitalBrush(
          visual.qiBrushTextureKey,
          UNIT_VITAL_MP_TEXTURE,
          'lower',
          qiRatio,
        );
        visual.qiRatio = qiRatio;
      }
      if (entity.shield > 0) {
        const shieldStrength = Phaser.Math.Clamp(
          entity.shield / Math.max(entity.maxHp, 1),
          0,
          1,
        );
        if (visual.shieldStrength !== shieldStrength) {
          this.renderShieldAura(
            visual.shieldTextureKey,
            radius,
            shieldStrength,
          );
          visual.shieldStrength = shieldStrength;
        }
        visual.shieldArt
          .setVisible(true)
          .setAlpha(0.78 + Math.sqrt(shieldStrength) * 0.18);
      } else {
        visual.shieldStrength = undefined;
        visual.shieldArt.setVisible(false).setAlpha(0);
      }
    }

    private renderShieldAura(
      textureKey: string,
      radius: number,
      strength: number,
    ) {
      const texture = this.textures.get(
        textureKey,
      ) as Phaser.Textures.CanvasTexture;
      const canvas = texture.getSourceImage() as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      const source = this.textures
        .get(UNIT_SHIELD_TEXTURE)
        .getSourceImage() as HTMLImageElement;
      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const displayRadius = radius + 24;
      const pixelScale = canvas.width / (displayRadius * 2);
      const innerRadius = (radius + 4) * pixelScale;
      const shieldWidth = Phaser.Math.Linear(4.5, 14, Math.sqrt(strength));
      const outerRadius = (radius + 4 + shieldWidth) * pixelScale;
      context.globalCompositeOperation = 'destination-in';
      context.beginPath();
      context.arc(
        canvas.width / 2,
        canvas.height / 2,
        outerRadius,
        0,
        Math.PI * 2,
      );
      context.arc(
        canvas.width / 2,
        canvas.height / 2,
        innerRadius,
        0,
        Math.PI * 2,
        true,
      );
      context.fill('evenodd');
      context.globalCompositeOperation = 'source-over';
      texture.refresh();
    }

    private renderVitalBrush(
      textureKey: string,
      sourceTextureKey: string,
      half: 'upper' | 'lower',
      ratio: number,
    ) {
      const texture = this.textures.get(
        textureKey,
      ) as Phaser.Textures.CanvasTexture;
      const canvas = texture.getSourceImage() as HTMLCanvasElement;
      const context = canvas.getContext('2d');
      const source = this.textures
        .get(sourceTextureKey)
        .getSourceImage() as HTMLImageElement;
      if (!context) return;

      context.clearRect(0, 0, canvas.width, canvas.height);
      if (ratio <= 0) {
        texture.refresh();
        return;
      }
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const progressMap = vitalProgressMap(half, canvas.width, canvas.height);
      const fadeStart = ratio - 0.026;
      const fadeEnd = ratio + (ratio >= 0.999 ? 0.035 : 0.014);
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const alphaIndex = (y * canvas.width + x) * 4 + 3;
          const sourceAlpha = pixels.data[alphaIndex];
          if (sourceAlpha === 0) continue;
          const progress = progressMap[y * canvas.width + x];
          const visibility = 1 - smoothStep(fadeStart, fadeEnd, progress);
          pixels.data[alphaIndex] = Math.round(sourceAlpha * visibility);
        }
      }
      context.putImageData(pixels, 0, 0);
      texture.refresh();
    }

    private playReaction(
      fact: CombatVisualFact,
      action: CombatVisualActionInput,
      duration: number,
    ) {
      if (!fact.reaction) return;
      const source = this.visuals.get(fact.reaction.sourceId);
      if (!source) return;
      const color = visualColor(action.visual);
      const label = this.add
        .text(0, -source.baseRadius - 48, fact.reaction.label, {
          fontFamily: FONT_FAMILY,
          fontSize:
            stage.profile === 'portrait'
              ? source.isPet
                ? '24px'
                : '29px'
              : source.isPet
                ? '15px'
                : '19px',
          fontStyle: 'bold',
          color: colorHex(color),
          ...outlinedText(source.isPet ? 3 : 4),
          letterSpacing: 2,
        })
        .setOrigin(0.5)
        .setAlpha(0)
        .setScale(0.86)
        .setResolution(renderScale);
      source.container.add(label);
      const transitionDuration = Math.min(180, Math.floor(duration / 3));
      const holdDuration = Math.max(0, duration - transitionDuration * 2);
      this.tweens.add({
        targets: label,
        alpha: 1,
        scale: 1,
        y: label.y - 4,
        duration: transitionDuration,
        ease: 'Back.Out',
        onComplete: () => {
          this.time.delayedCall(holdDuration, () => {
            if (!label.active) return;
            this.tweens.add({
              targets: label,
              alpha: 0,
              y: label.y - 8,
              duration: transitionDuration,
              onComplete: () => label.destroy(),
            });
          });
        },
      });
    }

    private playFact(fact: CombatVisualFact, action: CombatVisualActionInput) {
      for (const targetId of fact.targetIds) {
        const target = this.visuals.get(targetId);
        if (!target) continue;
        switch (fact.kind) {
          case 'damage':
          case 'recovery':
          case 'status':
          case 'action_state':
          case 'mechanic':
            break;
          case 'shield':
            if (fact.operation === 'break') this.playShieldBreak(target);
            break;
          case 'defense':
            if (fact.defense === 'dodge') {
              this.tweens.add({
                targets: target.container,
                x:
                  target.container.x +
                  (target.container.x < stage.width / 2 ? -32 : 32),
                duration: 130,
                yoyo: true,
                hold: 110,
                ease: 'Sine.Out',
              });
            }
            break;
          case 'resource':
            if (fact.resourceId !== 'mp') {
              this.showResourceCue(targetId, action.id, fact);
            }
            break;
          case 'death_prevented':
            this.tweens.add({
              targets: target.name,
              alpha: 0.18,
              duration: 120,
              yoyo: true,
              repeat: 3,
            });
            break;
          case 'unit_died':
            this.playDeathFragments(target);
            break;
        }
      }
    }

    private showResourceCue(
      entityId: string,
      actionId: string,
      fact: Extract<CombatVisualFact, { kind: 'resource' }>,
    ) {
      const visual = this.visuals.get(entityId);
      const entity = currentSnapshot.entities.find(
        (entry) => entry.id === entityId,
      );
      const resource = entity?.combatResources.find(
        (entry) => entry.id === fact.resourceId,
      );
      if (!visual || !resource) return;

      const key = this.resourceCueKey(entityId, fact.resourceId);
      const previous = this.resourceCues.get(key);
      previous?.hideTimer?.remove(false);
      const delta = fact.after - fact.before;
      const state: ResourceCueState = {
        actionId,
        delta: previous?.actionId === actionId ? previous.delta + delta : delta,
      };
      this.resourceCues.set(key, state);
      this.renderSnapshot(currentSnapshot);
      const resourceVisual = visual.resources.get(fact.resourceId);
      if (resourceVisual) {
        this.tweens.killTweensOf(resourceVisual.iconPulse);
        this.tweens.killTweensOf(resourceVisual.delta);
        resourceVisual.iconPulse.setScale(1);
        resourceVisual.delta.setAlpha(1).setY(resourceVisual.height / 2);
        this.tweens.add({
          targets: resourceVisual.iconPulse,
          scale: state.delta >= 0 ? 1.08 : 0.94,
          duration: 150,
          yoyo: true,
          ease: 'Sine.Out',
        });
        this.tweens.add({
          targets: resourceVisual.delta,
          alpha: 0,
          y: resourceVisual.height / 2 - 8,
          delay: 760,
          duration: 520,
          ease: 'Cubic.Out',
        });
      }
      state.hideTimer = this.time.delayedCall(1_450, () => {
        if (this.resourceCues.get(key) !== state) return;
        this.resourceCues.delete(key);
        this.renderSnapshot(currentSnapshot);
      });
    }

    private resourceCueKey(entityId: string, resourceId: string) {
      return `${entityId}:${resourceId}`;
    }

    private enqueueImpactCue(
      cue: CombatImpactCue,
      action: CombatVisualActionInput,
    ) {
      const queue = this.impactQueues.get(cue.targetId) ?? [];
      queue.push({ cue, action });
      this.impactQueues.set(cue.targetId, queue);
      if (!this.activeImpactTargets.has(cue.targetId)) {
        this.playNextImpactCue(cue.targetId);
      }
    }

    private playNextImpactCue(targetId: string) {
      const queue = this.impactQueues.get(targetId);
      const next = queue?.shift();
      if (!next) {
        this.impactQueues.delete(targetId);
        this.activeImpactTargets.delete(targetId);
        return;
      }
      this.activeImpactTargets.add(targetId);
      this.playImpactCue(next, () => {
        this.time.delayedCall(120, () => this.playNextImpactCue(targetId));
      });
    }

    private playImpactCue(entry: QueuedImpactCue, onComplete: () => void) {
      const { cue } = entry;
      const target = this.visuals.get(cue.targetId);
      if (!target) {
        onComplete();
        return;
      }
      const sourcePoint = formationPositions.get(cue.sourceId) ?? {
        x: target.container.x,
        y: target.container.y + 1,
      };
      const targetPoint = formationPositions.get(cue.targetId) ?? {
        x: target.container.x,
        y: target.container.y,
      };
      const rawX = targetPoint.x - sourcePoint.x;
      const rawY = targetPoint.y - sourcePoint.y;
      const length = Math.max(Math.hypot(rawX, rawY), 1);
      const direction =
        cue.sourceId === cue.targetId
          ? { x: 0, y: -1 }
          : { x: rawX / length, y: rawY / length };
      const anchor = {
        x: Phaser.Math.Clamp(
          targetPoint.x - direction.x * (target.radius + 12),
          58,
          stage.width - 58,
        ),
        y: Phaser.Math.Clamp(
          targetPoint.y - direction.y * (target.radius + 12),
          48,
          stage.height - 48,
        ),
      };

      let mainLabel: string;
      let mainColor: number;
      let fontSize = stage.profile === 'portrait' ? 38 : 24;
      if (cue.kind === 'damage') {
        mainLabel = `-${Math.round(cue.amount)}${cue.critical ? '！' : ''}`;
        mainColor = damageColor(cue.damageType);
        fontSize =
          stage.profile === 'portrait'
            ? cue.critical
              ? 46
              : 40
            : cue.critical
              ? 30
              : 25;
      } else if (cue.kind === 'recovery') {
        mainLabel = `+${Math.round(cue.amount)}`;
        mainColor = 0x357257;
      } else {
        mainLabel = cue.label;
        mainColor =
          cue.tone === 'survival'
            ? 0xa87918
            : cue.tone === 'defense'
              ? 0x665795
              : 0x5e5750;
        fontSize = stage.profile === 'portrait' ? 34 : 22;
      }

      const mainText = this.add
        .text(0, 0, mainLabel, {
          fontFamily: FONT_FAMILY,
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: colorHex(mainColor),
          ...outlinedText(5),
          letterSpacing: 2,
        })
        .setOrigin(0, 0.5)
        .setResolution(renderScale);
      const children: Phaser.GameObjects.GameObject[] = [mainText];
      let shieldText: Phaser.GameObjects.Text | undefined;
      if (cue.kind === 'damage' && cue.shieldAbsorbed > 0) {
        shieldText = this.add
          .text(0, 0, `（${Math.round(cue.shieldAbsorbed)}）`, {
            fontFamily: FONT_FAMILY,
            fontSize: `${Math.max(17, fontSize - 4)}px`,
            fontStyle: 'bold',
            color: '#b47d18',
            ...outlinedText(5),
            letterSpacing: 1,
          })
          .setOrigin(0, 0.5)
          .setResolution(renderScale);
        children.push(shieldText);
      }
      const gap = shieldText ? 2 : 0;
      const totalWidth = mainText.width + gap + (shieldText?.width ?? 0);
      mainText.setX(-totalWidth / 2);
      shieldText?.setX(-totalWidth / 2 + mainText.width + gap);

      const cueContainer = this.add
        .container(
          anchor.x - direction.x * 8,
          anchor.y - direction.y * 8,
          children,
        )
        .setAlpha(0)
        .setScale(0.88)
        .setDepth(9);
      this.tweens.add({
        targets: cueContainer,
        x: anchor.x + direction.x * 22,
        y: anchor.y + direction.y * 22,
        alpha: 1,
        scale: 1,
        duration: 180,
        ease: 'Back.Out',
        onComplete: () => {
          this.time.delayedCall(560, () => {
            if (!cueContainer.active) return;
            this.tweens.add({
              targets: cueContainer,
              y: cueContainer.y - 24,
              alpha: 0,
              duration: 360,
              ease: 'Cubic.In',
              onComplete: () => {
                cueContainer.destroy(true);
                onComplete();
              },
            });
          });
        },
      });
    }

    private renderNameControlFx(
      visual: EntityVisual,
      mode: CombatControlVisual | undefined,
    ) {
      if (visual.controlMode === mode) return;
      visual.controlMode = mode;
      this.tweens.killTweensOf(visual.nameControlFx);
      this.tweens.killTweensOf(visual.name);
      const nameY = visual.isPet ? -9 : -12;
      visual.name.setPosition(0, nameY).setAngle(0).setScale(1);
      const nameFx = visual.nameControlFx;
      nameFx
        .clear()
        .setPosition(0, 0)
        .setAngle(0)
        .setScale(1)
        .setAlpha(mode ? 0.92 : 0);
      if (!mode) return;

      const halfWidth = Math.max(22, visual.name.width / 2);
      const halfHeight = Math.max(10, visual.name.height / 2);
      const top = nameY - halfHeight;
      const bottom = nameY + halfHeight;
      switch (mode) {
        case 'stun':
          nameFx.fillStyle(0xc28a20, 0.94);
          for (let index = 0; index < 3; index += 1) {
            nameFx.fillCircle(
              (index - 1) * Math.min(halfWidth * 0.72, 24),
              top - 8 - (index % 2) * 3,
              index === 1 ? 3.6 : 2.8,
            );
          }
          this.tweens.add({
            targets: nameFx,
            y: -3,
            alpha: 0.52,
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          });
          this.tweens.add({
            targets: visual.name,
            x: { from: -2, to: 2 },
            duration: 110,
            yoyo: true,
            repeat: -1,
          });
          break;
        case 'bind':
          nameFx.lineStyle(2.8, 0x74517f, 0.96);
          nameFx.beginPath();
          nameFx.moveTo(-halfWidth - 4, top - 4);
          nameFx.lineTo(-halfWidth - 12, top - 4);
          nameFx.lineTo(-halfWidth - 12, bottom + 4);
          nameFx.lineTo(-halfWidth - 4, bottom + 4);
          nameFx.moveTo(halfWidth + 4, top - 4);
          nameFx.lineTo(halfWidth + 12, top - 4);
          nameFx.lineTo(halfWidth + 12, bottom + 4);
          nameFx.lineTo(halfWidth + 4, bottom + 4);
          nameFx.strokePath();
          this.tweens.add({
            targets: nameFx,
            scaleX: 0.86,
            alpha: 0.55,
            duration: 620,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          });
          break;
        case 'sleep':
          nameFx.fillStyle(0x665795, 0.9);
          for (let index = 0; index < 3; index += 1) {
            nameFx.fillCircle(
              halfWidth + 8 + index * 6,
              top - 2 - index * 5,
              2.2 + index * 0.5,
            );
          }
          nameFx.lineStyle(2, 0x665795, 0.72);
          nameFx.lineBetween(-halfWidth, bottom + 4, halfWidth, bottom + 4);
          this.tweens.add({
            targets: nameFx,
            y: -4,
            alpha: 0.42,
            duration: 1_100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
          });
          break;
        case 'freeze':
          nameFx.lineStyle(2.2, 0x4d7988, 0.94);
          nameFx.lineBetween(-halfWidth - 6, top - 3, -halfWidth + 8, top - 3);
          nameFx.lineBetween(
            halfWidth - 8,
            bottom + 3,
            halfWidth + 6,
            bottom + 3,
          );
          nameFx.lineBetween(
            -halfWidth + 4,
            bottom + 3,
            -halfWidth + 12,
            top - 3,
          );
          nameFx.lineBetween(
            halfWidth - 12,
            bottom + 3,
            halfWidth - 4,
            top - 3,
          );
          this.tweens.add({
            targets: nameFx,
            alpha: 0.45,
            duration: 480,
            yoyo: true,
            repeat: -1,
          });
          break;
        case 'generic':
          nameFx.fillStyle(0x74517f, 0.16);
          nameFx.fillRoundedRect(
            -halfWidth - 8,
            top - 4,
            halfWidth * 2 + 16,
            halfHeight * 2 + 8,
            5,
          );
          nameFx.lineStyle(2.2, 0x74517f, 0.84);
          nameFx.lineBetween(-halfWidth - 10, top, -halfWidth - 10, bottom);
          nameFx.lineBetween(halfWidth + 10, top, halfWidth + 10, bottom);
          this.tweens.add({
            targets: nameFx,
            scaleX: 1.06,
            alpha: 0.55,
            duration: 760,
            yoyo: true,
            repeat: -1,
          });
          break;
      }
    }

    private playImpactBurst(
      target: Phaser.GameObjects.Container,
      visual: CombatVisualSpec,
      color: number,
    ) {
      const burst = this.add.graphics({ x: target.x, y: target.y }).setDepth(6);
      if (visual.discipline === 'true') {
        burst.lineStyle(2.5, color, 0.7).strokeCircle(0, 0, 32);
        burst.lineStyle(1.5, 0x302437, 0.48).strokeCircle(0, 0, 48);
        burst.lineStyle(1, color, 0.32).strokeCircle(0, 0, 62);
      } else if (visual.discipline === 'spell') {
        burst.lineStyle(2.2, color, 0.68).strokeCircle(0, 0, 35);
        burst.lineStyle(1.2, color, 0.42).strokeCircle(0, 0, 51);
        burst.fillStyle(color, 0.5);
        for (let mote = 0; mote < 8; mote += 1) {
          const angle = (Math.PI * 2 * mote) / 8 + mote * 0.21;
          burst.fillCircle(Math.cos(angle) * 59, Math.sin(angle) * 59, 2.6);
        }
      } else {
        burst.lineStyle(visual.weight === 'heavy' ? 5 : 4, color, 0.76);
        for (let ray = 0; ray < 9; ray += 1) {
          const angle = (Math.PI * 2 * ray) / 9 + ray * 0.17;
          const inner = 26 + (ray % 3) * 5;
          const outer = inner + 18 + (ray % 2) * 14;
          burst.lineBetween(
            Math.cos(angle) * inner,
            Math.sin(angle) * inner,
            Math.cos(angle) * outer,
            Math.sin(angle) * outer,
          );
        }
      }
      this.tweens.add({
        targets: burst,
        alpha: 0,
        scale: visual.discipline === 'true' ? 1.46 : 1.24,
        angle: visual.discipline === 'true' ? -12 : 0,
        duration: visual.discipline === 'true' ? 1_250 : 1_000,
        ease: 'Cubic.Out',
        onComplete: () => burst.destroy(),
      });
    }

    private playShieldBreak(target: EntityVisual) {
      const fragments = this.add
        .graphics({ x: target.container.x, y: target.container.y })
        .setDepth(7);
      fragments.lineStyle(3, 0xb47d18, 0.82);
      for (let index = 0; index < 10; index += 1) {
        const angle = (Math.PI * 2 * index) / 10;
        const inner = target.radius + 5;
        const outer = target.radius + 18 + (index % 2) * 8;
        fragments.lineBetween(
          Math.cos(angle) * inner,
          Math.sin(angle) * inner,
          Math.cos(angle + 0.1) * outer,
          Math.sin(angle + 0.1) * outer,
        );
      }
      this.tweens.add({
        targets: fragments,
        scale: 1.32,
        alpha: 0,
        angle: 8,
        duration: 850,
        ease: 'Cubic.Out',
        onComplete: () => fragments.destroy(),
      });
    }

    private playDeathFragments(target: EntityVisual) {
      const fragments = this.add.graphics().setDepth(7);
      fragments.fillStyle(0x5e5750, 0.72);
      for (let index = 0; index < 12; index += 1) {
        const angle = (Math.PI * 2 * index) / 12;
        fragments.fillRect(
          target.container.x + Math.cos(angle) * (target.radius + 4),
          target.container.y + Math.sin(angle) * (target.radius + 4),
          3 + (index % 3),
          2,
        );
      }
      this.tweens.add({
        targets: fragments,
        y: 18,
        alpha: 0,
        scale: 1.24,
        duration: 1_300,
        ease: 'Cubic.Out',
        onComplete: () => fragments.destroy(),
      });
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: args.root,
    width: Math.round(stage.width * renderScale),
    height: Math.round(stage.height * renderScale),
    transparent: true,
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: Math.round(stage.width * renderScale),
      height: Math.round(stage.height * renderScale),
    },
    scene: RealtimeBattleScene,
  });

  const resizeObserver = new ResizeObserver(() => {
    if (destroyed) return;
    const nextStage = selectStage(
      args.root.clientWidth,
      args.root.clientHeight,
    );
    if (nextStage.profile === stage.profile) return;
    if (scene) {
      scene.requestRelayout(nextStage);
      return;
    }
    stage = nextStage;
    formationPositions = projectFormation(currentSnapshot.entities, stage);
  });
  resizeObserver.observe(args.root);

  return {
    syncSnapshot: (snapshot) => {
      currentSnapshot = snapshot;
      scene?.renderSnapshot(snapshot);
      args.onState(snapshot);
    },
    playTimeline: (timeline, offsetMs = 0) => {
      scene?.playTimeline(timeline, offsetMs);
    },
    focus: (entityId) => {
      if (!currentSnapshot.entities.some((entity) => entity.id === entityId))
        return;
      currentSnapshot = { ...currentSnapshot, focusedEntityId: entityId };
      scene?.renderSnapshot(currentSnapshot);
      args.onFocus(entityId);
      args.onState(currentSnapshot);
    },
    setCommandSelection: (state) => {
      scene?.setCommandSelection(state);
    },
    setPaused: (nextPaused) => {
      paused = nextPaused;
      scene?.setPlaybackState(paused, speed);
    },
    setSpeed: (nextSpeed) => {
      speed = Math.max(0.5, Math.min(nextSpeed, 2));
      scene?.setPlaybackState(paused, speed);
    },
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      resizeObserver.disconnect();
      scene = undefined;
      game.destroy(true);
    },
  };
}
