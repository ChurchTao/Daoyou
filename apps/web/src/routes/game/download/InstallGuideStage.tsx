import type { ReactNode } from 'react';

const INK = '#2c1810';
const PAPER = '#f8f3e6';
const CRIMSON = '#c1121f';
const MUTED = '#5a4a42';

export type InstallGuidePlatform = 'ios' | 'android' | 'desktop';

function HotRing({
  x,
  y,
  width,
  height,
  playing,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  playing: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={8}
      fill="rgba(193,18,31,0.08)"
      stroke={CRIMSON}
      strokeWidth={2}
      className={playing ? 'animate-pulse' : undefined}
    />
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 220 360"
      className="mx-auto h-72 w-auto"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="6"
        y="2"
        width="208"
        height="356"
        rx="32"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2"
      />
      <rect
        x="82"
        y="14"
        width="56"
        height="8"
        rx="4"
        fill={INK}
        opacity="0.28"
      />
      {children}
    </svg>
  );
}

function ShareGlyph({
  x,
  y,
  color = INK,
}: {
  x: number;
  y: number;
  color?: string;
}) {
  return (
    <g
      transform={`translate(${x} ${y})`}
      fill="none"
      stroke={color}
      strokeWidth="2"
    >
      <path d="M12 11v14H3V11" />
      <path d="M7.5 13 L12 6 L16.5 13" />
      <path d="M12 6v14" />
    </g>
  );
}

function SafariToolbar({ hot, playing }: { hot: boolean; playing: boolean }) {
  return (
    <g>
      <line
        x1="24"
        y1="286"
        x2="196"
        y2="286"
        stroke={INK}
        strokeOpacity="0.18"
      />
      {hot ? (
        <HotRing x={86} y={292} width={48} height={44} playing={playing} />
      ) : null}
      <path
        d="M36 314h12M36 314l5-5M36 314l5 5"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
      />
      <path
        d="M70 314h12M82 314l-5-5M82 314l-5 5"
        fill="none"
        stroke={INK}
        strokeOpacity="0.35"
        strokeWidth="1.8"
      />
      <ShareGlyph x={98} y={296} color={hot ? CRIMSON : INK} />
      <rect
        x="148"
        y="304"
        width="14"
        height="16"
        rx="1"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
      />
      <rect
        x="176"
        y="304"
        width="16"
        height="16"
        rx="3"
        fill="none"
        stroke={INK}
        strokeWidth="1.8"
      />
      {hot ? (
        <text x="110" y="278" textAnchor="middle" fontSize="14" fill={CRIMSON}>
          分享
        </text>
      ) : null}
    </g>
  );
}

function PageLines() {
  return (
    <g fill={INK}>
      <rect x="36" y="112" width="86" height="8" rx="2" opacity="0.16" />
      <rect x="36" y="128" width="148" height="7" rx="2" opacity="0.08" />
      <rect x="36" y="142" width="124" height="7" rx="2" opacity="0.08" />
      <rect x="36" y="164" width="148" height="52" rx="4" opacity="0.05" />
    </g>
  );
}

function AddressBar({ label, width = 156 }: { label: string; width?: number }) {
  return (
    <g>
      <rect
        x="32"
        y="68"
        width={width}
        height="24"
        rx="12"
        fill="none"
        stroke={INK}
        strokeOpacity="0.28"
      />
      <text
        x={32 + width / 2}
        y="84"
        textAnchor="middle"
        fontSize="12"
        fill={INK}
      >
        {label}
      </text>
    </g>
  );
}

function HomeIcon({
  x,
  y,
  hot,
  playing,
}: {
  x: number;
  y: number;
  hot: boolean;
  playing: boolean;
}) {
  return (
    <g>
      {hot ? (
        <HotRing x={x - 8} y={y - 8} width={52} height={68} playing={playing} />
      ) : null}
      <rect x={x} y={y} width="36" height="36" rx="10" fill={INK} />
      <text
        x={x + 18}
        y={y + 24}
        textAnchor="middle"
        fontSize="16"
        fill={PAPER}
      >
        道
      </text>
      <text x={x + 18} y={y + 52} textAnchor="middle" fontSize="11" fill={INK}>
        万界道友
      </text>
    </g>
  );
}

