import { GAME_VIRTUAL_JOYSTICK_ASSETS } from '@app/components/feature/game-activity/virtualJoystickAssets';
import { SWEEP_CANVAS, type SweepDirection } from '@daoyou/shared/engine/sect';
import * as Phaser from 'phaser';
import VirtualJoystick from 'phaser4-rex-plugins/plugins/virtualjoystick.js';

const BASE_SIZE = 156;
const THUMB_SIZE = 72;
const JOYSTICK_RADIUS = 76;
const CENTER_EDGE_OFFSET = 118;
const IDLE_ALPHA = 0.68;
const ACTIVE_ALPHA = 0.92;
const CONTROL_DEPTH = 30;

interface SafeAreaInsets {
  bottom: number;
  left: number;
}

interface SweepVirtualJoystickOptions {
  root: HTMLElement;
  enabled: boolean;
  onMove: (direction: SweepDirection) => boolean;
}

export interface SweepVirtualJoystickController {
  setEnabled: (enabled: boolean) => void;
}

function numericStyleValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createSafeAreaProbe(root: HTMLElement) {
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  Object.assign(probe.style, {
    position: 'fixed',
    inset: '0',
    width: '0',
    height: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
  });
  root.appendChild(probe);

  return {
    read(): SafeAreaInsets {
      const style = window.getComputedStyle(probe);
      return {
        bottom: numericStyleValue(style.paddingBottom),
        left: numericStyleValue(style.paddingLeft),
      };
    },
    destroy() {
      probe.remove();
    },
  };
}

function activeDirection(
  joystick: InstanceType<typeof VirtualJoystick>,
): SweepDirection | undefined {
  if (joystick.up) return 'up';
  if (joystick.right) return 'right';
  if (joystick.down) return 'down';
  if (joystick.left) return 'left';
  return undefined;
}

export function attachSweepVirtualJoystick(
  scene: Phaser.Scene,
  options: SweepVirtualJoystickOptions,
): SweepVirtualJoystickController {
  const base = scene.add
    .image(0, 0, GAME_VIRTUAL_JOYSTICK_ASSETS.base.key)
    .setDisplaySize(BASE_SIZE, BASE_SIZE)
    .setAlpha(IDLE_ALPHA)
    .setDepth(CONTROL_DEPTH);
  const thumb = scene.add
    .image(0, 0, GAME_VIRTUAL_JOYSTICK_ASSETS.thumb.key)
    .setDisplaySize(THUMB_SIZE, THUMB_SIZE)
    .setAlpha(IDLE_ALPHA)
    .setDepth(CONTROL_DEPTH + 1);
  const joystick = new VirtualJoystick(scene, {
    x: CENTER_EDGE_OFFSET,
    y: SWEEP_CANVAS.height - CENTER_EDGE_OFFSET,
    radius: JOYSTICK_RADIUS,
    base,
    thumb,
    dir: '4dir',
    forceMin: 24,
    // The scene camera is static. Fixed mode forces scrollFactor(0), which
    // shifts the control off-screen when the camera is zoomed for DPR.
    fixed: false,
    enable: options.enabled,
  });
  const safeAreaProbe = createSafeAreaProbe(options.root);
  let enabled = options.enabled;
  let armed = true;
  let destroyed = false;
  let relayoutFrame: number | undefined;

  const setVisualAlpha = (alpha: number) => {
    scene.tweens.add({
      targets: [base, thumb],
      alpha,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  };

  const blockedFeedback = () => {
    navigator.vibrate?.(15);
    const scaleX = thumb.scaleX;
    const scaleY = thumb.scaleY;
    scene.tweens.add({
      targets: thumb,
      scaleX: { from: scaleX * 0.88, to: scaleX },
      scaleY: { from: scaleY * 0.88, to: scaleY },
      duration: 90,
      ease: 'Back.easeOut',
    });
  };

  const onUpdate = () => {
    if (!enabled) return;
    if (joystick.noKey) {
      armed = true;
      return;
    }
    if (!armed) return;
    const direction = activeDirection(joystick);
    if (!direction) return;
    armed = false;
    if (!options.onMove(direction)) blockedFeedback();
  };

  const onPointerDown = () => {
    if (!enabled) return;
    setVisualAlpha(ACTIVE_ALPHA);
  };

  const onPointerUp = () => {
    armed = true;
    if (enabled) setVisualAlpha(IDLE_ALPHA);
  };

  const relayout = () => {
    if (destroyed) return;
    const bounds = scene.game.canvas.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const safeArea = safeAreaProbe.read();
    const viewportHeight = window.innerHeight;
    const canvasSafeLeft = Math.max(0, safeArea.left - bounds.left);
    const canvasSafeBottom = Math.max(
      0,
      safeArea.bottom - (viewportHeight - bounds.bottom),
    );
    const logicalSafeLeft =
      canvasSafeLeft * (SWEEP_CANVAS.width / bounds.width);
    const logicalSafeBottom =
      canvasSafeBottom * (SWEEP_CANVAS.height / bounds.height);
    const x = Phaser.Math.Clamp(
      logicalSafeLeft + CENTER_EDGE_OFFSET,
      CENTER_EDGE_OFFSET,
      SWEEP_CANVAS.width - CENTER_EDGE_OFFSET,
    );
    const y = Phaser.Math.Clamp(
      SWEEP_CANVAS.height - logicalSafeBottom - CENTER_EDGE_OFFSET,
      CENTER_EDGE_OFFSET,
      SWEEP_CANVAS.height - CENTER_EDGE_OFFSET,
    );
    joystick.setPosition(x, y);
  };

  const scheduleRelayout = () => {
    if (relayoutFrame !== undefined) window.cancelAnimationFrame(relayoutFrame);
    relayout();
    relayoutFrame = window.requestAnimationFrame(() => {
      relayoutFrame = undefined;
      relayout();
    });
  };

  const setEnabled = (nextEnabled: boolean) => {
    enabled = nextEnabled;
    armed = true;
    joystick.setVisible(nextEnabled).setEnable(nextEnabled);
    thumb.setPosition(base.x, base.y);
    if (nextEnabled) {
      base.setAlpha(IDLE_ALPHA);
      thumb.setAlpha(IDLE_ALPHA);
      scheduleRelayout();
    }
  };

  joystick.on('update', onUpdate);
  joystick.on('pointerdown', onPointerDown);
  joystick.on('pointerup', onPointerUp);
  scene.scale.on(Phaser.Scale.Events.RESIZE, scheduleRelayout);
  window.addEventListener('resize', scheduleRelayout);
  window.visualViewport?.addEventListener('resize', scheduleRelayout);
  setEnabled(options.enabled);
  scheduleRelayout();

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    if (relayoutFrame !== undefined) window.cancelAnimationFrame(relayoutFrame);
    scene.scale.off(Phaser.Scale.Events.RESIZE, scheduleRelayout);
    window.removeEventListener('resize', scheduleRelayout);
    window.visualViewport?.removeEventListener('resize', scheduleRelayout);
    safeAreaProbe.destroy();
    joystick.destroy();
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, destroy);

  return {
    setEnabled,
  };
}
