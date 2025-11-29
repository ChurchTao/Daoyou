/**
 * SVG 图标组件
 * 古风修仙风格图标集合
 */

/**
 * 丹炉图标（传统三足鼎样式，带冒烟动画）
 */
export function AlchemyFurnaceIcon({
  className = 'w-6 h-6',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 炉体 */}
      <ellipse
        cx="32"
        cy="40"
        rx="18"
        ry="12"
        fill="#8b4513"
        stroke="#654321"
        strokeWidth="1.5"
      />
      <ellipse cx="32" cy="36" rx="14" ry="8" fill="#a0522d" />
      {/* 炉口 */}
      <ellipse cx="32" cy="28" rx="12" ry="6" fill="#654321" />
      <ellipse cx="32" cy="26" rx="10" ry="4" fill="#2c1810" opacity="0.6" />
      {/* 三足 */}
      <path
        d="M 20 52 L 16 64 M 32 52 L 32 64 M 44 52 L 48 64"
        stroke="#654321"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* 炉耳 */}
      <path
        d="M 14 32 Q 10 28 10 24"
        stroke="#8b4513"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 50 32 Q 54 28 54 24"
        stroke="#8b4513"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* 冒烟 */}
      <path
        d="M 28 20 Q 26 12 28 4"
        stroke="#5a4a42"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
        className="smoke"
        strokeLinecap="round"
      />
      <path
        d="M 32 18 Q 32 10 32 2"
        stroke="#5a4a42"
        strokeWidth="1.5"
        fill="none"
        opacity="0.5"
        className="smoke"
        style={{ animationDelay: '0.3s' }}
        strokeLinecap="round"
      />
      <path
        d="M 36 20 Q 38 12 36 4"
        stroke="#5a4a42"
        strokeWidth="1.5"
        fill="none"
        opacity="0.6"
        className="smoke"
        style={{ animationDelay: '0.6s' }}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 古籍图标（打开的书本）
 */
export function AncientBookIcon({
  className = 'w-6 h-6',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 书页 */}
      <path
        d="M 8 12 L 8 52 Q 8 56 12 56 L 28 56 Q 32 56 32 52 L 32 12 Q 32 8 28 8 L 12 8 Q 8 8 8 12 Z"
        fill="#f8f3e6"
        stroke="#2c1810"
        strokeWidth="1.5"
      />
      <path
        d="M 32 12 L 32 52 Q 32 56 36 56 L 52 56 Q 56 56 56 52 L 56 12 Q 56 8 52 8 L 36 8 Q 32 8 32 12 Z"
        fill="#f8f3e6"
        stroke="#2c1810"
        strokeWidth="1.5"
      />
      {/* 书脊 */}
      <line x1="32" y1="8" x2="32" y2="56" stroke="#8b4513" strokeWidth="2" />
      {/* 文字线条（模拟文字） */}
      <line
        x1="14"
        y1="20"
        x2="26"
        y2="20"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="14"
        y1="28"
        x2="26"
        y2="28"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="14"
        y1="36"
        x2="26"
        y2="36"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="38"
        y1="20"
        x2="50"
        y2="20"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="38"
        y1="28"
        x2="50"
        y2="28"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="38"
        y1="36"
        x2="50"
        y2="36"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
    </svg>
  );
}

/**
 * 龙纹图标（简化龙形）
 */
export function DragonPatternIcon({
  className = 'w-5 h-5',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 龙身 */}
      <path
        d="M 8 32 Q 16 20 24 24 Q 32 28 40 20 Q 48 12 56 20"
        stroke="#c1121f"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 龙头 */}
      <circle cx="56" cy="20" r="4" fill="#c1121f" />
      <path
        d="M 60 18 L 62 16 M 60 22 L 62 24"
        stroke="#c1121f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 龙尾 */}
      <path
        d="M 8 32 Q 4 28 6 24"
        stroke="#c1121f"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* 龙爪 */}
      <path
        d="M 24 24 L 22 28 M 28 26 L 26 30"
        stroke="#c1121f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 40 20 L 38 24 M 44 22 L 42 26"
        stroke="#c1121f"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 龙鳞 */}
      <circle cx="20" cy="26" r="1.5" fill="#c1121f" opacity="0.6" />
      <circle cx="32" cy="24" r="1.5" fill="#c1121f" opacity="0.6" />
      <circle cx="44" cy="18" r="1.5" fill="#c1121f" opacity="0.6" />
    </svg>
  );
}

