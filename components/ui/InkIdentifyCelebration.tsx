'use client';

import confetti from 'canvas-confetti';
import { useEffect } from 'react';

export interface IdentifyCelebrationData {
  rank?: string; // 品级信息，用于确定颜色主题
}

interface IdentifyCelebrationProps extends IdentifyCelebrationData {
  variant?: 'identify' | 'basic';
  onComplete?: () => void;
}

/**
 * 鉴定天品以上材料时的庆祝特效
 * 使用 School Pride 连续五彩纸屑（无弹窗）
 */
export function InkIdentifyCelebration({
  rank,
  variant = 'identify',
  onComplete,
}: IdentifyCelebrationProps) {
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery.matches) {
      onComplete?.();
      return;
    }

    if (variant === 'basic') {
      const rafId = runBasicConfetti(onComplete);
      return () => {
        cancelAnimationFrame(rafId);
      };
    }

    const rootStyle = getComputedStyle(document.documentElement);
    const tierVar = rank?.includes('神')
      ? '--color-tier-shen'
      : rank?.includes('仙')
        ? '--color-tier-xian'
        : '--color-tier-tian';
    const tierColor = rootStyle.getPropertyValue(tierVar).trim() || '#efbf04';
    const colors = makeVariantColors(tierColor);

    const end = Date.now() + 3 * 1000;
    let rafId = 0;
    let stopped = false;
    let frameCount = 0;

    const frame = () => {
      if (stopped) return;

      frameCount += 1;
      if (frameCount % 2 === 0) {
        if (Date.now() < end) {
          rafId = requestAnimationFrame(frame);
        } else {
          onComplete?.();
        }
        return;
      }

      confetti({
        particleCount: 1,
        angle: 60,
        spread: 55,
        zIndex: 260,
        origin: { x: 0 },
        colors,
      });

      confetti({
        particleCount: 1,
        angle: 120,
        spread: 55,
        zIndex: 260,
        origin: { x: 1 },
        colors,
      });

      if (Date.now() < end) {
        rafId = requestAnimationFrame(frame);
      } else {
        onComplete?.();
      }
    };

    frame();

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
  }, [rank, variant, onComplete]);

  return null;
}

function runBasicConfetti(onComplete?: () => void): number {
  const duration = 1400;
  const end = Date.now() + duration;
  let rafId = 0;

  const frame = () => {
    const remaining = end - Date.now();
    if (remaining <= 0) {
      onComplete?.();
      return;
    }

    const particleCount = Math.max(10, Math.floor((remaining / duration) * 28));
    confetti({
      particleCount,
      spread: 68,
      startVelocity: 42,
      zIndex: 260,
      origin: { x: Math.random(), y: 0.22 + Math.random() * 0.2 },
    });

    rafId = requestAnimationFrame(frame);
  };

  frame();
  return rafId;
}

function makeVariantColors(baseHex: string): string[] {
  const rgb = hexToRgb(baseHex);
  if (!rgb) return DEFAULT_COLORS;
  const hsl = rgbToHsl(rgb);

  return [
    baseHex,
    hslToHex(adjustHsl(hsl, -14, 6, -10)),
    hslToHex(adjustHsl(hsl, 14, -6, 10)),
    hslToHex(adjustHsl(hsl, -28, 10, 16)),
    hslToHex(adjustHsl(hsl, 28, 8, -14)),
    hslToHex(adjustHsl(hsl, 0, -26, 22)),
    hslToHex(adjustHsl(hsl, 0, 22, -20)),
    '#f6f1e3',
  ];
}

const DEFAULT_COLORS = [
  '#efbf04',
  '#ffd24a',
  '#d3a800',
  '#f4cf5f',
  '#c88a1f',
  '#f6f1e3',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.trim().replace('#', '');
  const value =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((c) => `${c}${c}`)
          .join('')
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;

  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

function rgbToHsl(rgb: { r: number; g: number; b: number }) {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

function adjustHsl(
  hsl: { h: number; s: number; l: number },
  dh: number,
  ds: number,
  dl: number,
) {
  return {
    h: normalizeHue(hsl.h + dh),
    s: clampPercent(hsl.s + ds),
    l: clampPercent(hsl.l + dl),
  };
}

function normalizeHue(value: number): number {
  const mod = value % 360;
  return mod < 0 ? mod + 360 : mod;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function hslToHex(hsl: { h: number; s: number; l: number }): string {
  const s = hsl.s / 100;
  const l = hsl.l / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const h = hsl.h / 60;
  const x = c * (1 - Math.abs((h % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 1) [r, g, b] = [c, x, 0];
  else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x];
  else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = l - c / 2;
  return rgbToHex({
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  });
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  return `#${[rgb.r, rgb.g, rgb.b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}
