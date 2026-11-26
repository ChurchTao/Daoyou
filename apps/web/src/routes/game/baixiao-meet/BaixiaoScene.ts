import * as Phaser from 'phaser';

export function mountBaixiaoScene(parent: HTMLElement) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let turn = () => {};

  class HallScene extends Phaser.Scene {
    create() {
      const ring = this.add.circle(480, 320, 170).setAlpha(0);
      turn = () => {
        this.tweens.killTweensOf(ring);
        if (reducedMotion.matches) {
          ring.setAlpha(0);
          return;
        }
        const ink = getComputedStyle(parent)
          .getPropertyValue('--color-wood')
          .trim();
        ring.setStrokeStyle(
          1,
          Phaser.Display.Color.HexStringToColor(ink).color,
          0.28,
        );
        ring.setScale(0.85).setAlpha(0.38);
        this.tweens.add({
          targets: ring,
          alpha: 0,
          scale: 1.65,
          duration: 550,
          ease: 'Sine.Out',
        });
      };
    }
  }

  const game = new Phaser.Game({
    parent,
    width: 960,
    height: 640,
    type: Phaser.CANVAS,
    transparent: true,
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false },
    scale: { mode: Phaser.Scale.ENVELOP, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: HallScene,
  });
  return { turn: () => turn(), destroy: () => game.destroy(true) };
}
