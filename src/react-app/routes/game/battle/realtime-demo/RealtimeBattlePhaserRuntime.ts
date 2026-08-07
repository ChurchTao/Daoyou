import type {
  CombatControlVisual,
  CombatImpactCue,
  CombatVisualActionInput,
  CombatVisualFact,
  CombatVisualSpec,
  CombatVisualTimeline,
} from '@shared/engine/battle-v5/presentation';
import * as Phaser from 'phaser';
import {
  RealtimeBattleSimulation,
  type RealtimeBattleCommand,
  type RealtimeBattleEntity,
  type RealtimeBattleSnapshot,
  type RealtimeBattleTeam,
} from './realtimeBattleSimulation';

const DESKTOP_STAGE = { width: 1280, height: 720 } as const;
const MOBILE_STAGE = { width: 720, height: 1080 } as const;
const FONT_FAMILY = 'LXGWWenKai, serif';
const TEXT_OUTLINE_COLOR = '#eee7d6';

function outlinedText(strokeThickness: number) {
  return {
    stroke: TEXT_OUTLINE_COLOR,
    strokeThickness,
  };
}

type StageSize = { width: number; height: number };
type FormationPoint = { x: number; y: number };

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
  onState: (snapshot: RealtimeBattleSnapshot) => void;
  onFocus: (entityId: string) => void;
}

export interface RealtimeBattlePhaserController {
  command: (command: RealtimeBattleCommand) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: number) => void;
  destroy: () => void;
}

interface EntityVisual {
  container: Phaser.GameObjects.Container;
  selection: Phaser.GameObjects.Arc;
  resourceRings: Phaser.GameObjects.Graphics;
  resourceLeaders: Phaser.GameObjects.Graphics;
  name: Phaser.GameObjects.Text;
  hpValue: Phaser.GameObjects.Text;
  qiValue: Phaser.GameObjects.Text;
  shieldValue: Phaser.GameObjects.Text;
  combatResourceDom: Phaser.GameObjects.DOMElement;
  combatResourceSteady: HTMLDivElement;
  combatResourcePips: HTMLSpanElement;
  combatResourceDelta: HTMLDivElement;
  combatResourceDeltaIcon: HTMLSpanElement;
  combatResourceDeltaValue: HTMLSpanElement;
  actionStateText: Phaser.GameObjects.Text;
  buffText: Phaser.GameObjects.Text;
  debuffText: Phaser.GameObjects.Text;
  nameControlFx: Phaser.GameObjects.Graphics;
  controlMode?: CombatControlVisual;
  isPet: boolean;
  radius: number;
}