/**
 * 竹简图标（竹片串成的简册）
 */
export function BambooScrollIcon({
  className = 'w-6 h-6',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 竹片 */}
      <rect
        x="12"
        y="8"
        width="40"
        height="6"
        rx="1"
        fill="#4a7c59"
        stroke="#2c1810"
        strokeWidth="0.5"
      />
      <rect
        x="12"
        y="18"
        width="40"
        height="6"
        rx="1"
        fill="#4a7c59"
        stroke="#2c1810"
        strokeWidth="0.5"
      />
      <rect
        x="12"
        y="28"
        width="40"
        height="6"
        rx="1"
        fill="#4a7c59"
        stroke="#2c1810"
        strokeWidth="0.5"
      />
      <rect
        x="12"
        y="38"
        width="40"
        height="6"
        rx="1"
        fill="#4a7c59"
        stroke="#2c1810"
        strokeWidth="0.5"
      />
      <rect
        x="12"
        y="48"
        width="40"
        height="6"
        rx="1"
        fill="#4a7c59"
        stroke="#2c1810"
        strokeWidth="0.5"
      />
      {/* 连接线 */}
      <line x1="20" y1="8" x2="20" y2="54" stroke="#2c1810" strokeWidth="1" />
      <line x1="32" y1="8" x2="32" y2="54" stroke="#2c1810" strokeWidth="1" />
      <line x1="44" y1="8" x2="44" y2="54" stroke="#2c1810" strokeWidth="1" />
      {/* 文字线条 */}
      <line
        x1="14"
        y1="11"
        x2="18"
        y2="11"
        stroke="#2c1810"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <line
        x1="14"
        y1="21"
        x2="18"
        y2="21"
        stroke="#2c1810"
        strokeWidth="0.8"
        opacity="0.5"
      />
      <line
        x1="14"
        y1="31"
        x2="18"
        y2="31"
        stroke="#2c1810"
        strokeWidth="0.8"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * 云纹图标（传统云纹图案）
 */
export function CloudPatternIcon({
  className = 'w-6 h-6',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 云纹曲线 */}
      <path
        d="M 0 16 Q 8 8 16 16 T 32 16 T 48 16 T 64 16"
        stroke="#2c1810"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
        strokeLinecap="round"
      />
      <path
        d="M 0 20 Q 10 10 20 20 T 40 20 T 60 20"
        stroke="#2c1810"
        strokeWidth="1.5"
        fill="none"
        opacity="0.25"
        strokeLinecap="round"
      />
      <path
        d="M 4 12 Q 12 4 20 12 Q 28 4 36 12 Q 44 4 52 12 Q 60 4 64 12"
        stroke="#2c1810"
        strokeWidth="1"
        fill="none"
        opacity="0.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 砚台图标（传统文房四宝）
 */
export function InkstoneIcon({
  className = 'w-6 h-6',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 砚台主体 */}
      <ellipse
        cx="32"
        cy="48"
        rx="24"
        ry="8"
        fill="#2c1810"
        stroke="#1a1008"
        strokeWidth="1.5"
      />
      <ellipse cx="32" cy="44" rx="20" ry="6" fill="#5a4a42" />
      {/* 墨池 */}
      <ellipse cx="32" cy="40" rx="14" ry="4" fill="#1a1008" />
      {/* 砚台边缘 */}
      <path
        d="M 12 44 Q 8 40 8 36 Q 8 32 12 28 Q 16 24 20 24 Q 24 24 28 28 Q 32 24 36 24 Q 40 24 44 28 Q 48 32 48 36 Q 48 40 44 44"
        stroke="#8b4513"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      {/* 装饰纹路 */}
      <path
        d="M 20 32 Q 24 30 28 32"
        stroke="#8b4513"
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />
      <path
        d="M 36 32 Q 40 30 44 32"
        stroke="#8b4513"
        strokeWidth="1"
        fill="none"
        opacity="0.6"
      />
    </svg>
  );
}

/**
 * 卷轴图标（展开的卷轴）
 */
export function ScrollIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 卷轴木轴 */}
      <rect
        x="4"
        y="16"
        width="6"
        height="16"
        rx="2"
        fill="#8b4513"
        stroke="#654321"
        strokeWidth="1"
      />
      <rect
        x="54"
        y="16"
        width="6"
        height="16"
        rx="2"
        fill="#8b4513"
        stroke="#654321"
        strokeWidth="1"
      />
      {/* 卷轴纸面 */}
      <rect
        x="10"
        y="12"
        width="44"
        height="24"
        rx="2"
        fill="#f8f3e6"
        stroke="#2c1810"
        strokeWidth="1.5"
      />
      {/* 文字线条 */}
      <line
        x1="14"
        y1="20"
        x2="50"
        y2="20"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="14"
        y1="26"
        x2="50"
        y2="26"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      <line
        x1="14"
        y1="32"
        x2="50"
        y2="32"
        stroke="#5a4a42"
        strokeWidth="1"
        opacity="0.4"
      />
      {/* 卷轴装饰线 */}
      <line
        x1="12"
        y1="14"
        x2="52"
        y2="14"
        stroke="#8b4513"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line
        x1="12"
        y1="34"
        x2="52"
        y2="34"
        stroke="#8b4513"
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * 印章图标（篆体印章，可自定义文字）
 */