function FaintIcons() {
  const spots = [
    [36, 78],
    [148, 78],
    [36, 168],
    [148, 168],
  ];
  return (
    <g fill={INK} opacity="0.08">
      {spots.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="36" height="36" rx="10" />
      ))}
    </g>
  );
}

function IosScene({ frame, playing }: { frame: number; playing: boolean }) {
  if (frame === 2) {
    return (
      <PhoneShell>
        <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
          Safari
        </text>
        <rect
          x="16"
          y="64"
          width="188"
          height="272"
          fill={INK}
          opacity="0.06"
        />
        <rect
          x="16"
          y="168"
          width="188"
          height="176"
          rx="18"
          fill={PAPER}
          stroke={INK}
        />
        <rect
          x="96"
          y="178"
          width="28"
          height="4"
          rx="2"
          fill={INK}
          opacity="0.2"
        />
        <g fill={INK} opacity="0.12">
          <circle cx="58" cy="206" r="12" />
          <circle cx="110" cy="206" r="12" />
          <circle cx="162" cy="206" r="12" />
        </g>
        <text x="40" y="246" fontSize="14" fill={MUTED}>
          拷贝
        </text>
        <HotRing x={28} y={258} width={164} height={40} playing={playing} />
        <rect
          x="40"
          y="270"
          width="16"
          height="16"
          rx="2"
          fill="none"
          stroke={CRIMSON}
          strokeWidth="1.8"
        />
        <path d="M48 273v10M43 278h10" stroke={CRIMSON} strokeWidth="1.8" />
        <text x="64" y="283" fontSize="15" fill={CRIMSON}>
          添加到主屏幕
        </text>
      </PhoneShell>
    );
  }

  if (frame === 3) {
    return (
      <PhoneShell>
        <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
          主屏幕
        </text>
        <FaintIcons />
        <HomeIcon x={92} y={120} hot playing={playing} />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
        Safari
      </text>
      <AddressBar label="万界道友" />
      <PageLines />
      <SafariToolbar hot={frame === 1} playing={playing} />
    </PhoneShell>
  );
}

function AndroidScene({ frame, playing }: { frame: number; playing: boolean }) {
  if (frame === 2) {
    return (
      <PhoneShell>
        <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
          Chrome
        </text>
        <AddressBar label="万界道友" width={132} />
        <g transform="translate(186 74)" fill={INK}>
          <circle cx="0" cy="0" r="1.5" />
          <circle cx="0" cy="6" r="1.5" />
          <circle cx="0" cy="12" r="1.5" />
        </g>
        <rect
          x="78"
          y="108"
          width="124"
          height="132"
          rx="8"
          fill={PAPER}
          stroke={INK}
        />
        <text x="92" y="136" fontSize="12" fill={MUTED}>
          新标签页
        </text>
        <HotRing x={86} y={150} width={108} height={32} playing={playing} />
        <text x="96" y="171" fontSize="13" fill={CRIMSON}>
          安装应用
        </text>
        <text x="92" y="206" fontSize="12" fill={INK}>
          添加到主屏幕
        </text>
      </PhoneShell>
    );
  }

  if (frame === 3) {
    return (
      <PhoneShell>
        <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
          主屏幕
        </text>
        <FaintIcons />
        <HomeIcon x={92} y={120} hot playing={playing} />
      </PhoneShell>
    );
  }

  return (
    <PhoneShell>
      <text x="110" y="52" textAnchor="middle" fontSize="12" fill={MUTED}>
        Chrome
      </text>
      <AddressBar label="万界道友" width={132} />
      {frame === 1 ? (
        <HotRing x={172} y={64} width={28} height={36} playing={playing} />
      ) : null}
      <g transform="translate(186 74)" fill={INK}>
        <circle cx="0" cy="0" r="1.5" />
        <circle cx="0" cy="6" r="1.5" />
        <circle cx="0" cy="12" r="1.5" />
      </g>
      {frame === 1 ? (
        <text x="186" y="116" textAnchor="middle" fontSize="11" fill={CRIMSON}>
          菜单
        </text>
      ) : null}
      <PageLines />
    </PhoneShell>
  );
}

function DesktopScene({ frame, playing }: { frame: number; playing: boolean }) {
  return (
    <svg
      viewBox="0 0 320 220"
      className="mx-auto h-52 w-auto max-w-full"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="8"
        y="8"
        width="304"
        height={frame === 2 ? 136 : 184}
        rx="8"
        fill={PAPER}
        stroke={INK}
        strokeWidth="2"
      />
      <circle cx="24" cy="24" r="3" fill="#c1121f" opacity="0.7" />
      <circle cx="36" cy="24" r="3" fill="#efbf04" opacity="0.8" />
      <circle cx="48" cy="24" r="3" fill="#4a7c59" opacity="0.8" />
      <text x="160" y="28" textAnchor="middle" fontSize="11" fill={MUTED}>
        Chrome / Edge
      </text>
      <rect
        x="24"
        y="40"
        width="272"
        height="26"
        rx="13"
        fill="none"
        stroke={INK}
        strokeOpacity="0.28"
      />
      <text x="150" y="57" textAnchor="middle" fontSize="12" fill={INK}>
        万界道友
      </text>
      {frame === 1 ? (
        <HotRing x={258} y={40} width={32} height={28} playing={playing} />
      ) : null}
      {frame !== 2 ? (
        <g
          transform="translate(266 46)"
          fill="none"
          stroke={frame === 1 ? CRIMSON : INK}
          strokeWidth="1.6"
        >
          <rect x="0" y="5" width="14" height="8" rx="1" />
          <path d="M4 13h6" />
          <path d="M7 0v6M4 4l3 3 3-3" />
        </g>
      ) : null}
      {frame === 0 ? (
        <g fill={INK}>
          <rect x="24" y="80" width="120" height="8" rx="2" opacity="0.14" />
          <rect x="24" y="96" width="200" height="7" rx="2" opacity="0.08" />
          <rect x="24" y="110" width="160" height="7" rx="2" opacity="0.08" />
        </g>
      ) : null}
      {frame === 1 ? (
        <g>
          <rect
            x="168"
            y="74"
            width="128"
            height="70"
            rx="6"
            fill={PAPER}
            stroke={INK}
          />
          <text x="232" y="98" textAnchor="middle" fontSize="12" fill={INK}>
            安装万界道友
          </text>
          <text
            x="232"
            y="124"
            textAnchor="middle"
            fontSize="13"
            fill={CRIMSON}
          >
            安装
          </text>
        </g>
      ) : null}
      {frame === 2 ? (
        <g>
          <rect
            x="70"
            y="156"
            width="180"
            height="32"
            rx="16"
            fill={PAPER}
            stroke={INK}
            strokeOpacity="0.35"
          />
          <HotRing x={138} y={154} width={44} height={36} playing={playing} />
          <rect x="146" y="162" width="20" height="20" rx="5" fill={INK} />
          <text x="156" y="176" textAnchor="middle" fontSize="11" fill={PAPER}>
            道
          </text>
          <text x="160" y="208" textAnchor="middle" fontSize="12" fill={INK}>
            从程序坞或桌面打开
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function InstallGuideStage({
  platform,
  frame,
  playing,
}: {
  platform: InstallGuidePlatform;
  frame: number;
  playing: boolean;
}) {
  if (platform === 'android') {
    return <AndroidScene frame={frame} playing={playing} />;
  }
  if (platform === 'desktop') {
    return <DesktopScene frame={frame} playing={playing} />;
  }
  return <IosScene frame={frame} playing={playing} />;
}