interface ResourceCueState {
  actionId: string;
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

function formationRadius(entity: RealtimeBattleEntity, stage: StageSize) {
  const compact = stage.width < 900;
  if (entity.kind === 'spirit-pet') return compact ? 34 : 44;
  return compact ? 50 : 62;
}

function formationBackY(team: RealtimeBattleTeam, stage: StageSize) {
  const compact = stage.width < 900;
  if (team === 'enemies') return stage.height * (compact ? 0.28 : 0.24);
  return stage.height * (compact ? 0.72 : 0.76);
}

function formationPetOffset(team: RealtimeBattleTeam, stage: StageSize) {
  const distance = stage.width < 900 ? 110 : 120;
  const angle = (35 * Math.PI) / 180;
  const frontDirection = team === 'enemies' ? 1 : -1;
  const sideDirection = team === 'enemies' ? 1 : -1;
  return {
    x: sideDirection * Math.sin(angle) * distance,
    y: frontDirection * Math.cos(angle) * distance,
  };
}

function formationSlotX(slot: number, stage: StageSize) {
  const sideInset = stage.width * 0.235;
  return sideInset + ((stage.width - sideInset * 2) * slot) / 2;
}

function projectFormation(entities: RealtimeBattleEntity[], stage: StageSize) {
  const positions = new Map<string, FormationPoint>();
  for (const team of ['enemies', 'allies'] as const) {
    const teamEntities = entities.filter((entity) => entity.team === team);
    const owners = teamEntities
      .filter((entity) => entity.kind === 'cultivator')
      .sort(
        (left, right) =>
          FORMATION_OWNER_ORDER.indexOf(left.id) -
          FORMATION_OWNER_ORDER.indexOf(right.id),
      )
      .slice(0, 3);
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
        .slice(0, Math.max(0, 3 - groups.length))
        .map((pet) => ({ owner: undefined, pet })),
    );

    const backY = formationBackY(team, stage);
    const petOffset = formationPetOffset(team, stage);
    groups.forEach(({ owner, pet }, slot) => {
      const x = formationSlotX(slot, stage);
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
}

export function attachRealtimeBattlePhaser(
  args: RealtimeBattlePhaserArguments,
): RealtimeBattlePhaserController {
  const rootAspect =
    args.root.clientWidth / Math.max(args.root.clientHeight, 1);
  const stage: StageSize =
    rootAspect < 1 ? { ...MOBILE_STAGE } : { ...DESKTOP_STAGE };
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
  let paused = false;
  let speed = 1;
  let destroyed = false;
  let lastReportAt = 0;

  const simulation = new RealtimeBattleSimulation((timeline) => {
    scene?.playTimeline(timeline);
  });
  const formationPositions = projectFormation(
    simulation.snapshot().entities,
    stage,
  );

  const registerScene = (nextScene: RealtimeBattleScene) => {
    scene = nextScene;
  };

  class RealtimeBattleScene extends Phaser.Scene {
    private visuals = new Map<string, EntityVisual>();
    private castLabels = new Map<string, Phaser.GameObjects.Text>();
    private resourceCues = new Map<string, ResourceCueState>();
    private impactQueues = new Map<string, QueuedImpactCue[]>();
    private activeImpactTargets = new Set<string>();

    create() {
      registerScene(this);
      this.cameras.main
        .setZoom(renderScale)
        .centerOn(stage.width / 2, stage.height / 2);
      this.createPaperField();
      this.createFormationInk();
      for (const entity of simulation.snapshot().entities) {
        this.createEntity(entity);
      }
      this.renderSnapshot(simulation.snapshot());
      this.game.canvas.setAttribute(
        'aria-label',
        '多人实时字阵战场。点击文字单位选择目标，使用下方文字指令施展招式。',
      );
      this.game.canvas.setAttribute('role', 'application');
      args.onState(simulation.snapshot());
    }

    update(_time: number, delta: number) {
      if (!paused) simulation.step(delta * speed);
      const snapshot = simulation.snapshot();
      this.renderSnapshot(snapshot);
      if (
        snapshot.elapsedMs - lastReportAt >= 100 ||
        snapshot.elapsedMs < lastReportAt
      ) {
        lastReportAt = snapshot.elapsedMs;
        args.onState(snapshot);
      }
    }

    setPlaybackState(nextPaused: boolean, nextSpeed: number) {
      this.time.paused = nextPaused;
      this.time.timeScale = nextSpeed;
      this.tweens.paused = nextPaused;
      this.tweens.timeScale = nextSpeed;
    }

    playTimeline(timeline: CombatVisualTimeline) {
      for (const command of timeline.commands) {
        this.time.delayedCall(command.at, () => {
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
            this.playReaction(command.fact, timeline.action);
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
        .text(0, -source.radius - 72, action.ability.name, {
          fontFamily: FONT_FAMILY,
          fontSize: source.isPet ? '16px' : '20px',
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
          this.playMeleeDelivery(
            source,
            targets[0],
            action,
            color,
            duration,
            impactOffset,
          );
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
      target: EntityVisual,
      action: CombatVisualActionInput,
      color: number,
      duration: number,
      impactOffset: number,
    ) {
      const origin = { x: source.container.x, y: source.container.y };
      const distance = Phaser.Math.Distance.Between(
        origin.x,
        origin.y,
        target.container.x,
        target.container.y,
      );
      const ratio = Phaser.Math.Clamp(
        (distance - source.radius * 0.5 - target.radius * 0.72) /
          Math.max(distance, 1),
        0.58,
        0.87,
      );
      this.tweens.add({
        targets: source.container,
        x: origin.x + (target.container.x - origin.x) * ratio,
        y: origin.y + (target.container.y - origin.y) * ratio,
        duration: Math.max(260, impactOffset),
        ease: action.visual.weight === 'heavy' ? 'Expo.In' : 'Cubic.In',
        onComplete: () => {
          this.playImpactBurst(target.container, action.visual, color);
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
        },
      });
    }

    private createPaperField() {
      const paper = this.add.graphics().setDepth(0);
      paper.fillStyle(0xeee7d6, 1).fillRect(0, 0, stage.width, stage.height);
      paper.fillStyle(0x2a2018, 0.035);
      for (let index = 0; index < 150; index += 1) {
        const x = (index * 83) % stage.width;
        const y = (index * 137) % stage.height;
        const radius = 0.7 + (index % 4) * 0.45;
        paper.fillCircle(x, y, radius);
      }
    }

    private createFormationInk() {
      const formation = this.add.graphics().setDepth(0.5);
      const centerRadius = Math.min(stage.width, stage.height) * 0.19;
      formation.lineStyle(1, 0x4f4338, 0.12);
      formation.strokeCircle(stage.width / 2, stage.height / 2, centerRadius);
      formation.strokeCircle(
        stage.width / 2,
        stage.height / 2,
        centerRadius * 1.42,
      );
      formation.lineBetween(
        96,
        stage.height / 2,
        stage.width - 96,
        stage.height / 2,
      );
      formation.lineStyle(1, 0x8b2832, 0.13);
      formation.lineBetween(
        stage.width / 2,
        92,
        stage.width / 2,
        stage.height - 82,
      );
      formation.lineStyle(2, 0x75474a, 0.1);
      const enemyPetOffset = formationPetOffset('enemies', stage);
      const allyPetOffset = formationPetOffset('allies', stage);
      const formationHeight =
        Math.abs(enemyPetOffset.y) + (stage.width < 900 ? 150 : 180);
      formation.strokeEllipse(
        stage.width / 2,
        formationBackY('enemies', stage) + enemyPetOffset.y / 2,
        stage.width * 0.78,
        formationHeight,
      );
      formation.lineStyle(2, 0x475b50, 0.1);
      formation.strokeEllipse(
        stage.width / 2,
        formationBackY('allies', stage) + allyPetOffset.y / 2,
        stage.width * 0.78,
        formationHeight,
      );
    }

    private createEntity(entity: RealtimeBattleEntity) {
      const position = formationPositions.get(entity.id) ?? {
        x: stage.width / 2,
        y: stage.height / 2,
      };
      const isPet = entity.kind === 'spirit-pet';
      const compact = stage.width < 900;
      const teamColor = entity.team === 'allies' ? 0x3f6b56 : 0x8e3039;
      const textColor = entity.team === 'allies' ? '#243d33' : '#55252a';
      const radius = formationRadius(entity, stage);
      const resourceRings = this.add.graphics();
      const resourceLeaders = this.add.graphics();
      const nameControlFx = this.add.graphics().setAlpha(0);
      const selection = this.add
        .circle(0, 0, radius + 18, teamColor, 0)
        .setStrokeStyle(2, teamColor, 0)
        .setAlpha(0);
      const name = this.add
        .text(0, isPet ? -9 : -12, entity.name, {
          fontFamily: FONT_FAMILY,
          fontSize: isPet
            ? compact
              ? '15px'
              : '18px'
            : compact
              ? '22px'
              : '27px',
          color: textColor,
          fontStyle: 'bold',
          ...outlinedText(isPet ? 3 : 4),
          letterSpacing: isPet ? 1 : 2,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const hpValue = this.add
        .text(-radius * 0.5, -radius - 12, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '9px' : isPet ? '11px' : '13px',
          color: '#90323c',
          ...outlinedText(compact ? 2 : 3),
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const qiValue = this.add
        .text(radius * 0.5, -radius - 12, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '9px' : isPet ? '11px' : '13px',
          color: '#276d83',
          ...outlinedText(compact ? 2 : 3),
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const shieldValue = this.add
        .text(0, radius + 10, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '9px' : isPet ? '11px' : '13px',
          color: '#946718',
          ...outlinedText(compact ? 2 : 3),
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const combatResourceNode = document.createElement('div');
      const combatResourceSteady = document.createElement('div');
      const combatResourcePips = document.createElement('span');
      const combatResourceDelta = document.createElement('div');
      const combatResourceDeltaIcon = document.createElement('span');
      const combatResourceDeltaValue = document.createElement('span');
      combatResourceNode.setAttribute('aria-hidden', 'true');
      Object.assign(combatResourceNode.style, {
        color: '#695037',
        fontSize: compact ? (isPet ? '11px' : '13px') : isPet ? '13px' : '16px',
        lineHeight: '1',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      });
      Object.assign(combatResourceSteady.style, {
        display: 'flex',
        alignItems: 'center',
      });
      Object.assign(combatResourceDelta.style, {
        display: 'none',
        alignItems: 'center',
        gap: '4px',
        fontFamily: FONT_FAMILY,
        fontWeight: '700',
      });
      for (const iconNode of [combatResourcePips, combatResourceDeltaIcon]) {
        Object.assign(iconNode.style, {
          fontFamily:
            '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
          letterSpacing: '0.16em',
        });
      }
      Object.assign(combatResourceDeltaValue.style, {
        letterSpacing: '0.06em',
        textShadow:
          '-1px -1px 0 #eee7d6, 1px -1px 0 #eee7d6, -1px 1px 0 #eee7d6, 1px 1px 0 #eee7d6',
      });
      const iconHueRotation = entity.combatResources[0]?.iconHueRotation;
      if (iconHueRotation) {
        const filter = `hue-rotate(${iconHueRotation}deg)`;
        combatResourcePips.style.filter = filter;
        combatResourceDeltaIcon.style.filter = filter;
      }
      combatResourceSteady.append(combatResourcePips);
      combatResourceDelta.append(
        combatResourceDeltaIcon,
        combatResourceDeltaValue,
      );
      combatResourceNode.append(combatResourceSteady, combatResourceDelta);
      const combatResourceDom = this.add
        .dom(position.x, position.y + (isPet ? 12 : 20), combatResourceNode)
        .setOrigin(0.5)
        .setDepth(4);
      const actionStateText = this.add
        .text(0, radius + 30, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '8px' : isPet ? '9px' : '11px',
          color: '#735080',
          ...outlinedText(3),
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const buffText = this.add
        .text(0, radius + 64, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '9px' : isPet ? '10px' : '12px',
          color: '#357257',
          ...outlinedText(3),
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);
      const debuffText = this.add
        .text(0, radius + 47, '', {
          fontFamily: FONT_FAMILY,
          fontSize: compact ? '9px' : isPet ? '10px' : '12px',
          color: '#a32d3b',
          ...outlinedText(3),
          letterSpacing: 1,
        })
        .setOrigin(0.5)
        .setResolution(renderScale);

      const container = this.add
        .container(position.x, position.y, [
          selection,
          resourceRings,
          resourceLeaders,
          nameControlFx,
          name,
          hpValue,
          qiValue,
          shieldValue,
          actionStateText,
          buffText,
          debuffText,
        ])
        .setSize((radius + 54) * 2, (radius + 48) * 2)
        .setInteractive({ useHandCursor: true })
        .setDepth(3);
      container.on('pointerdown', () => {
        simulation.focus(entity.id);
        args.onFocus(entity.id);
        args.onState(simulation.snapshot());
      });

      this.visuals.set(entity.id, {
        container,
        selection,
        resourceRings,
        resourceLeaders,
        name,
        hpValue,
        qiValue,
        shieldValue,
        combatResourceDom,
        combatResourceSteady,
        combatResourcePips,
        combatResourceDelta,
        combatResourceDeltaIcon,
        combatResourceDeltaValue,
        actionStateText,
        buffText,
        debuffText,
        nameControlFx,
        isPet,
        radius,
      });
    }

    private renderSnapshot(snapshot: RealtimeBattleSnapshot) {
      for (const entity of snapshot.entities) {
        const visual = this.visuals.get(entity.id);
        if (!visual) continue;
        const isFocused = snapshot.focusedEntityId === entity.id;
        this.drawResourceRings(visual, entity);
        visual.hpValue.setText(`血 ${Math.ceil(entity.hp)}`);
        visual.qiValue.setText(`气 ${Math.ceil(entity.qi)}`);
        visual.shieldValue
          .setText(entity.shield > 0 ? `护 ${Math.ceil(entity.shield)}` : '')
          .setVisible(entity.alive && entity.shield > 0);
        const combatResource = entity.combatResources[0];
        const resourceCueActive = this.resourceCues.has(entity.id);
        visual.combatResourcePips.textContent =
          entity.alive && combatResource?.current
            ? combatResource.icon.repeat(combatResource.current)
            : '';
        visual.combatResourceSteady.style.display = resourceCueActive
          ? 'none'
          : 'flex';
        visual.combatResourceDelta.style.display = resourceCueActive
          ? 'flex'
          : 'none';
        visual.combatResourceDom
          .setPosition(
            visual.container.x,
            visual.container.y + (visual.isPet ? 12 : 20),
          )
          .setVisible(
            entity.alive &&
              Boolean(combatResource) &&
              (resourceCueActive || Boolean(combatResource?.current)),
          );
        const controls = entity.effects
          .filter((effect) => effect.statusType === 'control')
          .slice(-2);
        const localStates = entity.actionStates
          .map((state) => state.label)
          .slice(-2);
        visual.actionStateText.setText(
          entity.alive ? localStates.join(' · ') : '',
        );
        const buffs = entity.effects
          .filter((effect) => effect.tone === 'buff')
          .map(
            (effect) =>
              `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
          )
          .slice(-2);
        const debuffs = entity.effects
          .filter(
            (effect) =>
              effect.tone === 'debuff' && effect.statusType !== 'control',
          )
          .map(
            (effect) =>
              `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
          )
          .slice(-2);
        visual.buffText.setText(
          entity.alive && buffs.length > 0 ? buffs.join(' / ') : '',
        );
        visual.debuffText.setText(
          entity.alive && debuffs.length > 0 ? debuffs.join(' / ') : '',
        );
        this.renderNameControlFx(
          visual,
          entity.alive && controls.length > 0
            ? (controls[0].controlVisual ?? 'generic')
            : undefined,
        );
        visual.selection.setAlpha(isFocused ? 0.68 : 0);
        visual.selection.setStrokeStyle(
          isFocused ? 2 : 0,
          entity.team === 'allies' ? 0x3f6b56 : 0x9d303a,
          isFocused ? 0.62 : 0,
        );
        visual.resourceRings.setAlpha(entity.alive ? 1 : 0.18);
        visual.resourceLeaders.setAlpha(entity.alive ? 1 : 0.18);
        visual.hpValue.setVisible(entity.alive);
        visual.qiValue.setVisible(entity.alive);
        visual.name
          .setAlpha(
            entity.alive ? (entity.hp / entity.maxHp < 0.3 ? 0.66 : 1) : 0.35,
          )
          .setColor(
            entity.alive
              ? entity.team === 'allies'
                ? '#243d33'
                : '#55252a'
              : '#6f675e',
          );
      }
    }

    private drawResourceRings(
      visual: EntityVisual,
      entity: RealtimeBattleEntity,
    ) {
      const graphics = visual.resourceRings;
      const leaders = visual.resourceLeaders;
      const radius = visual.radius;
      const start = -Math.PI / 2;
      const hpRatio = Phaser.Math.Clamp(entity.hp / entity.maxHp, 0, 1);
      const qiRatio = Phaser.Math.Clamp(entity.qi / entity.maxQi, 0, 1);
      const shieldRatio = Phaser.Math.Clamp(entity.shield / 180, 0, 1);
      const drawProgress = (
        ringRadius: number,
        ratio: number,
        color: number,
        width: number,
      ) => {
        graphics.lineStyle(width, color, 0.92);
        graphics.beginPath();
        graphics.arc(
          0,
          0,
          ringRadius,
          start,
          start + Math.PI * 2 * Math.max(0.008, ratio),
        );
        graphics.strokePath();
      };

      graphics.clear();
      leaders.clear();
      graphics.lineStyle(2, 0x44382f, 0.12);
      graphics.strokeCircle(0, 0, radius);
      graphics.lineStyle(1.8, 0x44382f, 0.1);
      graphics.strokeCircle(0, 0, radius - 7);
      drawProgress(radius, hpRatio, 0xa23843, 3.4);
      drawProgress(radius - 7, qiRatio, 0x28758d, 2.8);

      leaders.lineStyle(1.2, 0xa23843, 0.56);
      leaders.beginPath();
      leaders.moveTo(-radius * 0.38, -radius * 0.92);
      leaders.lineTo(-radius * 0.5, -radius - 7);
      leaders.strokePath();
      leaders.lineStyle(1.2, 0x28758d, 0.56);
      leaders.beginPath();
      leaders.moveTo((radius - 7) * 0.38, -(radius - 7) * 0.92);
      leaders.lineTo(radius * 0.5, -radius - 7);
      leaders.strokePath();

      if (entity.shield > 0) {
        graphics.lineStyle(1.6, 0x44382f, 0.08);
        graphics.strokeCircle(0, 0, radius + 8);
        drawProgress(radius + 8, shieldRatio, 0xd09a26, 3.2);
        leaders.lineStyle(1.2, 0xb57e19, 0.6);
        leaders.beginPath();
        leaders.moveTo((radius + 8) * 0.42, (radius + 8) * 0.9);
        leaders.lineTo(0, radius + 7);
        leaders.strokePath();
      }
    }

    private playReaction(
      fact: CombatVisualFact,
      action: CombatVisualActionInput,
    ) {
      if (!fact.reaction) return;
      const source = this.visuals.get(fact.reaction.sourceId);
      if (!source) return;
      const color = visualColor(action.visual);
      const label = this.add
        .text(0, -source.radius - 48, fact.reaction.label, {
          fontFamily: FONT_FAMILY,
          fontSize: source.isPet ? '14px' : '17px',
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
      this.tweens.add({
        targets: label,
        alpha: 1,
        scale: 1,
        y: label.y - 4,
        duration: 260,
        ease: 'Back.Out',
        onComplete: () => {
          this.time.delayedCall(720, () => {
            if (!label.active) return;
            this.tweens.add({
              targets: label,
              alpha: 0,
              y: label.y - 8,
              duration: 320,
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
      const entity = simulation
        .snapshot()
        .entities.find((entry) => entry.id === entityId);
      const resource = entity?.combatResources.find(
        (entry) => entry.id === fact.resourceId,
      );
      if (!visual || !resource) return;

      const previous = this.resourceCues.get(entityId);
      previous?.hideTimer?.remove(false);
      const delta = fact.after - fact.before;
      visual.combatResourceDeltaIcon.textContent = resource.icon;
      visual.combatResourceDeltaValue.textContent = `${delta >= 0 ? '+' : ''}${Math.round(delta)}`;
      visual.combatResourceDeltaValue.style.color =
        delta >= 0 ? '#357257' : '#a32d3b';
      visual.combatResourceSteady.style.display = 'none';
      visual.combatResourceDelta.style.display = 'flex';

      const state: ResourceCueState = { actionId };
      this.resourceCues.set(entityId, state);
      state.hideTimer = this.time.delayedCall(1_450, () => {
        if (this.resourceCues.get(entityId) !== state) return;
        this.resourceCues.delete(entityId);
        visual.combatResourceDelta.style.display = 'none';
        visual.combatResourceSteady.style.display = 'flex';
      });
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
      let fontSize = 22;
      if (cue.kind === 'damage') {
        mainLabel = `-${Math.round(cue.amount)}${cue.critical ? '！' : ''}`;
        mainColor = damageColor(cue.damageType);
        fontSize = cue.critical ? 27 : 23;
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
        fontSize = 20;
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
    backgroundColor: '#eee7d6',
    transparent: false,
    antialias: true,
    antialiasGL: true,
    pixelArt: false,
    roundPixels: false,
    dom: {
      createContainer: true,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: Math.round(stage.width * renderScale),
      height: Math.round(stage.height * renderScale),
    },
    scene: RealtimeBattleScene,
  });

  return {
    command: (command) => {
      simulation.command(command);
      args.onState(simulation.snapshot());
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
      scene = undefined;
      game.destroy(true);
    },
  };
}