export function SealIcon({
  className = 'w-16 h-16',
  text = '胜',
  color = '#c1121f',
}: {
  className?: string;
  text?: string;
  color?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 印章边框（方形，带圆角） */}
      <rect
        x="8"
        y="8"
        width="84"
        height="84"
        rx="4"
        fill="none"
        stroke={color}
        strokeWidth="4"
        opacity="0.9"
      />
      {/* 内部装饰线 */}
      <rect
        x="12"
        y="12"
        width="76"
        height="76"
        rx="2"
        fill="none"
        stroke={color}
        strokeWidth="1"
        opacity="0.5"
      />
      {/* 文字（使用更粗的字体模拟篆体） */}
      <text
        x="50"
        y="65"
        fontSize="56"
        fill={color}
        textAnchor="middle"
        fontFamily="serif"
        fontWeight="900"
        opacity="0.9"
        style={{ fontVariant: 'normal', letterSpacing: '0' }}
      >
        {text}
      </text>
    </svg>
  );
}

/**
 * 古籍批注图标（朱批标记）
 */
export function AnnotationIcon({
  className = 'w-4 h-4',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 竖线 */}
      <line
        x1="8"
        y1="4"
        x2="8"
        y2="28"
        stroke="#c1121f"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.6"
      />
      {/* 批注标记点 */}
      <circle cx="8" cy="16" r="3" fill="#c1121f" opacity="0.4" />
    </svg>
  );
}

/**
 * 云纹分隔线（用于页面分隔）
 */
export function CloudDivider({
  className = 'w-full h-10',
}: {
  className?: string;
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 400 40"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 多层云纹 */}
      <path
        d="M 0 20 Q 50 10 100 20 T 200 20 T 300 20 T 400 20"
        stroke="#2c1810"
        strokeWidth="1.5"
        fill="none"
        opacity="0.25"
        strokeLinecap="round"
      />
      <path
        d="M 0 25 Q 60 12 120 25 T 240 25 T 360 25 T 400 25"
        stroke="#2c1810"
        strokeWidth="1.5"
        fill="none"
        opacity="0.2"
        strokeLinecap="round"
      />
      <path
        d="M 20 15 Q 70 5 130 15 Q 190 5 250 15 Q 310 5 370 15"
        stroke="#2c1810"
        strokeWidth="1"
        fill="none"
        opacity="0.15"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * 火焰图标（用于天榜标题）
 */
export function FlameIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 火焰主体 */}
      <path
        d="M 16 4 Q 12 8 10 14 Q 8 20 10 26 Q 12 32 16 36 Q 20 32 22 26 Q 24 20 22 14 Q 20 8 16 4 Z"
        fill="#c1121f"
        opacity="0.8"
      />
      {/* 内焰 */}
      <path
        d="M 16 8 Q 14 12 13 16 Q 12 20 13 24 Q 14 28 16 30 Q 18 28 19 24 Q 20 20 19 16 Q 18 12 16 8 Z"
        fill="#ff6b6b"
        opacity="0.9"
      />
      {/* 火苗 */}
      <ellipse cx="14" cy="12" rx="2" ry="4" fill="#ffd700" opacity="0.7" />
      <ellipse cx="18" cy="12" rx="2" ry="4" fill="#ffd700" opacity="0.7" />
    </svg>
  );
}

// 导出别名以保持向后兼容
export const VictorySeal = SealIcon;
