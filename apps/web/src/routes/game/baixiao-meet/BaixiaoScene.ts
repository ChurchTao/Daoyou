import * as Phaser from 'phaser';

export function mountBaixiaoScene(parent: HTMLElement) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let turn = () => {};

  class HallScene extends Phaser.Scene {
    preload() {
      this.load.image('dajin-hall', '/assets/maps/dajin-region-v1.webp');
    }

    create() {
      this.add
        .image(480, 320, 'dajin-hall')
        .setDisplaySize(1020, 705)
        .setAlpha(0.3);
      const ring = this.add
        .circle(480, 320, 170)
        .setStrokeStyle(1, 0x93816a, 0.7)
        .setAlpha(0);
      turn = () => {
        this.tweens.killTweensOf(ring);
        ring.setScale(0.85).setAlpha(0.55);
        if (reducedMotion.matches) {
          ring.setAlpha(0);
          return;
        }
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
